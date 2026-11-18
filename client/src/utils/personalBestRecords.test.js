import test from 'node:test';
import assert from 'node:assert/strict';
import { leaderboardDemoMembers } from '../data/leaderboardDemo.js';
import { createDisciplineState, enterHigherRank, startProgressionRun } from './disciplineManager.js';
import { buildLeaderboardResults } from './leaderboard.js';
import { updateMemberPersonalBestRecord } from './personalBestRecords.js';

test('each leaderboard category retains its own lifetime best and achievement date', () => {
  const first = updateMemberPersonalBestRecord({}, 'member-a', {
    positions: { overall: 8, discipline: 5, xp: 9 },
    dateKey: '2026-11-01',
  });
  const second = updateMemberPersonalBestRecord(first, 'member-a', {
    positions: { overall: 5, discipline: 9, xp: 2 },
    dateKey: '2026-11-02',
  });
  const third = updateMemberPersonalBestRecord(second, 'member-a', {
    positions: { overall: 10, discipline: 10, xp: 4 },
    dateKey: '2026-11-03',
  });

  assert.deepEqual(third['member-a'].overall, { currentPosition: 10, bestPosition: 5, achievedOn: '2026-11-02' });
  assert.deepEqual(third['member-a'].discipline, { currentPosition: 10, bestPosition: 5, achievedOn: '2026-11-01' });
  assert.deepEqual(third['member-a'].xp, { currentPosition: 4, bestPosition: 2, achievedOn: '2026-11-02' });
});

test('member records are isolated by stable member ID', () => {
  const first = updateMemberPersonalBestRecord({}, 'member-a', { positions: { overall: 3 }, dateKey: '2026-11-01' });
  const second = updateMemberPersonalBestRecord(first, 'member-b', { positions: { overall: 7 }, dateKey: '2026-11-02' });
  assert.equal(second['member-a'].overall.bestPosition, 3);
  assert.equal(second['member-b'].overall.bestPosition, 7);
  assert.equal(second['member-a'], first['member-a']);
});

test('a better actual Rank updates the lifetime high and a Progression Reset preserves it', () => {
  const origin = createDisciplineState({ rankSlug: 'origin' });
  const vectorResult = enterHigherRank(origin, 'vector', '2026-11-02');
  assert.equal(vectorResult.state.highestRankAchieved.rankSlug, 'vector');
  assert.equal(vectorResult.state.highestRankAchieved.lastAchievedOn, '2026-11-02');

  const reset = startProgressionRun(vectorResult.state, { runId: 'reset-run', rankSlug: 'origin' });
  assert.equal(reset.currentRankSlug, 'origin');
  assert.equal(reset.highestRankAchieved.rankSlug, 'vector');

  const reearned = enterHigherRank(reset, 'vector', '2026-11-17');
  assert.equal(reearned.state.highestRankAchieved.rankSlug, 'vector');
  assert.equal(reearned.state.highestRankAchieved.lastAchievedOn, '2026-11-02');
});

test('demo members have stable, varied personal-best data without changing standings sorting', () => {
  assert.equal(leaderboardDemoMembers.length, 10);
  assert.ok(leaderboardDemoMembers.every((member) => member.personalBestRecords?.overall?.bestPosition));
  assert.ok(leaderboardDemoMembers.some((member) => member.personalBestRecords.overall.bestPosition < member.personalBestRecords.overall.currentPosition));
  assert.ok(leaderboardDemoMembers.some((member) => member.personalBestRecords.discipline.bestPosition < member.personalBestRecords.discipline.currentPosition));
  assert.ok(leaderboardDemoMembers.some((member) => member.personalBestRecords.xp.bestPosition < member.personalBestRecords.xp.currentPosition));
  assert.ok(leaderboardDemoMembers.some((member) => Number(member.highestRankNumber) < Number(member.rankNumber)));

  const baseline = ['overall', 'discipline', 'xp'].map((category) => buildLeaderboardResults(leaderboardDemoMembers, { category }).map((member) => member.id));
  const annotated = leaderboardDemoMembers.map((member) => ({ ...member, personalBestRecords: { ...member.personalBestRecords, overall: { currentPosition: 1, bestPosition: 1, achievedOn: '2026-11-18' } } }));
  const afterRecords = ['overall', 'discipline', 'xp'].map((category) => buildLeaderboardResults(annotated, { category }).map((member) => member.id));
  assert.deepEqual(afterRecords, baseline);
});
