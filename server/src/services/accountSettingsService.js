import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
import EmergencyPauseMonthlyUsage from '../models/EmergencyPauseMonthlyUsage.js';
import EmergencyPause from '../models/EmergencyPause.js';
import ProgressionResetEvent from '../models/ProgressionResetEvent.js';
import ProgressionRun from '../models/ProgressionRun.js';
import RankEntryEvent from '../models/RankEntryEvent.js';
import RecoveryQuest from '../models/RecoveryQuest.js';
import TaskSchedule from '../models/TaskSchedule.js';
import User from '../models/User.js';
import { EMERGENCY_PAUSE_ALLOWANCE } from '../config/emergencyPauseConfiguration.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/httpErrors.js';
import { getIstDateKey, getIstMonthKey } from '../utils/ist.js';
import { getCurrentRankFromLevel } from '../utils/ranks.js';
import { withMongoTransaction } from './mongoTransaction.js';
import { terminateEmergencyPauseForManualResetWithinSession } from './emergencyPauseService.js';
import { createFreshProgressionRunWithinSession } from './progressionRunFactory.js';

const APPEARANCE_KEYS = ['voidShardCursor', 'clickRipple', 'nonessentialAnimations', 'reduceDecorativeEffects', 'effectQuality'];
const ACCESSIBILITY_KEYS = ['reduceMotion'];
const ACCOUNT_PROJECTION = [
  '_id', 'identityKind', 'createdAt', 'memberSince', 'accountStatus', 'currentProgressionRunId', 'resetCount', 'lifetimeLongestStreak',
  'highestRankAchieved', 'personalBestRecords', 'username', 'firstName', 'middleName', 'lastName', 'publicHandle', 'avatarMark', 'privacy',
  'appearancePreferences', 'accessibilityPreferences', 'accountPreferencesInitialized', 'notificationPreferences',
].join(' ') + ' +emailNormalized +passwordHash +googleSub';
const MANUAL_RESET_PREFIX = 'manual-reset-and-restart:';

function normalizePreferenceGroup(value, allowlist, groupName, { nullable = [] } = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError(`${groupName} preferences must be an object.`, [{ field: groupName, code: 'INVALID_TYPE' }]);
  }
  const unknown = Object.keys(value).filter((key) => !allowlist.includes(key));
  if (unknown.length) throw new ValidationError('The request contains unsupported preference fields.', unknown.map((key) => ({ field: `${groupName}.${key}`, code: 'FIELD_NOT_ALLOWED' })));
  const normalized = {};
  for (const [key, preference] of Object.entries(value)) {
    if (nullable.includes(key) && preference === null) {
      normalized[key] = null;
    } else if (key === 'effectQuality' && groupName === 'appearance' && ['high', 'balanced', 'low'].includes(preference)) {
      normalized[key] = preference;
    } else if (typeof preference === 'boolean') {
      normalized[key] = preference;
    } else {
      throw new ValidationError(`${key} must be a boolean${nullable.includes(key) ? ' or null' : ''}.`, [{ field: `${groupName}.${key}`, code: 'INVALID_VALUE' }]);
    }
  }
  return normalized;
}

function normalizedBestRecords(records = {}) {
  const result = {};
  for (const category of ['overall', 'discipline', 'xp']) {
    const item = records?.[category];
    result[category] = item && typeof item === 'object'
      ? { bestPosition: Number.isInteger(item.bestPosition) && item.bestPosition > 0 ? item.bestPosition : null, achievedOn: typeof item.achievedOn === 'string' ? item.achievedOn : null }
      : { bestPosition: null, achievedOn: null };
  }
  return result;
}

function accountPreferences(user) {
  return {
    appearance: {
      voidShardCursor: user.appearancePreferences?.voidShardCursor !== false,
      clickRipple: user.appearancePreferences?.clickRipple !== false,
      nonessentialAnimations: user.appearancePreferences?.nonessentialAnimations !== false,
      reduceDecorativeEffects: Boolean(user.appearancePreferences?.reduceDecorativeEffects),
      effectQuality: ['high', 'balanced', 'low'].includes(user.appearancePreferences?.effectQuality) ? user.appearancePreferences.effectQuality : 'balanced',
    },
    accessibility: {
      reduceMotion: typeof user.accessibilityPreferences?.reduceMotion === 'boolean' ? user.accessibilityPreferences.reduceMotion : null,
    },
  };
}

function safePrivacy(user) {
  const defaults = {
    publicProfile: true, fullName: true, activityMap: true, personalBest: true, currentRank: true, level: true,
    progressionStats: true, currentStreak: true, longestStreak: true, disciplinePointBalance: true, gracePointBalance: true,
  };
  return Object.fromEntries(Object.keys(defaults).map((key) => [key, typeof user.privacy?.[key] === 'boolean' ? user.privacy[key] : defaults[key]]));
}

function personalBestResponse(user) {
  const records = normalizedBestRecords(user.personalBestRecords);
  const rank = user.highestRankAchieved ? getCurrentRankFromLevel({ origin: 0, ember: 10, surge: 20, vector: 35, apex: 50, zenith: 75, continuum: 100 }[user.highestRankAchieved] ?? 0) : null;
  return {
    ...records,
    highestRankAchieved: rank ? {
      rankSlug: user.highestRankAchieved,
      rankNumber: rank.number,
      rankName: rank.name,
      achievedOn: null,
    } : null,
  };
}

function safeAccountProfile(user, run, rankBadges) {
  const currentRank = run ? getCurrentRankFromLevel(run.level) : null;
  return {
    profile: {
      username: user.username || null,
      firstName: user.firstName || '',
      middleName: user.middleName || '',
      lastName: user.lastName || '',
      email: user.emailNormalized || null,
      authProviders: {
        localPassword: Boolean(user.authProviders?.localPassword || user.passwordHash),
        google: Boolean(user.authProviders?.google || user.googleSub),
      },
      publicHandle: user.publicHandle || null,
      avatarMark: user.avatarMark || 'initials',
    },
    privacy: safePrivacy(user),
    ...accountPreferences(user),
    notificationPreferences: {
      categories: Object.fromEntries([
        'tasks', 'recovery-quests', 'discipline', 'rank-xp', 'emergency-pause', 'monthly-retention',
      ].map((category) => [category, user.notificationPreferences?.categories?.[category] !== false])),
    },
    preferencesInitialized: Boolean(user.accountPreferencesInitialized),
    account: {
      createdAt: user.createdAt?.toISOString?.() || null,
      memberSince: user.memberSince,
      status: user.accountStatus,
      resetCount: user.resetCount,
      lifetimeLongestStreak: user.lifetimeLongestStreak,
    },
    progression: run ? {
      runNumber: run.runNumber,
      startedAt: run.startedAt.toISOString(),
      startedOn: run.startedOn,
      currentRank: currentRank ? { slug: currentRank.slug, number: currentRank.number, name: currentRank.name } : null,
      level: run.level,
      totalXp: Number(run.totalXp),
      gracePoints: run.gracePoints,
      disciplinePoints: Number(run.disciplinePoints),
      currentStreak: run.currentStreak,
      runLongestStreak: run.longestStreak,
      requiresScheduleSetup: !run.taskScheduleId,
      emergencyPauseActive: Boolean(run.emergencyPause?.active),
      emergencyPauseAllowance: EMERGENCY_PAUSE_ALLOWANCE,
      emergencyPauseActivationsUsed: run.emergencyPause?.activationsUsed || 0,
    } : null,
    achievements: {
      highestRankAchieved: user.highestRankAchieved || null,
      personalBestRecords: personalBestResponse(user),
      rankBadges,
    },
  };
}

async function loadCurrentUser(userId, session = null) {
  if (!mongoose.isValidObjectId(userId)) throw new ValidationError('The current member identity is invalid.');
  let query = User.findOne({ _id: userId, identityKind: 'account', accountStatus: 'active' }).select(ACCOUNT_PROJECTION);
  if (session) query = query.session(session);
  const user = await query;
  if (!user) throw new NotFoundError('The current member identity was not found.');
  return user;
}

async function loadSettingsRun(user, session) {
  const run = user.currentProgressionRunId
    ? await ProgressionRun.findOne({ _id: user.currentProgressionRunId, userId: user._id, status: 'active' }).select('_id runNumber startedAt startedOn currentRankSlug level totalXp gracePoints disciplinePoints currentStreak longestStreak taskScheduleId emergencyPause').session(session).lean()
    : null;
  const rankBadges = run
    ? [...new Set([run.currentRankSlug, ...await RankEntryEvent.distinct('rankSlug', { userId: user._id, progressionRunId: run._id }).session(session)])]
    : [];
  return { run, rankBadges };
}

async function getAccountSettingsWithinSession(userId, session) {
  const user = await loadCurrentUser(userId, session);
  const { run, rankBadges } = await loadSettingsRun(user, session);
  return safeAccountProfile(user, run, rankBadges);
}

export async function getAccountSettings(userId) {
  return withMongoTransaction((session) => getAccountSettingsWithinSession(userId, session));
}

export async function updateAccountPreferences(userId, body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ValidationError('Preferences must be submitted as an object.');
  const groups = Object.keys(body);
  const unknown = groups.filter((key) => !['appearance', 'accessibility'].includes(key));
  if (unknown.length) throw new ValidationError('The request contains unsupported preference groups.', unknown.map((field) => ({ field, code: 'FIELD_NOT_ALLOWED' })));
  if (!groups.length) throw new ValidationError('At least one supported preference group is required.');
  const appearance = body.appearance === undefined ? null : normalizePreferenceGroup(body.appearance, APPEARANCE_KEYS, 'appearance');
  const accessibility = body.accessibility === undefined ? null : normalizePreferenceGroup(body.accessibility, ACCESSIBILITY_KEYS, 'accessibility', { nullable: ['reduceMotion'] });
  return withMongoTransaction(async (session) => {
    const user = await loadCurrentUser(userId, session);
    const fields = { accountPreferencesInitialized: true };
    for (const [key, value] of Object.entries(appearance || {})) fields[`appearancePreferences.${key}`] = value;
    for (const [key, value] of Object.entries(accessibility || {})) fields[`accessibilityPreferences.${key}`] = value;
    const filter = { _id: user._id, identityKind: 'account', accountStatus: 'active' };
    const updated = await User.findOneAndUpdate(filter, { $set: fields }, { new: true, runValidators: true, session }).select(ACCOUNT_PROJECTION);
    if (!updated) throw new ConflictError('ACCOUNT_SETTINGS_CHANGED', 'Your settings could not be saved. Refresh and try again.');
    return getAccountSettingsWithinSession(userId, session);
  });
}

export async function getManualResetPreview(userId) {
  const user = await loadCurrentUser(userId);
  const run = user.currentProgressionRunId
    ? await ProgressionRun.findOne({ _id: user.currentProgressionRunId, userId: user._id, status: 'active' }).select('_id runNumber currentRankSlug level totalXp taskScheduleId emergencyPause').lean()
    : null;
  if (!run) throw new ConflictError('ACTIVE_PROGRESSION_REQUIRED', 'An active Progression Run is required before it can be restarted.');
  const schedule = run.taskScheduleId
    ? await TaskSchedule.findOne({ _id: run.taskScheduleId, userId: user._id, progressionRunId: run._id, status: 'active' }).select('_id').lean()
    : null;
  const activePause = run.emergencyPause?.pauseId
    ? await EmergencyPause.exists({ _id: run.emergencyPause.pauseId, userId: user._id, progressionRunId: run._id, status: 'active' })
    : await EmergencyPause.exists({ userId: user._id, progressionRunId: run._id, status: 'active' });
  return {
    confirmationPhrase: 'RESET',
    expectedRunNumber: run.runNumber,
    currentProgression: {
      rank: run.currentRankSlug,
      level: run.level,
      totalXp: Number(run.totalXp),
      hasActiveSchedule: Boolean(schedule),
      emergencyPauseActive: Boolean(activePause || run.emergencyPause?.active),
    },
    reset: [
      'The current Progression Run will be ended and a fresh Rank 07 Origin run will begin.',
      'Current Level, XP, Grace Points, Discipline Points, streaks, cooldowns and active schedule state will restart.',
      'Current-run Rank badges, Highest Rank Achieved, Personal Best records and resettable progression achievements will be cleared.',
      'A new Task Schedule must be created before scheduled Tasks resume.',
    ],
    preserved: [
      'Account identity, account creation date and original Member Since date.',
      'Reset Count stays unchanged; only automatic Grace exhaustion reset increments it.',
      'Lifetime Longest Streak, profile details, privacy, appearance, accessibility and notification preferences.',
      'M25 Monthly Analysis summaries and all retained historical records stay attached to the old run.',
    ],
  };
}

function resetConfirmationError() {
  throw new ValidationError('Type RESET exactly to confirm this operation.', [{ field: 'confirmationPhrase', code: 'CONFIRMATION_REQUIRED' }]);
}

export async function manualResetAndRestart({ userId, confirmationPhrase, expectedRunNumber, idempotencyKey, now = new Date() }) {
  if (confirmationPhrase !== 'RESET') resetConfirmationError();
  if (!Number.isInteger(expectedRunNumber) || expectedRunNumber < 1) {
    throw new ValidationError('Refresh the reset preview before confirming.', [{ field: 'expectedRunNumber', code: 'INVALID_PRECONDITION' }]);
  }
  if (typeof idempotencyKey !== 'string' || idempotencyKey.trim().length < 8 || idempotencyKey.trim().length > 160) {
    throw new ValidationError('An Idempotency-Key between 8 and 160 characters is required.', [{ field: 'Idempotency-Key', code: 'INVALID_IDEMPOTENCY_KEY' }]);
  }
  if (!mongoose.isValidObjectId(userId)) throw new ValidationError('The current member identity is invalid.');
  // Keep the stored audit key bounded even when a client sends the maximum
  // supported Idempotency-Key length. Hashing also avoids persisting the raw key.
  const sourceEventKey = `${MANUAL_RESET_PREFIX}${createHash('sha256').update(idempotencyKey.trim()).digest('hex')}`;
  const instant = new Date(now);
  const dateKey = getIstDateKey(instant);
  const monthKey = getIstMonthKey(instant);

  return withMongoTransaction(async (session) => {
    const previousEvent = await ProgressionResetEvent.findOne({ userId, sourceEventKey }).session(session);
    if (previousEvent) {
      const previousRun = await ProgressionRun.findOne({ _id: previousEvent.newRunId, userId }).session(session);
      return {
        resetEventId: String(previousEvent._id),
        progressionRunId: previousRun ? String(previousRun._id) : null,
        runNumber: previousRun?.runNumber ?? null,
        resetCount: (await User.findById(userId).select('resetCount').session(session))?.resetCount ?? null,
        idempotentReplay: true,
      };
    }

    const user = await loadCurrentUser(userId, session);
    const oldRun = user.currentProgressionRunId
      ? await ProgressionRun.findOne({ _id: user.currentProgressionRunId, userId, status: 'active' }).session(session)
      : null;
    if (!oldRun) throw new ConflictError('ACTIVE_PROGRESSION_REQUIRED', 'An active Progression Run is required before it can be restarted.');
    if (oldRun.runNumber !== expectedRunNumber) {
      throw new ConflictError('RESET_PREVIEW_STALE', 'The active progression changed after this preview. Review the reset details again before continuing.');
    }

    await terminateEmergencyPauseForManualResetWithinSession({ userId, run: oldRun, endedAt: instant, session });
    await RecoveryQuest.updateMany({ userId, progressionRunId: oldRun._id, status: 'active' }, {
      $set: { status: 'run-ended', runEndedAt: instant },
    }, { session, runValidators: true });
    oldRun.status = 'ended';
    oldRun.endedAt = instant;
    oldRun.endedOn = dateKey;
    oldRun.endReason = 'manual-reset-and-restart';
    oldRun.emergencyPause.active = false;
    oldRun.emergencyPause.selectedDurationDays = null;
    oldRun.emergencyPause.activatedAt = null;
    oldRun.emergencyPause.resumesAt = null;
    await oldRun.save({ session });

    if (oldRun.taskScheduleId) {
      await TaskSchedule.updateOne({ _id: oldRun.taskScheduleId, userId, progressionRunId: oldRun._id, status: 'active' }, {
        $set: { status: 'archived', effectiveEndDate: dateKey },
      }, { session });
    }

    const latest = await ProgressionRun.findOne({ userId }).sort({ runNumber: -1 }).select('runNumber').session(session);
    const newRun = await createFreshProgressionRunWithinSession({
      userId,
      runNumber: (latest?.runNumber || oldRun.runNumber) + 1,
      startedAt: instant,
      emergencyPauseActivationsUsed: 0,
      session,
    });

    const pauseUsage = await EmergencyPauseMonthlyUsage.findOne({ userId, monthKey }).session(session);
    if (pauseUsage) {
      pauseUsage.progressionRunId = newRun._id;
      pauseUsage.activationsUsed = 0;
      await pauseUsage.save({ session });
    }

    const updatedUser = await User.updateOne({
      _id: userId,
      currentProgressionRunId: oldRun._id,
    }, {
      $set: {
        currentProgressionRunId: newRun._id,
        highestRankAchieved: null,
        personalBestRecords: { overall: {}, discipline: {}, xp: {} },
      },
    }, { session, runValidators: true });
    if (updatedUser.modifiedCount !== 1) throw new ConflictError('PROGRESSION_CHANGED', 'The active progression changed while reset was being processed. Refresh and try again.');

    const [resetEvent] = await ProgressionResetEvent.create([{
      userId,
      previousRunId: oldRun._id,
      newRunId: newRun._id,
      reason: 'manual-reset-and-restart',
      sourceEventKey,
      occurredAt: instant,
      businessDate: dateKey,
    }], { session });

    return {
      resetEventId: String(resetEvent._id),
      progressionRunId: String(newRun._id),
      runNumber: newRun.runNumber,
      currentRank: newRun.currentRankSlug,
      level: newRun.level,
      totalXp: Number(newRun.totalXp),
      gracePoints: newRun.gracePoints,
      disciplinePoints: Number(newRun.disciplinePoints),
      requiresScheduleSetup: !newRun.taskScheduleId,
      resetCount: user.resetCount,
      idempotentReplay: false,
    };
  });
}
