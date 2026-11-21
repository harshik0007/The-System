import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import mongoose from 'mongoose';
import ProgressionRun from '../models/ProgressionRun.js';
import RecoveryQuest from '../models/RecoveryQuest.js';
import TaskOccurrence from '../models/TaskOccurrence.js';
import User from '../models/User.js';
import MonthlyAnalysisSummary from '../models/MonthlyAnalysisSummary.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { config } from '../config/env.js';
import { createLeaderboardRouter } from '../routes/leaderboardRoutes.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { getLeaderboard, getPublicMemberProfile } from '../services/leaderboardService.js';
import { getCumulativeXpThreshold } from '../services/progressionXpService.js';
import { getRankSlugForLevel } from '../utils/ranks.js';

const shouldRun = process.env.RUN_MONGO_INTEGRATION === '1';
const dateKey = '2026-11-19';
const now = new Date('2026-11-19T07:00:00.000Z');

async function createMember({ name, handle, level = 3, streak = 5, longest = 6, runNumber = 1, resetCount = 0 } = {}) {
  const userId = new mongoose.Types.ObjectId();
  const runId = new mongoose.Types.ObjectId();
  const user = await User.create({
    _id: userId,
    identityKind: 'account',
    username: handle.replace(/-/g, '_'),
    usernameNormalized: handle.replace(/-/g, '_').toLowerCase(),
    emailNormalized: `m26-${userId}@example.test`,
    accountStatus: 'active',
    memberSince: '2026-01-01',
    currentProgressionRunId: runId,
    resetCount,
    lifetimeLongestStreak: 200,
    publicHandle: handle,
  });
  const totalXp = getCumulativeXpThreshold(level) + 12.34;
  const run = await ProgressionRun.create({
    _id: runId, userId, runNumber, status: 'active', startedAt: now, startedOn: '2026-01-01',
    currentRankSlug: getRankSlugForLevel(level), level, totalXp, currentStreak: streak, longestStreak: longest,
    gracePoints: 3, disciplinePoints: 0,
  });
  return { user, run };
}

function occurrence(member, index, date = '2026-11-18', run = member.run) {
  return {
    userId: member.user._id, progressionRunId: run._id, taskId: new mongoose.Types.ObjectId(),
    taskScheduleId: new mongoose.Types.ObjectId(), occurrenceDate: date, cycleDay: 1,
    snapshot: { title: `M26 Task ${index}`, description: '', accountabilityAction: { title: 'Action', description: 'Do it', weakness: '' }, revision: 1 },
    status: 'completed', completedAt: now,
  };
}

function quest(member, suffix, status = 'active', run = member.run) {
  const date = new Date('2026-11-18T10:00:00.000Z');
  return {
    userId: member.user._id, progressionRunId: run._id, sourceTaskId: new mongoose.Types.ObjectId(), sourceOccurrenceId: new mongoose.Types.ObjectId(),
    sourceEventKey: `m26-${member.user._id}-${suffix}`, sourceSnapshot: { taskTitle: 'A Task', accountabilityActionTitle: 'Action', accountabilityActionDescription: 'Do it', taskRevision: 1 },
    activatedAt: date, baseExpiresAt: new Date('2026-11-19T10:00:00.000Z'), expiresAt: new Date('2026-11-19T10:00:00.000Z'), status,
    ...(status === 'completed' ? { completedAt: date } : {}),
  };
}

test('M26 leaderboard, public profile privacy, and Personal Best persistence use isolated replica-set accounts', { skip: !shouldRun, timeout: 120_000 }, async (t) => {
  const isolatedUri = new URL(config.mongoUri);
  isolatedUri.pathname = `/the_system_m26_${process.pid}_${Date.now()}`;
  await connectDatabase(isolatedUri.toString());
  assert.equal(mongoose.connection.readyState, 1, 'A real local MongoDB replica set is required.');
  const members = [];
  let apiServer;
  t.after(async () => {
    if (apiServer?.listening) {
      apiServer.close();
      await once(apiServer, 'close');
    }
    const ids = members.map(({ user }) => user._id);
    if (ids.length) {
      await Promise.all([
        TaskOccurrence.deleteMany({ userId: { $in: ids } }), RecoveryQuest.deleteMany({ userId: { $in: ids } }),
        MonthlyAnalysisSummary.deleteMany({ userId: { $in: ids } }), ProgressionRun.deleteMany({ userId: { $in: ids } }),
        User.deleteMany({ _id: { $in: ids } }),
      ]);
    }
    await mongoose.connection.dropDatabase();
    await disconnectDatabase();
  });

  const current = await createMember({ name: 'M26 Alpha', handle: `m26-alpha-${new mongoose.Types.ObjectId().toString().slice(-8)}`, resetCount: 2 });
  const peer = await createMember({ name: 'M26 Beta', handle: `m26-beta-${new mongoose.Types.ObjectId().toString().slice(-8)}` });
  const podiumCurrent = await createMember({ name: 'M26 Podium Alpha', handle: `m26-podium-a-${new mongoose.Types.ObjectId().toString().slice(-8)}`, level: 106, streak: 100, longest: 120 });
  const podiumPeer = await createMember({ name: 'M26 Podium Beta', handle: `m26-podium-b-${new mongoose.Types.ObjectId().toString().slice(-8)}`, level: 106, streak: 100, longest: 120 });
  const noRunId = new mongoose.Types.ObjectId();
  const noRunUsername = `m26_no_run_${noRunId.toString().slice(-6)}`;
  const noRun = await User.create({ identityKind: 'account', username: noRunUsername, usernameNormalized: noRunUsername, emailNormalized: `m26-${noRunId}@example.test`, accountStatus: 'active', memberSince: '2026-01-01' });
  members.push(current, peer, podiumCurrent, podiumPeer, { user: noRun, run: null });
  await User.updateOne({ _id: current.user._id }, { $set: { highestRankAchieved: 'continuum' } });

  // Equal primary standings and an exactly equal 2/2 ratio must share rank.
  await TaskOccurrence.insertMany([
    ...[0, 1, 2, 3].map((index) => occurrence(current, index)),
    ...[0, 1, 2, 3].map((index) => occurrence(peer, index)),
    ...Array.from({ length: 2 }, (_, index) => occurrence(current, index, '2026-10-05')),
  ]);
  await RecoveryQuest.insertMany([quest(current, 'active-1', 'active'), quest(current, 'completed-2', 'completed'), quest(peer, 'expired-1', 'expired')]);
  await MonthlyAnalysisSummary.create({
    userId: current.user._id, progressionRunId: current.run._id, monthKey: '2026-10',
    monthStartAt: new Date('2026-10-01T00:00:00.000Z'), monthEndAt: new Date('2026-11-01T00:00:00.000Z'),
    coveredFrom: '2026-10-01', coveredThrough: '2026-10-31', status: 'finalized', aggregationVersion: 1, hasData: true,
    metrics: { daily: [{ date: '2026-10-05', tasks: { completed: 2 } }], tasks: { completed: 2 } },
    sourceCounts: {}, createdAt: now, updatedAt: now,
  });
  const oldRunId = new mongoose.Types.ObjectId();
  const oldRun = await ProgressionRun.create({
    _id: oldRunId, userId: current.user._id, runNumber: 2, status: 'ended', startedAt: now, startedOn: '2025-01-01', endedAt: now, endedOn: '2025-12-31',
    currentRankSlug: 'continuum', level: 106, totalXp: 999999, currentStreak: 100, longestStreak: 200, gracePoints: 0, disciplinePoints: 0,
  });
  await TaskOccurrence.insertMany(Array.from({ length: 20 }, (_, index) => occurrence(current, index, '2025-10-05', oldRun)));
  await RecoveryQuest.create(quest(current, 'old-run-only', 'expired', oldRun));

  const snapshot = await getLeaderboard({ requesterId: String(current.user._id), now });
  assert.equal(snapshot.memberCount, 4);
  assert.equal(snapshot.currentMember.publicHandle, current.user.publicHandle);
  const currentOverall = snapshot.categories.overall.find((entry) => entry.isCurrentMember);
  const peerOverall = snapshot.categories.overall.find((entry) => entry.publicHandle === peer.user.publicHandle);
  assert.ok(peerOverall, `peer row missing; visible rows: ${snapshot.categories.overall.map((entry) => entry.publicHandle).join(', ')}`);
  assert.ok(snapshot.categories.overall.every((entry) => entry.username && !Object.hasOwn(entry, 'isDemonstration')));
  assert.equal(currentOverall.competitionRank, peerOverall.competitionRank, 'an exact tie-break ratio has equal competition rank');
  assert.deepEqual(currentOverall.tieBreak, { completedOriginalTasks: '6', totalRecoveryQuests: '2' });
  for (const category of ['overall', 'discipline', 'xp']) {
    const currentEntry = snapshot.categories[category].find((entry) => entry.isCurrentMember);
    const peerEntry = snapshot.categories[category].find((entry) => entry.publicHandle === peer.user.publicHandle);
    assert.ok(peerEntry, `${category} tie peer is present`);
    assert.equal(currentEntry.competitionRank, peerEntry.competitionRank, `${category} shares the exact tie-break result`);
  }
  assert.equal(currentOverall.level, 3, 'current run Level is used, not ended-run Level');
  assert.equal(currentOverall.totalXp, current.run.totalXp, 'current run XP is used, not ended-run XP');
  assert.equal(currentOverall.longestDisciplineStreak, 6);
  assert.equal(currentOverall.rankId, 'origin', 'current Rank remains authoritative after a lifetime Rank high');
  assert.equal(currentOverall.highestRankId, 'continuum');

  const podiumSnapshot = await getLeaderboard({ requesterId: String(podiumCurrent.user._id), now });
  for (const category of ['overall', 'discipline', 'xp']) {
    const currentEntry = podiumSnapshot.categories[category].find((entry) => entry.isCurrentMember);
    const peerEntry = podiumSnapshot.categories[category].find((entry) => entry.publicHandle === podiumPeer.user.publicHandle);
    assert.ok(peerEntry, `${category} tied member is present`);
    assert.equal(currentEntry.competitionRank, peerEntry.competitionRank, `${category} preserves the current member's shared competition rank`);
  }
  const tiedOverallPodium = podiumSnapshot.categories.overall.slice(0, 3);
  assert.ok(tiedOverallPodium.some((entry) => entry.isCurrentMember));
  assert.ok(tiedOverallPodium.some((entry) => entry.publicHandle === podiumPeer.user.publicHandle));
  assert.equal(tiedOverallPodium.find((entry) => entry.isCurrentMember).competitionRank, 2);
  assert.equal(tiedOverallPodium.find((entry) => entry.publicHandle === podiumPeer.user.publicHandle).competitionRank, 2);
  const tiedDisciplineLeaders = podiumSnapshot.categories.discipline.slice(0, 2);
  assert.equal(tiedDisciplineLeaders.filter((entry) => entry.competitionRank === 1).length, 2);
  assert.ok(tiedDisciplineLeaders.some((entry) => entry.isCurrentMember));

  const [sameFirst, sameSecond] = await Promise.all([
    getLeaderboard({ requesterId: String(current.user._id), now }),
    getLeaderboard({ requesterId: String(current.user._id), now }),
  ]);
  assert.deepEqual(sameFirst.currentPositions, sameSecond.currentPositions);
  const persisted = await User.findById(current.user._id).select('personalBestRecords emailNormalized passwordHash').lean();
  for (const category of ['overall', 'discipline', 'xp']) {
    assert.equal(persisted.personalBestRecords[category].currentPosition, sameFirst.currentPositions[category]);
    assert.ok(persisted.personalBestRecords[category].bestPosition >= 1);
    assert.equal(persisted.personalBestRecords[category].achievedOn, dateKey);
  }

  const challenger = await createMember({ name: 'M26 Challenger', handle: `m26-challenger-${new mongoose.Types.ObjectId().toString().slice(-8)}`, level: 75, streak: 0, longest: 0 });
  members.push(challenger);
  const afterPositionChange = await getLeaderboard({ requesterId: String(current.user._id), now: new Date('2026-11-20T07:00:00.000Z') });
  const updatedPersonalBests = await User.findById(current.user._id).select('personalBestRecords').lean();
  assert.ok(afterPositionChange.currentPositions.overall > sameFirst.currentPositions.overall);
  assert.equal(updatedPersonalBests.personalBestRecords.overall.currentPosition, afterPositionChange.currentPositions.overall);
  assert.equal(updatedPersonalBests.personalBestRecords.overall.bestPosition, sameFirst.currentPositions.overall);
  assert.equal(updatedPersonalBests.personalBestRecords.overall.achievedOn, dateKey);

  await User.updateOne({ _id: current.user._id }, { $set: { privacy: {
    publicProfile: true, activityMap: false, personalBest: false, currentRank: false, level: false,
    progressionStats: false, currentStreak: false, longestStreak: false, disciplinePointBalance: false, gracePointBalance: false,
  } } });
  const profile = await getPublicMemberProfile({ requesterId: String(current.user._id), publicHandle: 'me', now });
  const publicJson = JSON.stringify(profile);
  assert.equal(profile.resetCount, 2, 'Reset Count remains visible even when all configurable fields are hidden');
  assert.equal(profile.currentRank, null);
  assert.equal(profile.level, null);
  assert.equal(profile.personalBestRecords, null);
  assert.equal(profile.activityMap, null);
  assert.equal(publicJson.includes(String(current.user._id)), false);
  assert.equal(publicJson.includes('emailNormalized'), false);
  assert.equal(publicJson.includes('@example.test'), false);

  const api = express();
  api.use(express.json());
  api.use('/api/v1', createLeaderboardRouter({ identityMiddleware: (request, _response, next) => {
    request.user = { id: String(current.user._id) };
    next();
  } }));
  api.use(errorHandler);
  apiServer = api.listen(0);
  await once(apiServer, 'listening');
  const address = apiServer.address();
  const root = `http://127.0.0.1:${address.port}/api/v1/leaderboard`;
  const good = await fetch(root);
  assert.equal(good.status, 200);
  assert.match(good.headers.get('cache-control'), /no-store/);
  assert.equal((await good.json()).currentMember.publicHandle, current.user.publicHandle);
  const rejectedQuery = await fetch(`${root}?userId=${peer.user._id}`);
  assert.equal(rejectedQuery.status, 400, 'the API does not accept client-supplied identity overrides');
  const currentSettings = await fetch(`${root}/profile-settings`);
  assert.equal(currentSettings.status, 200);
  assert.equal((await currentSettings.json()).settings.publicHandle, current.user.publicHandle);
  const oldSettingsResponse = await fetch(`${root}/profile-settings`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName: 'M26 Alpha Updated', avatarMark: 'spark', privacy: {
      publicProfile: true, fullName: true, activityMap: false, personalBest: true, currentRank: true, level: true,
      progressionStats: true, currentStreak: true, longestStreak: true, disciplinePointBalance: false, gracePointBalance: false,
    } }),
  });
  assert.equal(oldSettingsResponse.status, 400, 'the obsolete displayName request shape is rejected with a field error');
  const settingsResponse = await fetch(`${root}/profile-settings`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ avatarMark: 'spark', privacy: {
      publicProfile: true, fullName: true, activityMap: false, personalBest: true, currentRank: true, level: true,
      progressionStats: true, currentStreak: true, longestStreak: true, disciplinePointBalance: false, gracePointBalance: false,
    } }),
  });
  assert.equal(settingsResponse.status, 200);
  const savedSettings = await settingsResponse.json();
  assert.equal(savedSettings.settings.username, current.user.username);
  assert.equal(savedSettings.settings.publicHandle, current.user.publicHandle);
  assert.equal(savedSettings.settings.privacy.disciplinePointBalance, false);
  const publicSelf = await fetch(`${root}/profiles/${current.user.publicHandle}`);
  assert.equal(publicSelf.status, 200);
  const selfProfile = (await publicSelf.json()).profile;
  assert.equal(selfProfile.isCurrentMember, true);
  assert.equal(selfProfile.username, current.user.username);
  assert.equal(selfProfile.disciplinePointBalance, null);
  assert.equal(selfProfile.resetCount, 2);

  await assert.rejects(getPublicMemberProfile({ requesterId: String(current.user._id), publicHandle: 'mira-vale', now }), { status: 404 });
});
