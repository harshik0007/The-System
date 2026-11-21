import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import DailyXpRecord from '../models/DailyXpRecord.js';
import DailyTaskXpAllocation from '../models/DailyTaskXpAllocation.js';
import DisciplinePointTransaction from '../models/DisciplinePointTransaction.js';
import DailyDisciplineRecord from '../models/DailyDisciplineRecord.js';
import DisciplineRewardCycle from '../models/DisciplineRewardCycle.js';
import RankEntryEvent from '../models/RankEntryEvent.js';
import XpTransaction from '../models/XpTransaction.js';

test('M22 progression ledgers validate their immutable date/run/Rank snapshots', () => {
  const userId = new mongoose.Types.ObjectId();
  const runId = new mongoose.Types.ObjectId();
  const taskId = new mongoose.Types.ObjectId();
  const occurrenceId = new mongoose.Types.ObjectId();
  const xpId = new mongoose.Types.ObjectId();
  const daily = new DailyXpRecord({ userId, date: '2026-11-19', rankAtDayStart: 'origin', capAmountCents: 30_000, configurationVersion: 'm22-v1', createdAt: new Date(), updatedAt: new Date() });
  const allocation = new DailyTaskXpAllocation({
    userId,
    progressionRunId: runId,
    date: '2026-11-19',
    totalBaseXpCents: 30_000,
    scheduledOccurrenceCount: 1,
    allocations: [{ occurrenceId, taskId, baseXpCents: 30_000 }],
    configurationVersion: 'm22-v1',
    createdAt: new Date(),
  });
  const rankEntry = new RankEntryEvent({
    userId,
    progressionRunId: runId,
    rankSlug: 'ember',
    sourceEventKey: `rank-entry:${runId}:ember`,
    sourceXpTransactionId: xpId,
    xpRewardConfigured: true,
    configuredXpRewardCents: 164_240,
    creditedXpRewardCents: 164_240,
    configuredDpRewardCents: 10,
    creditedDpRewardCents: 10,
    occurredAt: new Date(),
    businessDate: '2026-11-19',
    configurationVersion: 'm22-v1',
  });
  const reviewRankEntry = new RankEntryEvent({
    userId,
    progressionRunId: runId,
    rankSlug: 'continuum',
    sourceEventKey: `review-mode:rank-entry:${runId}:continuum`,
    sourceXpTransactionId: null,
    xpRewardConfigured: false,
    configuredXpRewardCents: 0,
    creditedXpRewardCents: 0,
    configuredDpRewardCents: 75,
    creditedDpRewardCents: 75,
    occurredAt: new Date(),
    businessDate: '2026-11-19',
    configurationVersion: 'm22-v1',
  });
  const xpTransaction = new XpTransaction({
    userId,
    progressionRunId: runId,
    amount: mongoose.Types.Decimal128.fromString('30.00'),
    type: 'task-completion',
    sourceType: 'task-occurrence',
    sourceEntityId: occurrenceId,
    sourceEventKey: `task-completion:${occurrenceId}`,
    balanceBefore: mongoose.Types.Decimal128.fromString('0.00'),
    balanceAfter: mongoose.Types.Decimal128.fromString('30.00'),
    levelBefore: 0,
    resultingLevel: 0,
    currentRankBefore: 'origin',
    currentRankAfter: 'origin',
    levelRequirement: 100,
    activeQuestCount: 0,
    occurredAt: new Date(),
    businessDate: '2026-11-19',
  });
  const dpTransaction = new DisciplinePointTransaction({
    userId,
    progressionRunId: runId,
    deltaCents: 10,
    type: 'rank-entry',
    sourceEntity: 'rank-entry',
    sourceId: new mongoose.Types.ObjectId(),
    sourceEventKey: `rank-entry-dp:${runId}:ember`,
    balanceBeforeCents: 0,
    balanceAfterCents: 10,
    occurredAt: new Date(),
  });
  for (const model of [daily, allocation, rankEntry, reviewRankEntry, xpTransaction, dpTransaction]) assert.equal(model.validateSync(), undefined, model.constructor.modelName);
  assert.ok(new RankEntryEvent({ ...rankEntry.toObject(), sourceXpTransactionId: null }).validateSync(), 'ordinary Rank entries must retain their source XP transaction');
  assert.ok(new DailyXpRecord({ userId, date: 'not-an-IST-date', rankAtDayStart: 'origin', capAmountCents: 30_000, configurationVersion: 'm22-v1', createdAt: new Date(), updatedAt: new Date() }).validateSync());
  assert.ok(new XpTransaction({ ...xpTransaction.toObject(), type: 'unapproved-bonus' }).validateSync());
});

test('progression persistence has unique day, allocation and once-per-run Rank reward indexes', () => {
  const uniqueKeys = (model) => model.schema.indexes().filter(([, options]) => options.unique).map(([keys]) => keys);
  assert.ok(uniqueKeys(DailyXpRecord).some((keys) => keys.userId === 1 && keys.date === 1));
  assert.ok(uniqueKeys(DailyTaskXpAllocation).some((keys) => keys.userId === 1 && keys.progressionRunId === 1 && keys.date === 1));
  assert.ok(uniqueKeys(RankEntryEvent).some((keys) => keys.userId === 1 && keys.progressionRunId === 1 && keys.rankSlug === 1));
  assert.ok(uniqueKeys(XpTransaction).some((keys) => keys.userId === 1 && keys.progressionRunId === 1 && keys.sourceEventKey === 1));
  assert.ok(uniqueKeys(DisciplinePointTransaction).some((keys) => keys.userId === 1 && keys.sourceEventKey === 1));
});

test('M23 Discipline records, recurring cycles and DP transactions enforce scoped immutable history', () => {
  const userId = new mongoose.Types.ObjectId();
  const runId = new mongoose.Types.ObjectId();
  const record = new DailyDisciplineRecord({
    userId,
    progressionRunId: runId,
    date: '2026-11-19',
    scheduledOriginalTaskCount: 7,
    completedOriginalTaskCount: 5,
    qualificationStatus: 'qualified',
    protectedByEmergencyPause: false,
    finalizedAt: new Date(),
    currentStreakBefore: 2,
    currentStreakAfter: 3,
    runLongestStreakAfter: 3,
    lifetimeLongestStreakAfter: 5,
    sourceEventKey: `discipline-day:${runId}:2026-11-19`,
  });
  const cycle = new DisciplineRewardCycle({
    userId,
    progressionRunId: runId,
    cycleNumber: 1,
    rankSlug: 'origin',
    rankNumber: '07',
    rankName: 'Origin',
    requiredQualifyingDays: 30,
    completedQualifyingDays: 0,
    rewardAmountCents: 25,
    startDate: '2026-11-19',
    status: 'active',
    configurationVersion: 'm22-v1',
  });
  const transaction = new DisciplinePointTransaction({
    userId,
    progressionRunId: runId,
    deltaCents: 25,
    calculatedDeltaCents: 25,
    type: 'recurring-discipline-cycle',
    sourceEntity: 'discipline-cycle',
    sourceId: new mongoose.Types.ObjectId(),
    sourceEventKey: `discipline-cycle:${runId}:1`,
    balanceBeforeCents: 0,
    balanceAfterCents: 25,
    businessDate: '2026-11-19',
    occurredAt: new Date(),
  });
  for (const model of [record, cycle, transaction]) assert.equal(model.validateSync(), undefined, model.constructor.modelName);
  assert.ok(new DailyDisciplineRecord({ ...record.toObject(), completedOriginalTaskCount: 8 }).validateSync());
  assert.ok(new DisciplineRewardCycle({ ...cycle.toObject(), completedQualifyingDays: 31 }).validateSync());
  assert.ok(new DisciplinePointTransaction({ ...transaction.toObject(), deltaCents: 0.5 }).validateSync());

  const uniqueKeys = (model) => model.schema.indexes().filter(([, options]) => options.unique).map(([keys]) => keys);
  assert.ok(uniqueKeys(DailyDisciplineRecord).some((keys) => keys.userId === 1 && keys.progressionRunId === 1 && keys.date === 1));
  assert.ok(uniqueKeys(DisciplineRewardCycle).some((keys) => keys.userId === 1 && keys.progressionRunId === 1 && keys.cycleNumber === 1));
  assert.ok(uniqueKeys(DisciplinePointTransaction).some((keys) => keys.userId === 1 && keys.sourceEventKey === 1));
});
