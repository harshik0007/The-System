import EmergencyPause from '../models/EmergencyPause.js';
import EmergencyPauseMonthlyUsage from '../models/EmergencyPauseMonthlyUsage.js';
import ProgressionRun from '../models/ProgressionRun.js';
import RecoveryQuest from '../models/RecoveryQuest.js';
import User from '../models/User.js';
import { EMERGENCY_PAUSE_ALLOWANCE } from '../config/emergencyPauseConfiguration.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/httpErrors.js';
import { addIstCalendarDays, getIstMidnightInstant, getIstMonthKey } from '../utils/ist.js';
import { getEmergencyPauseResumeAt, isEmergencyPauseActive } from '../utils/emergencyPauseState.js';
import { withMongoTransaction } from './mongoTransaction.js';
import { createNotificationWithinSession } from './notificationService.js';

export { EMERGENCY_PAUSE_ALLOWANCE };
export const EMERGENCY_PAUSE_MIN_DAYS = 1;
export const EMERGENCY_PAUSE_MAX_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function nextIstMonthBoundary(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return getIstMidnightInstant(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01`);
}

export function calculateEmergencyPauseSchedule(startedAt, durationDays) {
  const start = new Date(startedAt);
  const monthKey = getIstMonthKey(start);
  const selectedEndAt = new Date(start.getTime() + durationDays * DAY_MS);
  const monthBoundary = nextIstMonthBoundary(monthKey);
  const monthlyBoundaryFirst = monthBoundary.getTime() <= selectedEndAt.getTime();
  return {
    selectedEndAt,
    effectiveEndAt: monthlyBoundaryFirst ? monthBoundary : selectedEndAt,
    scheduledEndReason: monthlyBoundaryFirst ? 'monthly-boundary' : 'selected-duration',
  };
}

function toPauseDto(pause, now) {
  if (!pause) return null;
  const startedAt = new Date(pause.startedAt || pause.activatedAt);
  const effectiveEndAt = new Date(pause.effectiveEndAt || pause.resumesAt);
  const reportedEnd = pause.actualEndAt
    ? new Date(pause.actualEndAt)
    : new Date(Math.min(new Date(now).getTime(), effectiveEndAt.getTime()));
  return {
    id: pause._id ? String(pause._id) : null,
    progressionRunId: pause.progressionRunId ? String(pause.progressionRunId) : null,
    status: pause.status,
    startedAt: startedAt.toISOString(),
    durationDays: pause.durationDays,
    selectedEndAt: (pause.selectedEndAt || effectiveEndAt).toISOString(),
    effectiveEndAt: effectiveEndAt.toISOString(),
    actualEndAt: pause.actualEndAt?.toISOString?.() || null,
    endReason: pause.endReason || null,
    activationMonth: pause.activationMonthKey,
    durationSpentMs: Math.max(0, reportedEnd.getTime() - startedAt.getTime()),
    earlyResumeAvailable: pause.status === 'active' && new Date(now).getTime() < effectiveEndAt.getTime(),
    remainingMs: pause.status === 'active' ? Math.max(0, effectiveEndAt.getTime() - new Date(now).getTime()) : 0,
    recoveryQuestSnapshots: (pause.recoveryQuestSnapshots || []).map((item) => ({
      questId: String(item.questId),
      remainingDurationMs: item.remainingDurationMs,
    })),
  };
}

function attachSession(query, session) {
  return session ? query.session(session) : query;
}

async function monthUsage(userId, monthKey, progressionRunId, session) {
  const usage = await attachSession(EmergencyPauseMonthlyUsage.findOne({ userId, monthKey }), session);
  if (usage && progressionRunId && !usage.progressionRunId) {
    // Migrate the existing M24 counter lazily: before M28 it was attached to
    // the account/month, so its current value belongs to the currently active run.
    usage.progressionRunId = progressionRunId;
    await usage.save({ session });
  }
  if (usage?.progressionRunId && progressionRunId
    && String(usage.progressionRunId) !== String(progressionRunId)) return 0;
  return usage?.activationsUsed || 0;
}

async function incrementMonthUsage(userId, monthKey, progressionRunId, session) {
  const existing = await EmergencyPauseMonthlyUsage.findOne({ userId, monthKey }).session(session);
  if (!existing) {
    const [created] = await EmergencyPauseMonthlyUsage.create([{ userId, monthKey, progressionRunId, activationsUsed: 1 }], { session });
    return created.activationsUsed;
  }
  if (!existing.progressionRunId) {
    existing.progressionRunId = progressionRunId;
    await existing.save({ session });
  }
  if (String(existing.progressionRunId) !== String(progressionRunId)) {
    throw new ConflictError('EMERGENCY_PAUSE_ALLOWANCE_RUN_MISMATCH', 'The Emergency Pause allowance changed with the active Progression Run. Refresh and try again.');
  }
  const updated = await EmergencyPauseMonthlyUsage.findOneAndUpdate({
    _id: existing._id,
    userId,
    monthKey,
    progressionRunId,
    activationsUsed: { $lt: EMERGENCY_PAUSE_ALLOWANCE },
  }, { $inc: { activationsUsed: 1 } }, { new: true, session, runValidators: true });
  if (!updated) throw new ConflictError('EMERGENCY_PAUSE_MONTHLY_LIMIT', `All ${EMERGENCY_PAUSE_ALLOWANCE} Emergency Pause activations have been used this IST month.`);
  return updated.activationsUsed;
}

async function freezeActiveQuestsWithinSession({ userId, progressionRunId, startedAt, session }) {
  const quests = await RecoveryQuest.find({ userId, progressionRunId, status: 'active', remainingDurationMs: null }).session(session);
  const snapshots = [];
  for (const quest of quests) {
    const remainingDurationMs = Math.max(0, quest.expiresAt.getTime() - startedAt.getTime());
    quest.remainingDurationMs = remainingDurationMs;
    quest.pausedAt = startedAt;
    await quest.save({ session });
    snapshots.push({ questId: quest._id, remainingDurationMs });
  }
  return snapshots;
}

async function restoreActiveQuestsWithinSession({ userId, pause, resumedAt, session }) {
  if (!pause) return 0;
  let restored = 0;
  const snapshots = pause.recoveryQuestSnapshots || [];
  for (const snapshot of snapshots) {
    const quest = await RecoveryQuest.findOne({
      _id: snapshot.questId,
      userId,
      progressionRunId: pause.progressionRunId,
      status: 'active',
      remainingDurationMs: { $ne: null },
    }).session(session);
    if (!quest) continue;
    quest.expiresAt = new Date(resumedAt.getTime() + Math.max(0, snapshot.remainingDurationMs));
    quest.remainingDurationMs = null;
    quest.pausedAt = null;
    await quest.save({ session });
    restored += 1;
  }
  return restored;
}

async function finishPauseWithinSession({ userId, run, pause, actualEndAt, endReason, recordedAt, session }) {
  if (!run || !pause || pause.status !== 'active') return { ended: false, pause };
  await restoreActiveQuestsWithinSession({ userId, pause, resumedAt: actualEndAt, session });
  const ended = await EmergencyPause.findOneAndUpdate({ _id: pause._id, userId, status: 'active' }, {
    $set: { status: 'ended', actualEndAt, endReason, transitionRecordedAt: recordedAt },
  }, { new: true, session, runValidators: true });
  if (!ended) return { ended: false, pause: await EmergencyPause.findById(pause._id).session(session) };
  const used = await monthUsage(userId, getIstMonthKey(recordedAt), run._id, session);
  const runUpdate = await ProgressionRun.updateOne({
    _id: run._id,
    userId,
    status: 'active',
    'emergencyPause.active': true,
    'emergencyPause.pauseId': pause._id,
  }, { $set: {
    'emergencyPause.active': false,
    'emergencyPause.pauseId': null,
    'emergencyPause.allowanceMonthKey': getIstMonthKey(recordedAt),
    'emergencyPause.activationsUsed': used,
    'emergencyPause.selectedDurationDays': null,
    'emergencyPause.activatedAt': null,
    'emergencyPause.resumesAt': null,
  } }, { session, runValidators: true });
  if (runUpdate.modifiedCount !== 1) throw new ConflictError('EMERGENCY_PAUSE_STATE_CHANGED', 'Emergency Pause state changed before it could be resumed. Retry the request.');
  run.emergencyPause = {
    active: false,
    pauseId: null,
    allowanceMonthKey: getIstMonthKey(recordedAt),
    activationsUsed: used,
    selectedDurationDays: null,
    activatedAt: null,
    resumesAt: null,
  };
  const early = endReason === 'early-resume';
  await createNotificationWithinSession({
    userId, progressionRunId: pause.progressionRunId, category: 'emergency-pause',
    eventType: early ? 'emergency-pause-resumed-early' : 'emergency-pause-automatically-resumed',
    title: early ? 'Emergency Pause resumed early' : 'Emergency Pause ended',
    description: early
      ? 'Your Emergency Pause was resumed early. Scheduled systems have returned to their normal state.'
      : 'Your selected Emergency Pause period ended and the system resumed automatically.',
    targetRoute: '/app/dashboard', idempotencyKey: `emergency-pause-ended:${ended._id}`,
    occurredAt: actualEndAt, session,
  });
  return { ended: true, pause: ended };
}

/** Ends a Pause as part of a manual run reset without restoring old Quest timers. */
export async function terminateEmergencyPauseForManualResetWithinSession({ userId, run, endedAt, session }) {
  if (!session) throw new TypeError('Manual-reset Pause termination requires the caller transaction session.');
  if (!run) return { ended: false, pause: null };
  const pause = run.emergencyPause?.pauseId
    ? await EmergencyPause.findOne({ _id: run.emergencyPause.pauseId, userId, progressionRunId: run._id, status: 'active' }).session(session)
    : await EmergencyPause.findOne({ userId, progressionRunId: run._id, status: 'active' }).session(session);
  if (!pause) return { ended: false, pause: null };
  const instant = new Date(endedAt);
  const ended = await EmergencyPause.findOneAndUpdate({ _id: pause._id, userId, progressionRunId: run._id, status: 'active' }, {
    $set: { status: 'ended', actualEndAt: instant, endReason: 'manual-reset', transitionRecordedAt: instant },
  }, { new: true, session, runValidators: true });
  return { ended: Boolean(ended), pause: ended || await EmergencyPause.findById(pause._id).session(session) };
}

/** Reconciles the run's authoritative active state with its durable Pause record. Caller must own a transaction. */
export async function reconcileEmergencyPauseWithinSession({ userId, run, now = new Date(), session }) {
  if (!session) throw new TypeError('Emergency Pause reconciliation requires a Mongo transaction.');
  const instant = new Date(now);
  if (!run) return { active: false, pause: null };
  let pause = run.emergencyPause?.pauseId
    ? await EmergencyPause.findOne({ _id: run.emergencyPause.pauseId, userId, status: 'active' }).session(session)
    : await EmergencyPause.findOne({ userId, status: 'active' }).session(session);

  const endAt = pause?.effectiveEndAt || getEmergencyPauseResumeAt(run);
  if (run.emergencyPause?.active && endAt && endAt.getTime() <= instant.getTime()) {
    if (pause) {
      const reason = pause.scheduledEndReason;
      await finishPauseWithinSession({ userId, run, pause, actualEndAt: endAt, endReason: reason, recordedAt: instant, session });
      pause = await EmergencyPause.findById(pause._id).session(session);
    } else {
      // Compatibility for a pre-M24 run that only has the old embedded Pause snapshot.
      const quests = await RecoveryQuest.find({ userId, progressionRunId: run._id, status: 'active', remainingDurationMs: { $ne: null } }).session(session);
      for (const quest of quests) {
        quest.expiresAt = new Date(endAt.getTime() + Math.max(0, quest.remainingDurationMs));
        quest.remainingDurationMs = null;
        quest.pausedAt = null;
        await quest.save({ session });
      }
      run.emergencyPause.active = false;
      run.emergencyPause.pauseId = null;
      run.emergencyPause.allowanceMonthKey = getIstMonthKey(instant);
      run.emergencyPause.activationsUsed = await monthUsage(userId, getIstMonthKey(instant), run._id, session);
      run.emergencyPause.selectedDurationDays = null;
      run.emergencyPause.activatedAt = null;
      run.emergencyPause.resumesAt = null;
      await run.save({ session });
    }
  } else if (run.emergencyPause?.active && pause) {
    const unfrozen = await RecoveryQuest.find({ userId, progressionRunId: run._id, status: 'active', remainingDurationMs: null }).session(session);
    for (const quest of unfrozen) {
      quest.remainingDurationMs = Math.max(0, quest.expiresAt.getTime() - pause.startedAt.getTime());
      quest.pausedAt = pause.startedAt;
      await quest.save({ session });
    }
  }

  const refreshed = run.emergencyPause?.pauseId
    ? await EmergencyPause.findOne({ _id: run.emergencyPause.pauseId, userId, status: 'active' }).session(session)
    : await EmergencyPause.findOne({ userId, status: 'active' }).session(session);
  const active = isEmergencyPauseActive(run, instant) && (Boolean(refreshed) || !run.emergencyPause?.pauseId);
  return { active, pause: refreshed, run };
}

export async function freezeRecoveryQuestsForEmergencyPause({ userId, progressionRunId, activatedAt = new Date(), session }) {
  if (!session) throw new TypeError('Emergency Pause integration requires the caller transaction session.');
  return (await freezeActiveQuestsWithinSession({ userId, progressionRunId, startedAt: new Date(activatedAt), session })).length;
}

export async function resumeRecoveryQuestsAfterEmergencyPause({ userId, progressionRunId, resumedAt = new Date(), session }) {
  if (!session) throw new TypeError('Emergency Pause integration requires the caller transaction session.');
  const quests = await RecoveryQuest.find({ userId, progressionRunId, status: 'active', remainingDurationMs: { $ne: null } }).session(session);
  let restored = 0;
  for (const quest of quests) {
    quest.expiresAt = new Date(new Date(resumedAt).getTime() + Math.max(0, Number(quest.remainingDurationMs) || 0));
    quest.remainingDurationMs = null;
    quest.pausedAt = null;
    await quest.save({ session });
    restored += 1;
  }
  return restored;
}

async function pauseRecordCoversInstant({ userId, progressionRunId, instant, session }) {
  const at = new Date(instant);
  const pause = await attachSession(EmergencyPause.findOne({
    userId,
    progressionRunId,
    startedAt: { $lte: at },
    $or: [
      { status: 'active', effectiveEndAt: { $gt: at } },
      { status: 'ended', actualEndAt: { $gt: at } },
    ],
  }).select('_id'), session);
  return Boolean(pause);
}

export async function isEmergencyPauseInstantWithinSession({ userId, progressionRunId, instant, run, session }) {
  if (await pauseRecordCoversInstant({ userId, progressionRunId, instant, session })) return true;
  return isEmergencyPauseActive(run, instant);
}

export async function isEmergencyPauseDateWithinSession({ userId, progressionRunId, date, run, session }) {
  const start = getIstMidnightInstant(date);
  const end = getIstMidnightInstant(addIstCalendarDays(date, 1));
  const pause = await attachSession(EmergencyPause.findOne({
    userId,
    progressionRunId,
    startedAt: { $lt: end },
    $or: [
      { status: 'active', effectiveEndAt: { $gt: start } },
      { status: 'ended', actualEndAt: { $gt: start } },
    ],
  }).select('_id'), session);
  if (pause) return true;
  const pauseStart = run?.emergencyPause?.activatedAt;
  const pauseEnd = getEmergencyPauseResumeAt(run);
  return Boolean(run?.emergencyPause?.active && pauseStart && pauseEnd
    && new Date(pauseStart).getTime() < end.getTime()
    && pauseEnd.getTime() > start.getTime());
}

function statusDto({ userId, monthKey, used, pause, run, now }) {
  const active = isEmergencyPauseActive(run, now) && (pause?.status === 'active' || !run?.emergencyPause?.pauseId);
  const legacyPause = active && !pause ? {
    status: 'active',
    progressionRunId: run?._id,
    startedAt: run?.emergencyPause?.activatedAt || run?.startedAt,
    durationDays: run?.emergencyPause?.selectedDurationDays,
    selectedEndAt: run?.emergencyPause?.resumesAt,
    effectiveEndAt: run?.emergencyPause?.resumesAt,
    actualEndAt: null,
  } : null;
  return {
    currentIstMonth: monthKey,
    allowance: EMERGENCY_PAUSE_ALLOWANCE,
    activationsUsed: used,
    activationsRemaining: Math.max(0, EMERGENCY_PAUSE_ALLOWANCE - used),
    isActive: active,
    pause: active ? toPauseDto(pause || legacyPause, now) : null,
    progressionRunId: run ? String(run._id) : null,
    serverNow: new Date(now).toISOString(),
  };
}

export async function getEmergencyPauseStatus(userId, { now = new Date() } = {}) {
  const instant = new Date(now);
  const monthKey = getIstMonthKey(instant);
  return withMongoTransaction(async (session) => {
    const user = await User.findById(userId).session(session);
    if (!user) throw new NotFoundError('The Member identity was not found.');
    const run = await ProgressionRun.findOne({ userId, status: 'active' }).sort({ runNumber: -1 }).session(session);
    const reconciled = await reconcileEmergencyPauseWithinSession({ userId, run, now: instant, session });
    const pause = reconciled.pause || await EmergencyPause.findOne({ userId, status: 'active' }).session(session);
    const used = await monthUsage(userId, monthKey, run?._id, session);
    if (run && (
      run.emergencyPause?.allowanceMonthKey !== monthKey
      || run.emergencyPause?.activationsUsed !== used
    )) {
      run.emergencyPause.allowanceMonthKey = monthKey;
      run.emergencyPause.activationsUsed = used;
      await run.save({ session });
    }
    return statusDto({ userId, monthKey, used, pause, run, now: instant });
  });
}

export async function activateEmergencyPause({ userId, durationDays, idempotencyKey, now = new Date() }) {
  if (!Number.isInteger(durationDays) || durationDays < EMERGENCY_PAUSE_MIN_DAYS || durationDays > EMERGENCY_PAUSE_MAX_DAYS) {
    throw new ValidationError('Choose a whole number of Pause days from 1 through 7.', [{ field: 'durationDays', code: 'INVALID_DURATION' }]);
  }
  if (typeof idempotencyKey !== 'string' || idempotencyKey.trim().length < 8 || idempotencyKey.trim().length > 160) {
    throw new ValidationError('An Idempotency-Key between 8 and 160 characters is required.', [{ field: 'Idempotency-Key', code: 'INVALID_IDEMPOTENCY_KEY' }]);
  }
  const key = idempotencyKey.trim();
  const startedAt = new Date(now);
  const monthKey = getIstMonthKey(startedAt);
  return withMongoTransaction(async (session) => {
    const replay = await EmergencyPause.findOne({ userId, idempotencyKey: key }).session(session);
    if (replay) {
      if (replay.durationDays !== durationDays) throw new ConflictError('IDEMPOTENCY_KEY_REUSED', 'This request key was already used for a different Pause duration.');
      const run = await ProgressionRun.findOne({ userId, status: 'active' }).sort({ runNumber: -1 }).session(session);
      const used = await monthUsage(userId, monthKey, run?._id, session);
      return { ...statusDto({ userId, monthKey, used, pause: replay, run, now: startedAt }), idempotentReplay: true, activatedPause: toPauseDto(replay, startedAt) };
    }

    const user = await User.findById(userId).session(session);
    const run = await ProgressionRun.findOne({ userId, status: 'active' }).sort({ runNumber: -1 }).session(session);
    if (!user || !run || String(user.currentProgressionRunId || '') !== String(run._id)) {
      throw new ConflictError('ACTIVE_PROGRESSION_REQUIRED', 'An active Progression Run is required to activate Emergency Pause.');
    }
    await reconcileEmergencyPauseWithinSession({ userId, run, now: startedAt, session });
    const activeRecord = await EmergencyPause.findOne({ userId, status: 'active' }).session(session);
    if (run.emergencyPause?.active || activeRecord) throw new ConflictError('EMERGENCY_PAUSE_ALREADY_ACTIVE', 'An Emergency Pause is already active.');

    const used = await incrementMonthUsage(userId, monthKey, run._id, session);
    const { selectedEndAt, effectiveEndAt, scheduledEndReason } = calculateEmergencyPauseSchedule(startedAt, durationDays);
    const questSnapshots = await freezeActiveQuestsWithinSession({ userId, progressionRunId: run._id, startedAt, session });
    const [pause] = await EmergencyPause.create([{
      userId,
      progressionRunId: run._id,
      activationMonthKey: monthKey,
      idempotencyKey: key,
      durationDays,
      startedAt,
      selectedEndAt,
      effectiveEndAt,
      scheduledEndReason,
      status: 'active',
      recoveryQuestSnapshots: questSnapshots,
    }], { session });
    const update = await ProgressionRun.updateOne({
      _id: run._id,
      userId,
      status: 'active',
      'emergencyPause.active': { $ne: true },
    }, { $set: {
      'emergencyPause.active': true,
      'emergencyPause.pauseId': pause._id,
      'emergencyPause.allowanceMonthKey': monthKey,
      'emergencyPause.activationsUsed': used,
      'emergencyPause.selectedDurationDays': durationDays,
      'emergencyPause.activatedAt': startedAt,
      'emergencyPause.resumesAt': effectiveEndAt,
    } }, { session, runValidators: true });
    if (update.modifiedCount !== 1) throw new ConflictError('EMERGENCY_PAUSE_STATE_CHANGED', 'The Progression Run changed while activating Pause. Refresh and try again.');
    run.emergencyPause = { active: true, pauseId: pause._id, allowanceMonthKey: monthKey, activationsUsed: used, selectedDurationDays: durationDays, activatedAt: startedAt, resumesAt: effectiveEndAt };
    await createNotificationWithinSession({
      userId, progressionRunId: run._id, category: 'emergency-pause', eventType: 'emergency-pause-activated',
      title: 'Emergency Pause activated',
      description: `Your ${durationDays}-day Emergency Pause is active until ${effectiveEndAt.toISOString()}.`,
      targetRoute: '/app/dashboard', idempotencyKey: `emergency-pause-activated:${pause._id}`,
      occurredAt: startedAt, session,
    });
    return {
      ...statusDto({ userId, monthKey, used, pause, run, now: startedAt }),
      idempotentReplay: false,
      activatedPause: toPauseDto(pause, startedAt),
    };
  });
}

export async function resumeEmergencyPause({ userId, idempotencyKey, now = new Date() }) {
  if (typeof idempotencyKey !== 'string' || idempotencyKey.trim().length < 8 || idempotencyKey.trim().length > 160) {
    throw new ValidationError('An Idempotency-Key between 8 and 160 characters is required.', [{ field: 'Idempotency-Key', code: 'INVALID_IDEMPOTENCY_KEY' }]);
  }
  const key = idempotencyKey.trim();
  const instant = new Date(now);
  const monthKey = getIstMonthKey(instant);
  return withMongoTransaction(async (session) => {
    const replay = await EmergencyPause.findOne({ userId, resumeIdempotencyKey: key }).session(session);
    if (replay) {
      const run = await ProgressionRun.findOne({ userId, status: 'active' }).sort({ runNumber: -1 }).session(session);
      const used = await monthUsage(userId, monthKey, run?._id, session);
      return { ...statusDto({ userId, monthKey, used, pause: null, run, now: instant }), resumedPause: toPauseDto(replay, instant), idempotentReplay: true };
    }
    const user = await User.findById(userId).session(session);
    const run = await ProgressionRun.findOne({ userId, status: 'active' }).sort({ runNumber: -1 }).session(session);
    if (!user || !run || String(user.currentProgressionRunId || '') !== String(run._id)) throw new ConflictError('ACTIVE_PROGRESSION_REQUIRED', 'An active Progression Run is required to resume Emergency Pause.');
    await reconcileEmergencyPauseWithinSession({ userId, run, now: instant, session });
    const pause = run.emergencyPause?.pauseId
      ? await EmergencyPause.findOne({ _id: run.emergencyPause.pauseId, userId, status: 'active' }).session(session)
      : null;
    if (!pause || !run.emergencyPause?.active) throw new ConflictError('EMERGENCY_PAUSE_NOT_ACTIVE', 'There is no active Emergency Pause to resume.');
    if (pause.effectiveEndAt.getTime() <= instant.getTime()) throw new ConflictError('EMERGENCY_PAUSE_NOT_ACTIVE', 'This Emergency Pause has already reached its scheduled end.');
    const ended = await finishPauseWithinSession({ userId, run, pause, actualEndAt: instant, endReason: 'early-resume', recordedAt: instant, session });
    if (!ended.ended) throw new ConflictError('EMERGENCY_PAUSE_NOT_ACTIVE', 'There is no active Emergency Pause to resume.');
    ended.pause.resumeIdempotencyKey = key;
    await ended.pause.save({ session });
    const used = await monthUsage(userId, monthKey, run._id, session);
    return { ...statusDto({ userId, monthKey, used, pause: null, run, now: instant }), resumedPause: toPauseDto(ended.pause, instant), idempotentReplay: false };
  });
}

export async function processEmergencyPauseForUser({ userId, now = new Date() }) {
  return withMongoTransaction(async (session) => {
    const run = await ProgressionRun.findOne({ userId, status: 'active' }).sort({ runNumber: -1 }).session(session);
    if (!run) return { processed: false, active: false };
    const before = Boolean(run.emergencyPause?.active);
    const result = await reconcileEmergencyPauseWithinSession({ userId, run, now: new Date(now), session });
    return { processed: before && !result.active, active: result.active, pauseId: result.pause?._id ? String(result.pause._id) : null };
  });
}

export function buildEmergencyPauseStatusDto({ userId, monthKey = getIstMonthKey(), used = 0, pause = null, run = null, now = new Date() }) {
  return statusDto({ userId, monthKey, used, pause, run, now });
}

