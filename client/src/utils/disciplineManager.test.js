import test from 'node:test';
import assert from 'node:assert/strict';
import { createDisciplineState, enterHigherRank, startProgressionRun } from './disciplineManager.js';

test('Highest Rank Achieved survives an automatic run reset and is not lowered by re-earning it', () => {
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
