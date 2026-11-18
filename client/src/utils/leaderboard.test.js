import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardDemo } from '../data/dashboardDemo.js';
import { leaderboardDemoMembers } from '../data/leaderboardDemo.js';
import { ranks } from '../data/ranks.js';
import {
  buildLeaderboardResults,
  createCurrentMemberEntry,
  filterLeaderboardMembers,
  LEADERBOARD_POSITION_ACCENTS,
  mergeLeaderboardMembers,
  sortLeaderboardMembers,
} from './leaderboard.js';
import { getLevelFromTotalXp } from './disciplineManager.js';

test('demo leaderboard contains exactly ten stable profiles in the approved Rank distribution', () => {
  assert.equal(leaderboardDemoMembers.length, 10);
  assert.equal(new Set(leaderboardDemoMembers.map((member) => member.id)).size, 10);
  assert.deepEqual(Object.fromEntries(ranks.map((rank) => [rank.slug, leaderboardDemoMembers.filter((member) => member.rankId === rank.slug).length])), {
    origin: 2,
    ember: 2,
    surge: 2,
    vector: 1,
    apex: 1,
    zenith: 1,
    continuum: 1,
  });
  leaderboardDemoMembers.forEach((member) => {
    assert.equal(member.level, getLevelFromTotalXp(member.totalXp));
    assert.equal(member.isDemonstration, true);
  });
});

test('overall ranking uses Rank order, then Level, then XP, then stable ID', () => {
  const members = [
    { id: 'same-rank-low', rankNumber: '05', level: 4, totalXp: 700 },
    { id: 'later-rank', rankNumber: '06', level: 90, totalXp: 99999 },
    { id: 'same-level-more-xp', rankNumber: '05', level: 5, totalXp: 999 },
    { id: 'first-rank', rankNumber: '01', level: 1, totalXp: 1 },
    { id: 'same-level-less-xp', rankNumber: '05', level: 5, totalXp: 800 },
    { id: 'same-tie-z', rankNumber: '05', level: 5, totalXp: 800 },
    { id: 'same-tie-a', rankNumber: '05', level: 5, totalXp: 800 },
  ];
  assert.deepEqual(sortLeaderboardMembers(members).map((member) => member.id), [
    'first-rank', 'same-level-more-xp', 'same-level-less-xp', 'same-tie-a', 'same-tie-z', 'same-rank-low', 'later-rank',
  ]);
});

test('Discipline ranking uses current streak, longest streak, then stable ID only', () => {
  const members = [
    { id: 'xp-lead', currentDisciplineStreak: 12, longestDisciplineStreak: 20, totalXp: 99999 },
    { id: 'longest', currentDisciplineStreak: 12, longestDisciplineStreak: 30, totalXp: 1 },
    { id: 'stable-z', currentDisciplineStreak: 12, longestDisciplineStreak: 30, totalXp: 999 },
    { id: 'stable-a', currentDisciplineStreak: 12, longestDisciplineStreak: 30, totalXp: 20 },
    { id: 'current', currentDisciplineStreak: 13, longestDisciplineStreak: 13, totalXp: 0 },
  ];
  assert.deepEqual(sortLeaderboardMembers(members, 'discipline').map((member) => member.id), ['current', 'longest', 'stable-a', 'stable-z', 'xp-lead']);
});

test('XP ranking is descending with deterministic ID tie-breaks', () => {
  const members = [{ id: 'b', totalXp: 20 }, { id: 'lower', totalXp: 5 }, { id: 'a', totalXp: 20 }];
  assert.deepEqual(sortLeaderboardMembers(members, 'xp').map((member) => member.id), ['a', 'b', 'lower']);
});

test('Rank and name filters combine, and displayed positions recalculate from one', () => {
  const origin = buildLeaderboardResults(leaderboardDemoMembers, { category: 'xp', rankId: 'origin' });
  assert.equal(origin.length, 2);
  assert.deepEqual(origin.map((member) => member.position), [1, 2]);
  assert.deepEqual(filterLeaderboardMembers(leaderboardDemoMembers, { rankId: 'ember', query: 'rhea' }).map((member) => member.displayName), ['Rhea Moss']);
  assert.deepEqual(buildLeaderboardResults(leaderboardDemoMembers, { query: 'no match' }), []);
});

test('all seven Rank filters return only their Rank and recalculate local positions', () => {
  const expectedCounts = { origin: 2, ember: 2, surge: 2, vector: 1, apex: 1, zenith: 1, continuum: 1 };
  for (const rank of ranks) {
    const results = buildLeaderboardResults(leaderboardDemoMembers, { category: 'overall', rankId: rank.slug });
    assert.equal(results.length, expectedCounts[rank.slug], `${rank.name} result count`);
    assert.ok(results.every((member) => member.rankId === rank.slug), `${rank.name} filter membership`);
    assert.deepEqual(results.map((member) => member.position), results.map((_, index) => index + 1), `${rank.name} local positions`);
  }
});

test('each category ranks a distinct demo leader from its own source values', () => {
  assert.equal(buildLeaderboardResults(leaderboardDemoMembers, { category: 'overall' })[0].displayName, 'Mira Vale');
  assert.equal(buildLeaderboardResults(leaderboardDemoMembers, { category: 'discipline' })[0].displayName, 'Ivo Kade');
  assert.equal(buildLeaderboardResults(leaderboardDemoMembers, { category: 'xp' })[0].displayName, 'Theo Ren');
});

test('current leaderboard entry derives Rank, Level, XP, and streak from shared session data without email', () => {
  const state = { currentRankSlug: 'apex', totalXp: 3050, currentStreak: 18, longestStreak: 41 };
  const entry = createCurrentMemberEntry(dashboardDemo.member, state);
  assert.equal(entry.id, dashboardDemo.member.memberId);
  assert.equal(entry.rankId, 'apex');
  assert.equal(entry.totalXp, 3050);
  assert.equal(entry.level, getLevelFromTotalXp(3050));
  assert.equal(entry.currentDisciplineStreak, 18);
  assert.equal(entry.longestDisciplineStreak, 41);
  assert.equal(entry.isCurrentMember, true);
  assert.equal('email' in entry, false);
  const merged = mergeLeaderboardMembers(leaderboardDemoMembers, entry);
  assert.equal(merged.length, 11);
  assert.equal(merged.filter((member) => member.id === entry.id).length, 1);
});

test('Apex podium accent reuses the configured Apex Rank colour', () => {
  assert.equal(LEADERBOARD_POSITION_ACCENTS.third, ranks.find((rank) => rank.slug === 'apex').color);
});
