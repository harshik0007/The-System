import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMonthlySummary,
  createHistoryExpiryReminders,
  getDetailedHistoryExpiryDate,
  getIstMonthKey,
  getMonthBounds,
  hasDetailedTaskHistory,
  shiftIstMonth,
} from './monthlyAnalysis.js';

const RUN = 'run-2026-10-01-test';

function makeFixture() {
  const dailyRecords = {
    '2026-10-01': { date: '2026-10-01', progressionRunId: RUN, hasDailyResetRecord: true, scheduledTaskCount: 7, completedTaskCount: 5, qualifies: true, qualificationStatus: 'qualified', levelAfterReset: 0 },
    '2026-10-02': { date: '2026-10-02', progressionRunId: RUN, hasDailyResetRecord: true, scheduledTaskCount: 7, completedTaskCount: 3, qualifies: false, qualificationStatus: 'not-qualified', levelAfterReset: 0 },
    '2026-10-03': { date: '2026-10-03', progressionRunId: RUN, hasDailyResetRecord: true, scheduledTaskCount: 7, completedTaskCount: 0, qualifies: true, emergencyPause: true, qualificationStatus: 'emergency-pause-protected', levelAfterReset: 0 },
  };
  const xpHistory = [
    { id: 'xp-rank-1', date: '2026-10-01', progressionRunId: RUN, kind: 'daily-rank-bonus', amount: 100, totalAfter: 1100 },
    { id: 'xp-drain-1', date: '2026-10-02', progressionRunId: RUN, kind: 'recovery-drain', amount: -70, totalAfter: 1030 },
  ];
  const thresholdQuests = Array.from({ length: 6 }, (_, index) => ({
    id: `threshold-${index + 1}`,
    progressionRunId: RUN,
    activationDate: '2026-10-03',
    status: 'threshold-cleared',
    clearedDate: '2026-10-15',
    occurrenceKey: `task-${index + 1}:3:2026-10-03`,
    originalTaskName: `Task ${index + 1}`,
    originalTaskId: `task-${index + 1}`,
  }));
  const disciplineState = {
    memberSince: '2026-10-01',
    progressionRunId: RUN,
    currentRankSlug: 'origin',
    currentStreak: 1,
    currentRank: 'origin',
    totalXp: 1030,
    dpBalance: 1.5,
    dailyRecords,
    xpHistory,
    xpDrainEvents: [{ id: 'drain-detail-1', date: '2026-10-02', progressionRunId: RUN, amount: 70, questCount: 1 }],
    dpEvents: [{ id: 'dp-recurring-1', date: '2026-10-01', progressionRunId: RUN, kind: 'recurring', title: 'Rank 07 Origin Discipline reward', amount: 0.25, balanceBefore: 1.25, balanceAfter: 1.5 }],
    rankEntryEvents: [],
    dailyRankXpEvents: [{ id: 'rank-xp-1', date: '2026-10-01', progressionRunId: RUN, rankName: 'Origin', amount: 100 }],
    levelDownEvents: [],
    redemptionEvents: [],
    cycle: { progress: 1 },
  };
  const recoveryState = {
    gracePoints: 2,
    quests: [
      { id: 'quest-completed', progressionRunId: RUN, activationDate: '2026-10-01', completedDate: '2026-10-04', status: 'completed', occurrenceKey: 'task-a:1:2026-10-01' },
      { id: 'quest-expired', progressionRunId: RUN, activationDate: '2026-10-02', expiryDate: '2026-10-08', status: 'expired', occurrenceKey: 'task-b:2:2026-10-02' },
      ...thresholdQuests,
    ],
    gracePointEvents: [{ id: 'gp-threshold', date: '2026-10-15', progressionRunId: RUN, kind: 'threshold', questId: 'threshold-6', appliedAmount: 1, balanceBefore: 3, balanceAfter: 2 }],
    activity: [],
  };
  const emergencyPauseState = {
    pauses: [{ id: 'pause-oct-3', activationEventId: 'pause-activation:pause-oct-3', startAt: '2026-10-02T18:30:00.000Z', scheduledResumeAt: '2026-10-03T18:30:00.000Z', actualResumeAt: '2026-10-03T18:30:00.000Z', durationDays: 1, progressionRunId: RUN }],
  };
  const schedule = {
    tasks: [],
    taskHistory: [],
    occurrences: {
      'task-missed:2:2026-10-02': { status: 'missed', progressionRunId: RUN, snapshot: { name: 'Missed task' } },
    },
  };
  const runBaseline = { progressionRunId: RUN, date: '2026-10-01', totalXp: 1000, level: 0, dpBalance: 1.25, gracePoints: 3, rankSlug: 'origin', streak: 0, excluded: {} };
  return { disciplineState, schedule, recoveryState, emergencyPauseState, runBaseline };
}

test('IST month boundaries and detailed-history window use calendar months', () => {
  assert.equal(getIstMonthKey('2026-10-31T18:45:00.000Z'), '2026-11');
  assert.equal(getMonthBounds('2026-10').endDate, '2026-10-31');
  assert.equal(getDetailedHistoryExpiryDate('2026-10'), '2026-12-01');
  assert.equal(shiftIstMonth('2026-01', -1), '2025-12');
  assert.equal(hasDetailedTaskHistory('2026-10', '2026-11-18'), true);
  assert.equal(hasDetailedTaskHistory('2026-09', '2026-11-18'), false);
});

test('monthly aggregation separates finalized task performance, protected dates, XP and Quest outcomes', () => {
  const fixture = makeFixture();
  const summary = buildMonthlySummary({ monthKey: '2026-10', todayKey: '2026-11-18', runStartDate: '2026-10-01', progressionRunId: RUN, ...fixture });

  assert.equal(summary.status, 'finalized');
  assert.equal(summary.taskStats.finalizedScheduled, 14);
  assert.equal(summary.taskStats.finalizedCompleted, 8);
  assert.equal(summary.taskStats.completionRate, 57.14);
  assert.equal(summary.taskStats.missed, 6);
  assert.equal(summary.taskStats.protectedDays, 1);
  assert.equal(summary.taskStats.distribution['5'], 1);
  assert.equal(summary.taskStats.distribution['3'], 1);
  assert.equal(summary.taskStats.missedTaskDetails.length, 1);
  assert.equal(summary.disciplineStats.qualifyingDays, 1);
  assert.equal(summary.disciplineStats.nonQualifyingDays, 1);
  assert.equal(summary.recoveryStats.completed, 1);
  assert.equal(summary.recoveryStats.individuallyExpired, 1);
  assert.equal(summary.recoveryStats.thresholdCleared, 6);
  assert.equal(summary.recoveryStats.xpDrained, 70);
  assert.equal(summary.xpStats.startingXp, 1000);
  assert.equal(summary.xpStats.endingXp, 1030);
  assert.equal(summary.xpStats.earned, 100);
  assert.equal(summary.xpStats.drained, 70);
  assert.equal(summary.timeline.find((day) => day.date === '2026-10-02').xp.recoveryQuestDrain, 70);
  assert.equal(summary.graceStats.thresholdDeductions, 1);
  assert.equal(summary.rankStats.startingRank.name, 'Origin');
  assert.equal(summary.timeline.find((day) => day.date === '2026-10-03').discipline.status, 'protected');
});

test('pause activation events are deduplicated while protected IST dates stay unique', () => {
  const fixture = makeFixture();
  fixture.emergencyPauseState.pauses.push({
    ...fixture.emergencyPauseState.pauses[0],
    id: 'duplicate-pause-record',
  });
  const summary = buildMonthlySummary({ monthKey: '2026-10', todayKey: '2026-11-18', runStartDate: '2026-10-01', progressionRunId: RUN, ...fixture });

  assert.equal(summary.pauseStats.used, 1);
  assert.equal(summary.pauseStats.monthlyUsage, 1);
  assert.equal(summary.pauseStats.totalPauseDays, 1);
  assert.deepEqual(summary.pauseStats.pauseEventIds, ['duplicate-pause-record']);
});

test('a pause crossing an IST month boundary attributes starts and protected dates separately', () => {
  const fixture = makeFixture();
  fixture.emergencyPauseState.pauses = [{
    id: 'pause-boundary',
    activationEventId: 'pause-activation:pause-boundary',
    startAt: '2026-10-31T12:00:00.000Z', // 17:30 IST on October 31
    scheduledResumeAt: '2026-11-02T12:00:00.000Z',
    actualResumeAt: '2026-11-01T18:00:00.000Z', // Early resume at 23:30 IST on November 1
    durationDays: 2,
    status: 'resumed-early',
    resumeReason: 'manual',
  }];

  const october = buildMonthlySummary({ monthKey: '2026-10', todayKey: '2026-11-18', runStartDate: '2026-10-01', progressionRunId: RUN, ...fixture });
  const november = buildMonthlySummary({ monthKey: '2026-11', todayKey: '2026-11-18', runStartDate: '2026-10-01', progressionRunId: RUN, ...fixture });

  assert.equal(october.pauseStats.used, 1);
  assert.equal(october.pauseStats.totalPauseDays, 1);
  assert.equal(november.pauseStats.used, 0);
  assert.equal(november.pauseStats.totalPauseDays, 1);
  assert.equal(november.availability.hasData, true);
  assert.deepEqual(november.pauseStats.pauseEventIds, []);
  assert.deepEqual(november.timeline.filter((day) => day.discipline.protected).map((day) => day.date), ['2026-11-01']);
});

test('unfinalized current-day incomplete tasks remain pending, not missed', () => {
  const progressionRunId = 'run-2026-11-01-current';
  const summary = buildMonthlySummary({
    monthKey: '2026-11', todayKey: '2026-11-18', progressionRunId, runStartDate: '2026-11-01',
    disciplineState: {
      memberSince: '2026-11-01', progressionRunId, currentRankSlug: 'origin', currentStreak: 0,
      totalXp: 0, dpBalance: 1.25, dailyRecords: {}, xpHistory: [], xpDrainEvents: [], dpEvents: [],
      rankEntryEvents: [], dailyRankXpEvents: [], levelDownEvents: [], redemptionEvents: [], cycle: { progress: 0 },
    },
    schedule: { source: 'demo', startDate: '2026-11-01', cycleLength: 7, taskHistory: [], occurrences: {}, tasks: [{ id: 'today-task', status: 'missed', cycleDays: [1, 2, 3, 4, 5, 6, 7] }] },
    recoveryState: { gracePoints: 3, quests: [], gracePointEvents: [], activity: [] },
    emergencyPauseState: { pauses: [] },
    runBaseline: { progressionRunId, date: '2026-11-01', totalXp: 0, level: 0, dpBalance: 1.25, gracePoints: 3, rankSlug: 'origin', streak: 0, excluded: {} },
  });

  assert.equal(summary.status, 'partial');
  assert.equal(summary.taskStats.scheduled, 1);
  assert.equal(summary.taskStats.missed, 0);
  assert.equal(summary.taskStats.pending, 1);
  const today = summary.timeline.find((day) => day.date === '2026-11-18');
  assert.equal(today.task.missed, null);
  assert.equal(today.task.pending, 1);
  assert.equal(today.discipline.status, 'in-progress');
});

test('expiry notices are generated only on the exact due date and only once', () => {
  const summary = {
    id: 'run:2026-09', progressionRunId: 'run', monthKey: '2026-09', monthLabel: 'September 2026', status: 'finalized',
    detailedHistoryExpiresAt: '2026-11-01', availability: { hasData: true, detailedTaskHistory: true },
  };
  const sevenDays = createHistoryExpiryReminders([summary], [], '2026-10-25');
  assert.equal(sevenDays.length, 1);
  assert.equal(sevenDays[0].timing, '7d');
  assert.equal(createHistoryExpiryReminders([summary], sevenDays, '2026-10-25').length, 1);
  assert.equal(createHistoryExpiryReminders([summary], sevenDays, '2026-10-30').length, 2);
  assert.equal(createHistoryExpiryReminders([summary], [], '2026-10-31')[0].timing, '24h');
  assert.equal(createHistoryExpiryReminders([summary], [], '2026-11-02').length, 0);
});
