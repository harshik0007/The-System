import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateDailyTaskXp, buildProgressionXpDto, calculateRecoveryQuestDrainCents, getCumulativeXpThreshold, getDailyXpCapCents, getLevelFromTotalXp, getRankMultiplier, getXpRequirement } from '../services/progressionXpService.js';
import { getRankSlugForLevel, RANK_LEVEL_THRESHOLDS } from '../utils/ranks.js';
import { PROGRESSION_CONFIGURATION, PROGRESSION_RANKS } from '../config/progressionConfiguration.js';
import { getInitialProgressionState } from '../services/progressionRunFactory.js';

test('XP requirement curve matches approved examples and remains cent-precise', () => {
  assert.deepEqual([0, 10, 20, 50, 100].map(getXpRequirement), [100, 163, 266, 1147, 13151]);
  assert.deepEqual([0, 10, 20, 50, 100].map((level) => calculateRecoveryQuestDrainCents(level, 1)), [700, 1141, 1862, 8029, 92057]);
  assert.equal(calculateRecoveryQuestDrainCents(10, 3), 3423);
  assert.equal(calculateRecoveryQuestDrainCents(10, 5), 5705);
  assert.equal(calculateRecoveryQuestDrainCents(10, 0), 0);
});

test('XP totals map to exact Level thresholds without negative Level or XP', () => {
  for (const level of [0, 1, 9, 10, 20, 35, 50, 75, 100, 101, 130]) {
    const boundary = getCumulativeXpThreshold(level);
    assert.equal(getLevelFromTotalXp(boundary), level);
    if (level > 0) assert.equal(getLevelFromTotalXp(boundary - 0.01), level - 1);
  }
  assert.equal(getLevelFromTotalXp(-120), 0);
});

test('approved Rank gates promote and demote automatically with no Level cap', () => {
  assert.deepEqual(RANK_LEVEL_THRESHOLDS, {
    origin: 0,
    ember: 10,
    surge: 20,
    vector: 35,
    apex: 50,
    zenith: 75,
    continuum: 100,
  });
  assert.deepEqual([0, 9, 10, 19, 20, 34, 35, 49, 50, 74, 75, 99, 100, 120].map(getRankSlugForLevel), [
    'origin', 'origin', 'ember', 'ember', 'surge', 'surge', 'vector', 'vector', 'apex', 'apex', 'zenith', 'zenith', 'continuum', 'continuum',
  ]);
});

test('a new Progression Run always starts at Rank 07 Origin with zero Level and XP', () => {
  const initial = getInitialProgressionState();
  assert.deepEqual(initial, { currentRankSlug: 'origin', level: 0, totalXp: 0 });
  assert.equal(getLevelFromTotalXp(initial.totalXp), initial.level);
  assert.equal(getRankSlugForLevel(initial.level), initial.currentRankSlug);
});

test('authoritative Rank multipliers, caps and entry rewards match the approved configuration', () => {
  assert.deepEqual(PROGRESSION_RANKS.map(({ slug }) => [slug, getRankMultiplier(slug), getDailyXpCapCents(slug)]), [
    ['origin', 1, 30_000], ['ember', 1.1, 40_000], ['surge', 1.2, 50_000], ['vector', 1.3, 60_000],
    ['apex', 1.4, 70_000], ['zenith', 1.5, 90_000], ['continuum', 1.6, 110_000],
  ]);
  assert.deepEqual(PROGRESSION_RANKS.map(({ entryXpCents }) => entryXpCents), [0, 164_240, 458_720, 952_880, 4_379_360, 14_828_000, null]);
  assert.deepEqual(PROGRESSION_RANKS.map(({ entryDpCents }) => entryDpCents), [0, 10, 20, 30, 40, 55, 75]);
  assert.equal(PROGRESSION_CONFIGURATION.version, 'm22-v1');
});

test('integer-cent Task allocation is deterministic and exactly exhausts the 300 XP base pool', () => {
  for (const count of [7, 8, 9, 10, 12, 15]) {
    const occurrences = Array.from({ length: count }, (_, index) => ({
      _id: `occ-${String(index).padStart(2, '0')}`,
      taskId: `task-${String(index).padStart(2, '0')}`,
      cycleDay: 1,
      status: 'scheduled',
    })).reverse();
    const allocated = allocateDailyTaskXp(occurrences);
    assert.equal(allocated.scheduledOccurrenceCount, count);
    assert.equal(allocated.totalBaseXpCents, 30_000);
    assert.equal(allocated.allocations.reduce((sum, item) => sum + item.baseXpCents, 0), 30_000);
    assert.deepEqual(allocated.allocations.map((item) => item.occurrenceId), [...allocated.allocations.map((item) => item.occurrenceId)].sort());
    assert.equal(allocated.allocations.filter((item) => item.baseXpCents > Math.floor(30_000 / count)).length, 30_000 % count);
  }
});

test('allocation excludes cancelled occurrences, rejects duplicate records, and requires an original occurrence', () => {
  const occurrences = [
    { _id: 'a', taskId: 'task-a', status: 'scheduled', cycleDay: 1 },
    { _id: 'b', taskId: 'task-b', status: 'cancelled', cycleDay: 1 },
    { _id: 'c', taskId: 'task-c', status: 'completed', cycleDay: 1 },
  ];
  const allocation = allocateDailyTaskXp(occurrences);
  assert.equal(allocation.scheduledOccurrenceCount, 2);
  assert.equal(allocation.totalBaseXpCents, 30_000);
  assert.equal(allocation.allocations.some((item) => item.occurrenceId === 'b'), false);
  assert.throws(() => allocateDailyTaskXp([occurrences[0], occurrences[0]]), /Duplicate Task occurrence/);
  assert.throws(() => allocateDailyTaskXp([]), /at least one original scheduled occurrence/);
});

test('progression summary keeps the saved day-start cap through a midday Rank change', () => {
  const totalXp = getCumulativeXpThreshold(10);
  const dto = buildProgressionXpDto({
    run: { totalXp, level: 10 },
    dailyRecord: { rankAtDayStart: 'origin', capAmountCents: 30_000, ordinaryXpCreditedCents: 12_345 },
    date: '2026-11-19',
  });
  assert.equal(dto.currentLevel, 10);
  assert.equal(dto.currentRank.slug, 'ember');
  assert.equal(dto.currentRank.multiplierLabel, '1.10×');
  assert.equal(dto.dailyXp.rankAtDayStart, 'origin');
  assert.equal(dto.dailyXp.capAmount, '300.00');
  assert.equal(dto.dailyXp.credited, '123.45');
  assert.equal(dto.dailyXp.remaining, '176.55');
  assert.equal(dto.nextRank.slug, 'surge');
});

test('Continuum summary keeps Level progression open and does not invent a following Rank', () => {
  const dto = buildProgressionXpDto({ run: { totalXp: getCumulativeXpThreshold(125) + 2.5 }, date: '2026-11-19' });
  assert.equal(dto.currentLevel, 125);
  assert.equal(dto.currentRank.slug, 'continuum');
  assert.equal(dto.nextRank, null);
  assert.equal(dto.highestDefinedRankReached, true);
});
