import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLeaderboardResults, filterLeaderboardMembers, getLeaderboardPositionLabel, LEADERBOARD_CATEGORIES } from './leaderboard.js';

const serverRanked = [
  { id: 'one', publicHandle: 'one-member', username: 'one_member', rankId: 'continuum', competitionRank: 1 },
  { id: 'tied', publicHandle: 'tied-member', username: 'tied_member', rankId: 'zenith', competitionRank: 1 },
  { id: 'third', publicHandle: 'third-member', username: 'third_member', rankId: 'apex', competitionRank: 3 },
  { id: 'fourth', publicHandle: 'fourth-member', username: 'fourth_member', rankId: 'origin', competitionRank: 4 },
];

test('frontend exposes the three approved leaderboard categories', () => {
  assert.deepEqual(LEADERBOARD_CATEGORIES.map((item) => item.id), ['overall', 'discipline', 'xp']);
});

test('filtering preserves server-assigned competition ranks and ordering', () => {
  const filtered = buildLeaderboardResults(serverRanked, { rankId: 'origin' });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].position, 4);
  assert.equal(filtered[0].competitionRank, 4);
  assert.deepEqual(buildLeaderboardResults(serverRanked).map((member) => member.position), [1, 1, 3, 4]);
});

test('search and Rank filters combine without recalculating positions', () => {
  const results = buildLeaderboardResults(serverRanked, { rankId: 'apex', query: 'third' });
  assert.equal(results.length, 1);
  assert.equal(results[0].position, 3);
  assert.deepEqual(filterLeaderboardMembers(serverRanked, { rankId: 'zenith', query: 'tied' }).map((member) => member.username), ['tied_member']);
  assert.deepEqual(buildLeaderboardResults(serverRanked, { query: 'no match' }), []);
});

test('competition position labels do not invent ordinal place claims', () => {
  assert.equal(getLeaderboardPositionLabel(1), 'Rank 1');
  assert.equal(getLeaderboardPositionLabel(3), 'Rank 3');
  assert.equal(getLeaderboardPositionLabel(null), 'Ranking unavailable');
});
