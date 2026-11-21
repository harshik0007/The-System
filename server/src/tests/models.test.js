import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import User from '../models/User.js';
import ProgressionRun from '../models/ProgressionRun.js';
import ProgressionResetEvent from '../models/ProgressionResetEvent.js';
import TaskSchedule from '../models/TaskSchedule.js';
import Task from '../models/Task.js';
import TaskScheduleChange from '../models/TaskScheduleChange.js';
import WeeklyTaskChangeUsage from '../models/WeeklyTaskChangeUsage.js';
import TaskOccurrence from '../models/TaskOccurrence.js';
import { EMERGENCY_PAUSE_ALLOWANCE } from '../config/emergencyPauseConfiguration.js';

test('User defaults preserve independent lifetime records and protect private fields in JSON', () => {
  const user = new User({
    developmentIdentitySelector: 'test-seed',
    identityKind: 'development-seed',
    emailNormalized: 'private@example.test',
    passwordHash: 'must-not-serialize',
  });
  assert.equal(user.resetCount, 0);
  assert.equal(user.lifetimeLongestStreak, 0);
  assert.equal(user.highestRankAchieved, null);
  assert.equal(user.appearancePreferences.theme, 'dark-navy');
  assert.equal(user.validateSync(), undefined);
  const serialized = user.toJSON();
  assert.equal(serialized.resetCount, 0);
  assert.equal(serialized.lifetimeLongestStreak, 0);
  assert.equal('passwordHash' in serialized, false);
  assert.equal('developmentIdentitySelector' in serialized, false);
  assert.equal('emailNormalized' in serialized, false);
});

test('User appearance preference theme accepts only registered theme IDs and defaults existing preference shapes', () => {
  const legacy = new User({ appearancePreferences: { clickRipple: false } });
  const invalid = new User({ appearancePreferences: { theme: 'rank-01' } });
  const valid = new User({ appearancePreferences: { theme: 'obsidian' } });
  const galaxion = new User({ appearancePreferences: { theme: 'galaxion' } });
  const legacyWaterFury = new User({ appearancePreferences: { theme: 'waterfury' } });
  const replacedTheme = new User({ appearancePreferences: { theme: 'nexus-prime' } });
  assert.equal(legacy.appearancePreferences.theme, 'dark-navy');
  assert.equal(legacy.appearancePreferences.clickRipple, false);
  assert.ok(invalid.validateSync());
  assert.equal(valid.validateSync(), undefined);
  assert.equal(galaxion.validateSync(), undefined);
  assert.ok(legacyWaterFury.validateSync());
  assert.ok(replacedTheme.validateSync());
});

test('User rejects negative/fractional counters, invalid Rank and invalid Member Since dates', () => {
  for (const invalid of [
    { resetCount: -1 },
    { resetCount: 1.5 },
    { lifetimeLongestStreak: -1 },
    { lifetimeLongestStreak: 2.2 },
    { highestRankAchieved: 'unknown' },
    { memberSince: '2026-02-30' },
  ]) {
    assert.ok(new User(invalid).validateSync());
  }
});

test('ProgressionRun defaults represent the approved reset baseline without creating business events', () => {
  const run = new ProgressionRun({ userId: new mongoose.Types.ObjectId(), runNumber: 1 });
  assert.equal(run.currentRankSlug, 'origin');
  assert.equal(run.level, 0);
  assert.equal(run.totalXp, 0);
  assert.equal(run.gracePoints, 3);
  assert.equal(run.disciplinePoints, 0);
  assert.equal(run.currentStreak, 0);
  assert.equal(run.longestStreak, 0);
  assert.equal(run.emergencyPause.active, false);
  assert.equal(run.emergencyPause.activationsUsed, 0);
  assert.equal(run.validateSync(), undefined);
  assert.equal(ProgressionRun.schema.path('resetCount'), undefined);
  assert.equal(ProgressionRun.schema.path('lifetimeLongestStreak'), undefined);
});

test('ProgressionRun validates bounds, integers, Rank and IST business dates', () => {
  for (const invalid of [
    { level: -1 },
    { level: 1.5 },
    { totalXp: -1 },
    { gracePoints: -1 },
    { disciplinePoints: 4.1 },
    { currentStreak: -1 },
    { longestStreak: 0.5 },
    { currentRankSlug: 'unknown' },
    { startedOn: '2026-02-30' },
    { emergencyPause: { activationsUsed: EMERGENCY_PAUSE_ALLOWANCE + 1 } },
  ]) {
    assert.ok(new ProgressionRun({ userId: new mongoose.Types.ObjectId(), runNumber: 1, ...invalid }).validateSync());
  }
  assert.equal(new ProgressionRun({ userId: new mongoose.Types.ObjectId(), runNumber: 1, gracePoints: 12 }).validateSync(), undefined,
    'Grace Points do not have a maximum balance.');
});

test('persistence indexes declare one active run and deterministic reset-event idempotency', () => {
  const runIndexes = ProgressionRun.schema.indexes();
  assert.ok(runIndexes.some(([keys, options]) => keys.userId === 1 && options.unique && options.partialFilterExpression?.status === 'active'));
  assert.ok(runIndexes.some(([keys, options]) => keys.userId === 1 && keys.runNumber === 1 && options.unique));

  const eventIndexes = ProgressionResetEvent.schema.indexes();
  assert.ok(eventIndexes.some(([keys, options]) => keys.userId === 1 && keys.sourceEventKey === 1 && options.unique));
});

test('ProgressionResetEvent only accepts approved reset reasons and requires a source key', () => {
  const valid = new ProgressionResetEvent({
    userId: new mongoose.Types.ObjectId(),
    previousRunId: new mongoose.Types.ObjectId(),
    newRunId: new mongoose.Types.ObjectId(),
    reason: 'automatic-grace-exhaustion',
    sourceEventKey: 'grace-exhaustion:2026-11-17',
    resetCountAfter: 1,
    businessDate: '2026-11-17',
  });
  assert.equal(valid.validateSync(), undefined);

  const automaticWithoutCount = new ProgressionResetEvent({
    userId: new mongoose.Types.ObjectId(),
    previousRunId: new mongoose.Types.ObjectId(),
    newRunId: new mongoose.Types.ObjectId(),
    reason: 'automatic-grace-exhaustion',
    sourceEventKey: 'grace-exhaustion:missing-count',
    businessDate: '2026-11-17',
  });
  assert.ok(automaticWithoutCount.validateSync());

  const manual = new ProgressionResetEvent({
    userId: new mongoose.Types.ObjectId(),
    previousRunId: new mongoose.Types.ObjectId(),
    newRunId: new mongoose.Types.ObjectId(),
    reason: 'manual-reset-and-restart',
    sourceEventKey: 'manual-restart:once',
    businessDate: '2026-11-17',
  });
  assert.equal(manual.validateSync(), undefined);

  const invalid = new ProgressionResetEvent({
    userId: new mongoose.Types.ObjectId(),
    previousRunId: new mongoose.Types.ObjectId(),
    newRunId: new mongoose.Types.ObjectId(),
    reason: 'client-requested-reset',
    resetCountAfter: -1,
    businessDate: '17-11-2026',
  });
  assert.ok(invalid.validateSync());
});

test('Task domain models validate required schedule, Task, snapshot and allowance fields', () => {
  const userId = new mongoose.Types.ObjectId();
  const progressionRunId = new mongoose.Types.ObjectId();
  const taskScheduleId = new mongoose.Types.ObjectId();
  const taskId = new mongoose.Types.ObjectId();
  const schedule = new TaskSchedule({ userId, progressionRunId, cycleLength: 3, cycleAnchorDate: '2026-11-18', effectiveStartDate: '2026-11-18', idempotencyKey: 'schedule-initial-01' });
  const task = new Task({ userId, progressionRunId, taskScheduleId, title: 'Read', cycleDays: [1, 3], accountabilityAction: { title: 'Review', description: 'Review the reading.' }, effectiveDate: '2026-11-18' });
  const allowance = new WeeklyTaskChangeUsage({ userId, progressionRunId, weekStartDate: '2026-11-16' });
  const occurrence = new TaskOccurrence({ userId, progressionRunId, taskScheduleId, taskId, occurrenceDate: '2026-11-18', cycleDay: 1, snapshot: { title: 'Read', description: '', accountabilityAction: { title: 'Review', description: 'Review the reading.' }, revision: 1 } });
  assert.equal(schedule.validateSync(), undefined);
  assert.equal(task.validateSync(), undefined);
  assert.equal(allowance.validateSync(), undefined);
  assert.equal(occurrence.validateSync(), undefined);
  assert.ok(new WeeklyTaskChangeUsage({ userId, progressionRunId, weekStartDate: '2026-11-16', usedCount: 4 }).validateSync());
  assert.ok(new Task({ userId, progressionRunId, taskScheduleId, title: 'Bad', cycleDays: [1, 1], accountabilityAction: { title: 'Act', description: 'Do it.' }, effectiveDate: '2026-11-18' }).validateSync());
});

test('Task persistence indexes enforce per-run schedule, occurrence and weekly allowance uniqueness', () => {
  const hasUniqueIndex = (model, expectedKeys) => model.schema.indexes().some(([keys, options]) => options.unique && JSON.stringify(keys) === JSON.stringify(expectedKeys));
  assert.ok(TaskSchedule.schema.indexes().some(([keys, options]) => keys.progressionRunId === 1 && options.unique && options.partialFilterExpression?.status === 'active'));
  assert.ok(hasUniqueIndex(TaskOccurrence, { userId: 1, progressionRunId: 1, taskId: 1, occurrenceDate: 1 }));
  assert.ok(TaskOccurrence.schema.indexes().some(([keys, options]) => keys.completionIdempotencyKey === 1 && options.unique && options.partialFilterExpression?.completionIdempotencyKey?.$type === 'string'));
  assert.ok(hasUniqueIndex(WeeklyTaskChangeUsage, { userId: 1, progressionRunId: 1, weekStartDate: 1 }));
  assert.ok(hasUniqueIndex(TaskScheduleChange, { userId: 1, idempotencyKey: 1 }));
});

test('TaskOccurrence stores optional completion details and server completion time', () => {
  const occurrence = new TaskOccurrence({
    userId: new mongoose.Types.ObjectId(),
    progressionRunId: new mongoose.Types.ObjectId(),
    taskScheduleId: new mongoose.Types.ObjectId(),
    taskId: new mongoose.Types.ObjectId(),
    occurrenceDate: '2026-11-18',
    cycleDay: 1,
    snapshot: { title: 'Read', accountabilityAction: { title: 'Review', description: 'Review the reading.' }, revision: 1 },
    status: 'completed',
    completedAt: new Date('2026-11-18T08:00:00Z'),
    submission: { note: '', fileName: '' },
    completionIdempotencyKey: 'complete-task-key-01',
  });
  assert.equal(occurrence.validateSync(), undefined);
  assert.equal(TaskOccurrence.schema.path('completedAt').instance, 'Date');
});

test('TaskScheduleChange records reschedules as immutable eligible modifications', () => {
  const change = new TaskScheduleChange({
    userId: new mongoose.Types.ObjectId(),
    progressionRunId: new mongoose.Types.ObjectId(),
    taskScheduleId: new mongoose.Types.ObjectId(),
    taskId: new mongoose.Types.ObjectId(),
    changeType: 'rescheduled',
    beforeSnapshot: { title: 'Read', description: '', cycleDays: [1], accountabilityAction: { title: 'Review', description: 'Review it.' }, revision: 1, status: 'active' },
    afterSnapshot: { title: 'Read', description: '', cycleDays: [2], accountabilityAction: { title: 'Review', description: 'Review it.' }, revision: 2, status: 'active' },
    effectiveDate: '2026-11-19',
    weekStartDate: '2026-11-16',
    scheduleVersion: 2,
    idempotencyKey: 'reschedule-task-key',
  });
  assert.equal(change.validateSync(), undefined);
});
