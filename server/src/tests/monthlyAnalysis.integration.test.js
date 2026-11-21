import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import mongoose from 'mongoose';
import { config } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import User from '../models/User.js';
import ProgressionRun from '../models/ProgressionRun.js';
import TaskOccurrence from '../models/TaskOccurrence.js';
import DailyDisciplineRecord from '../models/DailyDisciplineRecord.js';
import XpTransaction from '../models/XpTransaction.js';
import RecoveryQuest from '../models/RecoveryQuest.js';
import GracePointTransaction from '../models/GracePointTransaction.js';
import DisciplinePointTransaction from '../models/DisciplinePointTransaction.js';
import EmergencyPause from '../models/EmergencyPause.js';
import RecoveryQuestDailyReset from '../models/RecoveryQuestDailyReset.js';
import MonthlyAnalysisSummary from '../models/MonthlyAnalysisSummary.js';
import MonthlyAnalysisReminder from '../models/MonthlyAnalysisReminder.js';
import MonthlyAnalysisWorkerCheckpoint from '../models/MonthlyAnalysisWorkerCheckpoint.js';
import Notification from '../models/Notification.js';
import { getIstMidnightInstant } from '../utils/ist.js';
import { compareMonthlySummaries, getMonthlyDetails, getMonthlyReminders, getMonthlySummary, runMonthlyAnalysisForRun } from '../services/monthlyAnalysisService.js';
import { downloadPdf } from '../controllers/monthlyAnalysisController.js';

const shouldRun = process.env.RUN_MONGO_INTEGRATION === '1';
const objectId = () => new mongoose.Types.ObjectId();

test('M25 MongoDB monthly summaries, comparison, retention and PDF are scoped and idempotent', { skip: !shouldRun }, async (t) => {
  const isolatedUri = new URL(config.mongoUri);
  isolatedUri.pathname = `/the_system_m25_${process.pid}_${Date.now()}`;
  await connectDatabase(isolatedUri.toString());
  assert.equal(mongoose.connection.readyState, 1, 'MongoDB must be connected to a replica set');
  t.after(async () => {
    try { await mongoose.connection.dropDatabase(); } finally { await disconnectDatabase(); }
  });
  const now = new Date('2026-11-19T12:00:00.000Z');
  const user = await User.create({ identityKind: 'account', accountStatus: 'active', memberSince: '2026-09-01' });
  const run = await ProgressionRun.create({
    userId: user._id,
    runNumber: 2,
    status: 'active',
    startedAt: getIstMidnightInstant('2026-09-01'),
    startedOn: '2026-09-01',
    currentRankSlug: 'ember',
    level: 10,
    totalXp: 123.45,
    gracePoints: 2,
    disciplinePoints: 0.25,
    currentStreak: 1,
    longestStreak: 3,
    disciplineStartedOn: '2026-09-01',
  });
  user.currentProgressionRunId = run._id;
  await user.save();
  const priorRun = await ProgressionRun.create({
    userId: user._id, runNumber: 1, status: 'ended',
    startedAt: getIstMidnightInstant('2025-01-01'), startedOn: '2025-01-01',
    endedAt: getIstMidnightInstant('2025-12-01'), endedOn: '2025-11-30',
    currentRankSlug: 'origin', level: 0, totalXp: 0, gracePoints: 0, disciplinePoints: 0,
    currentStreak: 0, longestStreak: 0,
  });
  const outsider = await User.create({ identityKind: 'account', accountStatus: 'active', memberSince: '2026-10-01' });
  const outsiderRun = await ProgressionRun.create({ userId: outsider._id, runNumber: 1, startedAt: getIstMidnightInstant('2026-10-01'), startedOn: '2026-10-01', disciplineStartedOn: '2026-10-01' });
  outsider.currentProgressionRunId = outsiderRun._id;
  await outsider.save();

  const tasks = Array.from({ length: 21 }, () => objectId());
  const scheduleId = objectId();
  const occurrenceDocs = [];
  for (const [date, statuses] of [
    ['2026-09-10', ['completed', 'completed', 'missed']],
    ['2026-10-01', ['completed', 'completed', 'completed', 'completed', 'completed', 'missed', 'missed']],
    ['2026-11-01', ['scheduled', 'scheduled']],
  ]) {
    statuses.forEach((status, index) => occurrenceDocs.push({
      userId: user._id, progressionRunId: run._id, taskId: tasks[occurrenceDocs.length], taskScheduleId: scheduleId,
      occurrenceDate: date, cycleDay: 1,
      snapshot: { title: `Snapshot ${date} ${index}`, description: 'Original scheduled work', accountabilityAction: { title: 'Specific Action', description: 'Saved action copy', weakness: 'Avoidance' }, revision: 1 },
      status, ...(status === 'completed' ? { completedAt: new Date(`${date}T12:00:00.000Z`) } : {}),
    }));
  }
  await TaskOccurrence.insertMany(occurrenceDocs);
  await DailyDisciplineRecord.create({
    userId: user._id, progressionRunId: run._id, date: '2026-10-01', scheduledOriginalTaskCount: 7, completedOriginalTaskCount: 5,
    qualificationStatus: 'qualified', protectedByEmergencyPause: false, finalizedAt: new Date('2026-10-02T00:00:00Z'),
    currentStreakBefore: 0, currentStreakAfter: 1, runLongestStreakAfter: 1, lifetimeLongestStreakAfter: 1,
    sourceEventKey: 'm25-qualification-oct01', sourceOccurrenceIds: [],
  });
  await DailyDisciplineRecord.create({
    userId: user._id, progressionRunId: run._id, date: '2026-10-31', scheduledOriginalTaskCount: 0, completedOriginalTaskCount: 0,
    qualificationStatus: 'emergency-pause-protected', protectedByEmergencyPause: true, finalizedAt: new Date('2026-11-01T00:00:00Z'),
    currentStreakBefore: 1, currentStreakAfter: 1, runLongestStreakAfter: 1, lifetimeLongestStreakAfter: 1,
    sourceEventKey: 'm25-pause-oct31', sourceOccurrenceIds: [],
  });

  const xp = (businessDate, amount, type, rankBefore, rankAfter, source) => ({
    userId: user._id, progressionRunId: run._id, amount: mongoose.Types.Decimal128.fromString(amount), type,
    sourceType: type === 'recovery-quest-drain' ? 'recovery-quest' : 'rank-entry', sourceEntityId: objectId(), sourceEventKey: source,
    balanceBefore: mongoose.Types.Decimal128.fromString('10.00'), balanceAfter: mongoose.Types.Decimal128.fromString(String((10 + Number(amount)).toFixed(2))),
    levelBefore: 10, resultingLevel: 10, currentRankBefore: rankBefore, currentRankAfter: rankAfter, levelRequirement: 100,
    activeQuestCount: type === 'recovery-quest-drain' ? 1 : 0, occurredAt: new Date(`${businessDate}T19:00:00.000Z`), businessDate,
  });
  await XpTransaction.insertMany([
    xp('2026-10-10', '2.00', 'rank-entry', 'origin', 'ember', 'm25-xp-promotion'),
    // The daily reset transaction is recorded after midnight, but its immutable business date remains October 31 IST.
    xp('2026-10-31', '-1.25', 'recovery-quest-drain', 'ember', 'ember', 'm25-xp-drain'),
  ]);

  const sourceOccurrenceId = objectId();
  await RecoveryQuest.insertMany([
    { userId: user._id, progressionRunId: run._id, sourceTaskId: tasks[0], sourceOccurrenceId, sourceEventKey: 'm25-quest-completed', sourceSnapshot: { taskTitle: 'Quest task', accountabilityActionTitle: 'Act', accountabilityActionDescription: 'Do act', taskRevision: 1 }, activatedAt: new Date('2026-09-28T12:00:00Z'), baseExpiresAt: new Date('2026-10-03T12:00:00Z'), expiresAt: new Date('2026-10-03T12:00:00Z'), status: 'completed', completedAt: new Date('2026-10-02T12:00:00Z') },
    { userId: user._id, progressionRunId: run._id, sourceTaskId: tasks[1], sourceOccurrenceId: objectId(), sourceEventKey: 'm25-quest-expired', sourceSnapshot: { taskTitle: 'Quest task 2', accountabilityActionTitle: 'Act', accountabilityActionDescription: 'Do act', taskRevision: 1 }, activatedAt: new Date('2026-10-20T12:00:00Z'), baseExpiresAt: new Date('2026-10-21T12:00:00Z'), expiresAt: new Date('2026-10-21T12:00:00Z'), status: 'expired', expiredAt: new Date('2026-10-21T12:00:00Z') },
  ]);
  await GracePointTransaction.create({ userId: user._id, progressionRunId: run._id, delta: -1, type: 'recovery-quest-expiry', sourceEntity: 'recovery-quest', sourceId: objectId(), sourceEventKey: 'm25-gp-expiry', balanceBefore: 3, balanceAfter: 2, occurredAt: new Date('2026-10-21T12:00:00Z') });
  await DisciplinePointTransaction.create({ userId: user._id, progressionRunId: run._id, deltaCents: 25, type: 'recurring-discipline-cycle', sourceEntity: 'discipline-cycle', sourceId: objectId(), sourceEventKey: 'm25-dp-award', balanceBeforeCents: 0, balanceAfterCents: 25, businessDate: '2026-10-15', occurredAt: new Date('2026-10-15T12:00:00Z') });
  await EmergencyPause.create({ userId: user._id, progressionRunId: run._id, activationMonthKey: '2026-10', idempotencyKey: 'm25-pause', durationDays: 1, startedAt: new Date('2026-10-31T17:30:00Z'), selectedEndAt: new Date('2026-10-31T18:30:00Z'), effectiveEndAt: new Date('2026-10-31T18:30:00Z'), scheduledEndReason: 'selected-duration', actualEndAt: new Date('2026-10-31T18:30:00Z'), endReason: 'selected-duration', status: 'ended' });
  await RecoveryQuestDailyReset.create({ userId: user._id, progressionRunId: run._id, date: '2026-10-31', status: 'skipped-emergency-pause', protectedTaskDate: true, activeQuestCount: 0, processedAt: new Date('2026-11-01T00:00:00Z') });

  // Controller identity values are strings; aggregate pipelines do not cast
  // them to ObjectId like Mongoose find queries do.
  const oct = await getMonthlySummary(String(user._id), '2026-10', { now });
  assert.equal(oct.metrics.tasks.scheduled, 7);
  assert.equal(oct.metrics.tasks.completed, 5);
  assert.equal(oct.metrics.tasks.missed, 2);
  assert.equal(oct.metrics.discipline.qualifyingDays, 1);
  assert.equal(oct.metrics.xp.earned, 2);
  assert.equal(oct.metrics.xp.drained, 1.25);
  assert.equal(oct.metrics.xp.rankTransitions.length, 1);
  assert.equal(oct.metrics.recovery.completed, 1);
  assert.equal(oct.metrics.recovery.expired, 1);
  assert.equal(oct.metrics.gracePoints.expiryDeductions, 1);
  assert.equal(oct.metrics.disciplinePoints.recurringAwarded, 0.25);
  assert.equal(oct.metrics.emergencyPause.activations, 1);
  assert.deepEqual(oct.metrics.emergencyPause.protectedDates, ['2026-10-31']);

  const november = await getMonthlySummary(String(user._id), '2026-11', { now });
  assert.equal(november.metrics.tasks.scheduled, 2);
  assert.equal(november.metrics.daily.find((day) => day.date === '2026-11-01')?.tasks?.scheduled, 2);
  const comparison = await compareMonthlySummaries(user._id, '2026-10', '2026-11', { now });
  assert.equal(comparison.metrics.find((item) => item.label === 'Completed Tasks').first, 5);
  await MonthlyAnalysisSummary.create({
    userId: user._id, progressionRunId: priorRun._id, monthKey: '2025-10',
    monthStartAt: getIstMidnightInstant('2025-10-01'), monthEndAt: getIstMidnightInstant('2025-11-01'),
    coveredFrom: '2025-10-01', coveredThrough: '2025-10-31', status: 'finalized', aggregationVersion: 1, hasData: true,
    metrics: { tasks: { scheduled: 11, completed: 9, missed: 2 } }, sourceCounts: {}, createdAt: now, updatedAt: now,
  });
  await assert.rejects(compareMonthlySummaries(user._id, '2026-10', '2025-10', { now }), (error) => error.status === 404,
    'An older report from another ProgressionRun cannot be mixed into a current-run comparison.');
  const dueReminderAt = new Date('2026-11-23T18:30:00.000Z');
  const firstReminderRead = await getMonthlyReminders(user._id, { now: dueReminderAt });
  assert.equal(firstReminderRead.some((item) => item.monthKey === '2026-10' && item.reminder === '7 days' && item.status === 'due'), true);
  const repeatedReminderRead = await getMonthlyReminders(user._id, { now: dueReminderAt });
  assert.equal(repeatedReminderRead.some((item) => item.monthKey === '2026-10' && item.reminder === '7 days' && item.status === 'due'), false);
  const sevenDayNotice = await Notification.findOne({ userId: user._id, category: 'monthly-retention', eventType: 'monthly-history-expiry-168h' }).lean();
  assert.ok(sevenDayNotice, 'the existing M25 7-day reminder is delivered through the notification inbox');
  assert.equal(sevenDayNotice.occurredAt.toISOString(), '2026-11-23T18:30:00.000Z');
  assert.equal(await Notification.countDocuments({ userId: user._id, category: 'monthly-retention' }), 1,
    'repeated reminder delivery creates one notification');
  const due48HourAt = new Date('2026-11-28T18:30:00.000Z');
  await getMonthlyReminders(user._id, { now: due48HourAt });
  const due24HourAt = new Date('2026-11-29T18:30:00.000Z');
  await getMonthlyReminders(user._id, { now: due24HourAt });
  assert.deepEqual((await Notification.find({ userId: user._id, category: 'monthly-retention' }).sort({ occurredAt: 1 }).lean()).map((item) => item.eventType), [
    'monthly-history-expiry-168h', 'monthly-history-expiry-48h', 'monthly-history-expiry-24h',
  ]);
  await getMonthlyReminders(user._id, { now: new Date('2026-11-30T18:30:00.000Z') });
  assert.equal(await Notification.countDocuments({ userId: user._id, category: 'monthly-retention' }), 3,
    'no expiry reminder is delivered at or after the detail expiry');
  const outsiderSummary = await getMonthlySummary(outsider._id, '2026-10', { now });
  assert.equal(outsiderSummary.metrics.tasks.scheduled, null);

  await runMonthlyAnalysisForRun({ run, now, monthsPerRun: 18 });
  const septemberSummary = await getMonthlySummary(user._id, '2026-09', { now });
  assert.equal(septemberSummary.metrics.tasks.completed, 2);
  assert.equal(septemberSummary.detailedHistoryAvailable, false);
  assert.equal(await TaskOccurrence.countDocuments({ userId: user._id, progressionRunId: run._id, occurrenceDate: { $gte: '2026-09-01', $lt: '2026-10-01' } }), 0);
  await assert.rejects(getMonthlyDetails(user._id, '2026-09', { now }), (error) => error.status === 410 && error.code === 'DETAIL_HISTORY_EXPIRED');
  const retainedDetails = await getMonthlyDetails(user._id, '2026-10', { now, limit: 50 });
  assert.equal(retainedDetails.items.length, 7);
  assert.equal(retainedDetails.items[0].title.startsWith('Snapshot 2026-10-01'), true);

  const countBeforeRepeat = await MonthlyAnalysisSummary.countDocuments({ userId: user._id, progressionRunId: run._id });
  await runMonthlyAnalysisForRun({ run, now, monthsPerRun: 18 });
  assert.equal(await MonthlyAnalysisSummary.countDocuments({ userId: user._id, progressionRunId: run._id }), countBeforeRepeat);
  assert.equal(await TaskOccurrence.countDocuments({ userId: user._id, progressionRunId: run._id, occurrenceDate: { $lt: '2026-10-01' } }), 0);

  const pdfArtifactDirectory = process.env.M25_PDF_ARTIFACT_DIR;
  if (pdfArtifactDirectory) await mkdir(pdfArtifactDirectory, { recursive: true });
  const renderPdf = async (monthKey, query = {}, artifactName) => {
    const response = {
      headers: {},
      set(values) { Object.assign(this.headers, values); return this; },
      status(value) { this.statusCode = value; return this; },
      send(value) { this.body = value; return this; },
    };
    await downloadPdf({ user: { id: String(user._id) }, params: { monthKey }, query }, response);
    assert.equal(response.statusCode, 200);
    assert.match(response.headers['Content-Type'], /application\/pdf/);
    assert.equal(response.body.subarray(0, 4).toString(), '%PDF');
    if (pdfArtifactDirectory) await writeFile(`${pdfArtifactDirectory}/${artifactName}`, response.body);
    return response.body;
  };

  const normalPdf = await renderPdf('2026-10', {}, 'normal-monthly-report.pdf');
  const normalPageCount = Number(normalPdf.toString('latin1').match(/\/Type \/Pages\s*\/Count (\d+)/)?.[1]);
  assert.equal(normalPageCount, 1, 'A normal monthly report should fit on one page.');
  const comparisonPdf = await renderPdf('2026-10', { compare: '2026-11' }, 'comparison-report.pdf');
  const comparisonPageCount = Number(comparisonPdf.toString('latin1').match(/\/Type \/Pages\s*\/Count (\d+)/)?.[1]);
  assert.equal(comparisonPageCount, 2, 'The report and explicit comparison should render on exactly two pages without footer overflow.');

  const olderPdf = await renderPdf('2026-09', {}, 'aggregate-only-report.pdf');
  const olderPdfPageCount = Number(olderPdf.toString('latin1').match(/\/Type \/Pages\s*\/Count (\d+)/)?.[1]);
  assert.equal(olderPdfPageCount, 1, 'A report without comparison should render on a single page when its content fits.');
});
