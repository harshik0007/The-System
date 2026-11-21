import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateNextPersonalBest, compareExactTieBreakDescending, rankLeaderboardRows } from '../utils/leaderboardRanking.js';

const row = (overrides = {}) => ({
  publicHandle: 'member-a', username: 'member_a', currentRankSlug: 'origin', highestRankAchieved: 'continuum',
  level: 3, totalXp: 1200, totalXpCents: 120000, currentStreak: 4, longestStreak: 7,
  lifetimeLongestStreak: 99, completedOriginalTaskCount: 0, totalRecoveryQuestCount: 0,
  ...overrides,
});

test('overall ranking uses current Rank, Level and current XP in hierarchy order', () => {
  const ordered = rankLeaderboardRows([
    row({ publicHandle: 'origin-level-8', level: 8, totalXp: 7900 }),
    row({ publicHandle: 'ember', currentRankSlug: 'ember', level: 10, totalXp: 9500 }),
    row({ publicHandle: 'surge', currentRankSlug: 'surge', level: 20, totalXp: 18000 }),
    row({ publicHandle: 'vector', currentRankSlug: 'vector', level: 35, totalXp: 30000 }),
    row({ publicHandle: 'apex', currentRankSlug: 'apex', level: 50, totalXp: 40000 }),
    row({ publicHandle: 'zenith', currentRankSlug: 'zenith', level: 75, totalXp: 50000 }),
    row({ publicHandle: 'continuum', currentRankSlug: 'continuum', level: 100, totalXp: 90000 }),
    row({ publicHandle: 'origin-high-xp', level: 4, totalXp: 7200 }),
    row({ publicHandle: 'origin-level-4', level: 4, totalXp: 7000 }),
    row({ publicHandle: 'origin-highest-history', currentRankSlug: 'origin', level: 3, totalXp: 1200, highestRankAchieved: 'continuum' }),
  ], 'overall');
  assert.deepEqual(ordered.map((member) => member.publicHandle), ['continuum', 'zenith', 'apex', 'vector', 'surge', 'ember', 'origin-level-8', 'origin-high-xp', 'origin-level-4', 'origin-highest-history']);
  assert.equal(ordered[1].competitionRank, 2);
});

test('discipline ranking uses current streak then current-run longest streak, not lifetime longest', () => {
  const ordered = rankLeaderboardRows([
    row({ publicHandle: 'lifetime-inflated', currentStreak: 8, longestStreak: 9, lifetimeLongestStreak: 1000 }),
    row({ publicHandle: 'run-longest', currentStreak: 8, longestStreak: 11, lifetimeLongestStreak: 12 }),
    row({ publicHandle: 'current', currentStreak: 9, longestStreak: 9, lifetimeLongestStreak: 9 }),
  ], 'discipline');
  assert.deepEqual(ordered.map((member) => member.publicHandle), ['current', 'run-longest', 'lifetime-inflated']);
});

test('XP ranking uses only current-run total XP and does not infer positive earnings from deductions', () => {
  const ordered = rankLeaderboardRows([
    row({ publicHandle: 'lower', totalXp: 199.99, totalXpCents: 19999, xpTransactions: [{ amount: -500 }], previousRunXp: 999999 }),
    row({ publicHandle: 'higher', totalXp: 200, totalXpCents: 20000, xpTransactions: [{ amount: -2000 }], previousRunXp: 0 }),
  ], 'xp');
  assert.deepEqual(ordered.map((member) => member.publicHandle), ['higher', 'lower']);
});

test('equal XP uses the exact universal tie-breaker', () => {
  const ordered = rankLeaderboardRows([
    row({ publicHandle: 'smaller', totalXpCents: 10000, completedOriginalTaskCount: 2, totalRecoveryQuestCount: 1 }),
    row({ publicHandle: 'larger', totalXpCents: 10000, completedOriginalTaskCount: 3, totalRecoveryQuestCount: 1 }),
  ], 'xp');
  assert.deepEqual(ordered.map((member) => member.publicHandle), ['larger', 'smaller']);
});

test('universal tie-breaker compares exact fractions using integer cross multiplication', () => {
  assert.equal(compareExactTieBreakDescending(row({ completedOriginalTaskCount: 0, totalRecoveryQuestCount: 5 }), row({ completedOriginalTaskCount: 0, totalRecoveryQuestCount: 0 })), 0);
  assert.equal(compareExactTieBreakDescending(row({ completedOriginalTaskCount: 1, totalRecoveryQuestCount: 0 }), row({ completedOriginalTaskCount: 2, totalRecoveryQuestCount: 1 })), 0);
  assert.equal(compareExactTieBreakDescending(row({ completedOriginalTaskCount: 1, totalRecoveryQuestCount: 1 }), row({ completedOriginalTaskCount: 1, totalRecoveryQuestCount: 2 })), -1);
  assert.equal(compareExactTieBreakDescending(row({ completedOriginalTaskCount: '9007199254740993', totalRecoveryQuestCount: '9007199254740991' }), row({ completedOriginalTaskCount: '9007199254740992', totalRecoveryQuestCount: '9007199254740992' })), -1);
});

test('equal primary metrics and exact ratios receive competition ranks', () => {
  const tied = rankLeaderboardRows([
    row({ publicHandle: 'b', level: 3, totalXpCents: 120000, completedOriginalTaskCount: 2, totalRecoveryQuestCount: 1 }),
    row({ publicHandle: 'a', level: 3, totalXpCents: 120000, completedOriginalTaskCount: 1, totalRecoveryQuestCount: 0 }),
    row({ publicHandle: 'c', level: 3, totalXpCents: 120000, completedOriginalTaskCount: 1, totalRecoveryQuestCount: 0 }),
    row({ publicHandle: 'd', level: 3, totalXpCents: 120000, completedOriginalTaskCount: 0, totalRecoveryQuestCount: 0 }),
  ], 'overall');
  assert.deepEqual(tied.map(({ publicHandle, competitionRank }) => [publicHandle, competitionRank]), [['a', 1], ['b', 1], ['c', 1], ['d', 4]]);
});

test('competition ranking patterns and exact tie-break ratios hold in all three categories', () => {
  const make = (category, handle, primary, completed = 1, quests = 0) => row({
    publicHandle: handle,
    username: handle.replace(/-/g, '_'),
    ...(category === 'overall' ? { level: primary } : {}),
    ...(category === 'discipline' ? { currentStreak: primary } : {}),
    ...(category === 'xp' ? { totalXpCents: primary } : {}),
    completedOriginalTaskCount: completed,
    totalRecoveryQuestCount: quests,
  });

  for (const category of ['overall', 'discipline', 'xp']) {
    const cases = [
      {
        name: '1, 1, 3',
        rows: [make(category, 'a', 3), make(category, 'b', 3, 2, 1), make(category, 'c', 2)],
        expected: [1, 1, 3],
      },
      {
        name: '1, 2, 2, 4',
        rows: [make(category, 'a', 4), make(category, 'b', 3, 2, 1), make(category, 'c', 3, 3, 2), make(category, 'd', 2)],
        expected: [1, 2, 2, 4],
      },
      {
        name: '1, 2, 3, 3, 5',
        rows: [make(category, 'a', 5), make(category, 'b', 4), make(category, 'c', 3, 3, 1), make(category, 'd', 3, 6, 3), make(category, 'e', 2)],
        expected: [1, 2, 3, 3, 5],
      },
    ];

    for (const scenario of cases) {
      assert.deepEqual(
        rankLeaderboardRows(scenario.rows, category).map((member) => member.competitionRank),
        scenario.expected,
        `${category} must retain competition positions ${scenario.name}`,
      );
    }

    const distinctRatios = rankLeaderboardRows([
      make(category, 'ratio-one', 10, 2, 0),
      make(category, 'ratio-two', 10, 3, 1),
    ], category);
    assert.deepEqual(distinctRatios.map((member) => member.competitionRank), [1, 2], `${category} must apply the shared tie-breaker after equal primary metrics`);
  }
});

test('personal bests improve independently and retain the date when a later position worsens', () => {
  const first = calculateNextPersonalBest(null, 18, '2026-11-01');
  const better = calculateNextPersonalBest(first, 5, '2026-11-02');
  const worse = calculateNextPersonalBest(better, 9, '2026-11-03');
  const otherCategory = calculateNextPersonalBest(null, 8, '2026-11-04');
  assert.deepEqual(first, { currentPosition: 18, bestPosition: 18, achievedOn: '2026-11-01' });
  assert.deepEqual(better, { currentPosition: 5, bestPosition: 5, achievedOn: '2026-11-02' });
  assert.deepEqual(worse, { currentPosition: 9, bestPosition: 5, achievedOn: '2026-11-02' });
  assert.deepEqual(otherCategory, { currentPosition: 8, bestPosition: 8, achievedOn: '2026-11-04' });
  assert.deepEqual(calculateNextPersonalBest(worse, null, '2026-11-05'), { ...worse, currentPosition: null });
});

test('an empty real-member leaderboard stays empty and does not synthesize podium rows', () => {
  for (const category of ['overall', 'discipline', 'xp']) assert.deepEqual(rankLeaderboardRows([], category), []);
});
