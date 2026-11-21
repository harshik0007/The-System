import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { config } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import ProgressionRun from '../models/ProgressionRun.js';
import User from '../models/User.js';
import { getAccountSettings, updateAccountPreferences } from '../services/accountSettingsService.js';
import { getPublicMemberProfile } from '../services/leaderboardService.js';
import { applyXpAdjustment, getCumulativeXpThreshold } from '../services/progressionXpService.js';
import { withMongoTransaction } from '../services/mongoTransaction.js';

const shouldRun = process.env.RUN_MONGO_INTEGRATION === '1';

test('theme preferences enforce current Rank, preserve other preferences, scope public themes and reset on demotion', { skip: !shouldRun, timeout: 120_000 }, async (t) => {
  const isolatedUri = new URL(config.mongoUri);
  isolatedUri.pathname = `/the_system_theme_${process.pid}_${Date.now()}`;
  await connectDatabase(isolatedUri.toString());
  assert.equal(mongoose.connection.readyState, 1, 'A local MongoDB replica set must be connected.');
  t.after(async () => { await mongoose.connection.dropDatabase(); await disconnectDatabase(); });

  const user = await User.create({
    identityKind: 'account', accountStatus: 'active', memberSince: '2026-11-01',
    publicHandle: `theme-${new mongoose.Types.ObjectId().toString().slice(-8)}`,
    appearancePreferences: { theme: 'dark-navy', voidShardCursor: false, clickRipple: false, nonessentialAnimations: true, reduceDecorativeEffects: true },
  });
  const startedAt = new Date('2026-11-01T00:00:00.000Z');
  const rank05Xp = getCumulativeXpThreshold(20) + 5;
  const run = await ProgressionRun.create({
    userId: user._id, runNumber: 1, status: 'active', startedAt, startedOn: '2026-11-01',
    currentRankSlug: 'surge', level: 20, totalXp: rank05Xp,
  });
  user.currentProgressionRunId = run._id;
  await user.save();

  await assert.rejects(updateAccountPreferences(user._id, { appearance: { theme: 'obsidian', rank: 'surge' } }), /unsupported preference fields/);
  await assert.rejects(updateAccountPreferences(user._id, { appearance: { theme: 'aurora' } }), /Rank 03/i);
  const saved = await updateAccountPreferences(user._id, { appearance: { theme: 'obsidian' } });
  assert.equal(saved.appearance.theme, 'obsidian');
  assert.equal(saved.appearance.voidShardCursor, false);
  assert.equal(saved.appearance.clickRipple, false);
  const persisted = await User.findById(user._id).lean();
  assert.equal(persisted.appearancePreferences.theme, 'obsidian');
  assert.equal(persisted.appearancePreferences.voidShardCursor, false);

  run.level = 50;
  run.currentRankSlug = 'apex';
  run.totalXp = getCumulativeXpThreshold(50) + 5;
  await run.save();
  const auroraSaved = await updateAccountPreferences(user._id, { appearance: { theme: 'aurora' } });
  assert.equal(auroraSaved.appearance.theme, 'aurora');
  await assert.rejects(updateAccountPreferences(user._id, { appearance: { theme: 'eclipse' } }), /Rank 02/i);

  const publicProfile = await getPublicMemberProfile({ requesterId: String(user._id), publicHandle: 'me' });
  assert.equal(publicProfile.theme, 'aurora', 'The public profile exposes its owner theme through a profile-local field.');

  const rank03Xp = Number(run.totalXp);
  const targetXp = getCumulativeXpThreshold(49) + 0.01;
  const deductionCents = -Math.round((rank03Xp - targetXp) * 100);
  const xpResult = await withMongoTransaction((session) => applyXpAdjustment({
    userId: user._id,
    progressionRunId: run._id,
    amountCents: deductionCents,
    sourceEventKey: `theme-demotion:${user._id}`,
    occurredAt: new Date('2026-11-19T12:00:00.000Z'),
    session,
  }));
  assert.equal(xpResult.resultingLevel, 49);
  const demotedUser = await User.findById(user._id).lean();
  assert.equal(demotedUser.appearancePreferences.theme, 'dark-navy', 'An XP demotion removes an ineligible equipped theme in the same transaction.');
  await assert.rejects(updateAccountPreferences(user._id, { appearance: { theme: 'aurora' } }), /Rank 03/i);
  const afterDemotion = await getAccountSettings(user._id);
  assert.equal(afterDemotion.appearance.theme, 'dark-navy');
  assert.equal((await User.findById(user._id).lean()).appearancePreferences.voidShardCursor, false);

  run.level = 75;
  run.currentRankSlug = 'zenith';
  run.totalXp = getCumulativeXpThreshold(75) + 5;
  await run.save();
  const eclipseSaved = await updateAccountPreferences(user._id, { appearance: { theme: 'eclipse' } });
  assert.equal(eclipseSaved.appearance.theme, 'eclipse');
  const eclipseProfile = await getPublicMemberProfile({ requesterId: String(user._id), publicHandle: 'me' });
  assert.equal(eclipseProfile.theme, 'eclipse', 'The owner theme is exposed only on the public profile view model.');

  const rank02Xp = Number(run.totalXp);
  const rank03MaxXp = getCumulativeXpThreshold(74) + 0.01;
  const rank02DeductionCents = -Math.round((rank02Xp - rank03MaxXp) * 100);
  const eclipseDemotion = await withMongoTransaction((session) => applyXpAdjustment({
    userId: user._id,
    progressionRunId: run._id,
    amountCents: rank02DeductionCents,
    sourceEventKey: `eclipse-theme-demotion:${user._id}`,
    occurredAt: new Date('2026-11-20T12:00:00.000Z'),
    session,
  }));
  assert.equal(eclipseDemotion.resultingLevel, 74);
  assert.equal((await User.findById(user._id).lean()).appearancePreferences.theme, 'dark-navy');
  await assert.rejects(updateAccountPreferences(user._id, { appearance: { theme: 'eclipse' } }), /Rank 02/i);

  run.level = 100;
  run.currentRankSlug = 'continuum';
  run.totalXp = getCumulativeXpThreshold(100) + 5;
  await run.save();
  const galaxionSaved = await updateAccountPreferences(user._id, { appearance: { theme: 'galaxion' } });
  assert.equal(galaxionSaved.appearance.theme, 'galaxion');
  const galaxionProfile = await getPublicMemberProfile({ requesterId: String(user._id), publicHandle: 'me' });
  assert.equal(galaxionProfile.theme, 'galaxion', 'The public profile receives the eligible owner theme without changing visitor preferences.');

  // Legacy Rank 01 preferences migrate only after the server checks current Rank.
  await User.collection.updateOne({ _id: user._id }, { $set: { 'appearancePreferences.theme': 'waterfury' } });
  const migratedWaterFurySettings = await getAccountSettings(user._id);
  assert.equal(migratedWaterFurySettings.appearance.theme, 'galaxion');
  assert.equal((await User.findById(user._id).lean()).appearancePreferences.theme, 'galaxion', 'Eligible legacy WaterFury preferences are migrated in storage.');

  await User.collection.updateOne({ _id: user._id }, { $set: { 'appearancePreferences.theme': 'nexus-prime' } });
  const migratedSettings = await getAccountSettings(user._id);
  assert.equal(migratedSettings.appearance.theme, 'galaxion');
  assert.equal((await User.findById(user._id).lean()).appearancePreferences.theme, 'galaxion', 'Eligible legacy Nexus Prime preferences are migrated in storage.');

  const rank01Xp = Number(run.totalXp);
  const rank02MaxXp = getCumulativeXpThreshold(99) + 0.01;
  const rank01DeductionCents = -Math.round((rank01Xp - rank02MaxXp) * 100);
  const galaxionDemotion = await withMongoTransaction((session) => applyXpAdjustment({
    userId: user._id,
    progressionRunId: run._id,
    amountCents: rank01DeductionCents,
    sourceEventKey: `galaxion-demotion:${user._id}`,
    occurredAt: new Date('2026-11-21T12:00:00.000Z'),
    session,
  }));
  assert.equal(galaxionDemotion.resultingLevel, 99);
  assert.equal((await User.findById(user._id).lean()).appearancePreferences.theme, 'dark-navy');
  await assert.rejects(updateAccountPreferences(user._id, { appearance: { theme: 'galaxion' } }), /Rank 01/i);

  await User.collection.updateOne({ _id: user._id }, { $set: { 'appearancePreferences.theme': 'waterfury' } });
  const ineligibleMigration = await getAccountSettings(user._id);
  assert.equal(ineligibleMigration.appearance.theme, 'dark-navy');
  assert.equal((await User.findById(user._id).lean()).appearancePreferences.theme, 'dark-navy', 'Ineligible legacy preferences are safely cleared to Dark Navy.');
});
