import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultUserPreferences, getEffectiveReducedMotion, normalizeUserPreferences, updatePreferenceGroup } from './userPreferences.js';

test('default preferences cover profile visibility, appearance and accessibility', () => {
  const defaults = createDefaultUserPreferences();
  assert.equal(defaults.profile.username, '');
  assert.equal(defaults.privacy.publicProfile, true);
  assert.equal(defaults.privacy.fullName, true);
  assert.equal(defaults.appearance.voidShardCursor, true);
  assert.equal(defaults.appearance.theme, 'dark-navy');
  assert.equal(defaults.accessibility.reduceMotion, null);
});

test('normalization preserves supported saved choices and fills missing fields safely', () => {
  const normalized = normalizeUserPreferences({
    profile: { username: '  aster_v  ', avatarMark: 'spark' },
    privacy: { publicProfile: false, level: false },
    appearance: { theme: 'aurora', voidShardCursor: false, clickRipple: true },
    accessibility: { reduceMotion: true },
  });
  assert.equal(normalized.profile.username, '  aster_v  ');
  assert.equal(normalized.profile.avatarMark, 'spark');
  assert.equal(normalized.privacy.publicProfile, false);
  assert.equal(normalized.privacy.fullName, true);
  assert.equal(normalized.privacy.activityMap, true);
  assert.equal(normalized.appearance.voidShardCursor, false);
  assert.equal(normalized.appearance.theme, 'aurora');
  assert.equal(normalized.accessibility.reduceMotion, true);
  assert.equal(normalized.privacy.unknown, undefined);
});

test('unverified legacy and invalid themes safely normalize to Dark Navy while registered themes remain supported', () => {
  const legacy = normalizeUserPreferences({ appearance: { voidShardCursor: false, clickRipple: false } });
  const invalid = normalizeUserPreferences({ appearance: { theme: 'unlocked-by-client', clickRipple: false } });
  const eclipse = normalizeUserPreferences({ appearance: { theme: 'eclipse', voidShardCursor: false } });
  const legacyNexus = normalizeUserPreferences({ appearance: { theme: 'nexus-prime', clickRipple: false } });
  assert.equal(legacy.appearance.theme, 'dark-navy');
  assert.equal(invalid.appearance.theme, 'dark-navy');
  assert.equal(invalid.appearance.clickRipple, false);
  assert.equal(invalid.appearance.voidShardCursor, true);
  assert.equal(eclipse.appearance.theme, 'eclipse');
  assert.equal(eclipse.appearance.voidShardCursor, false);
  assert.equal(legacyNexus.appearance.theme, 'dark-navy', 'only the server can decide whether a legacy selection migrates to Galaxion');
  assert.equal(legacyNexus.appearance.clickRipple, false);
  const legacyWaterFury = normalizeUserPreferences({ appearance: { theme: 'waterfury' } });
  assert.equal(legacyWaterFury.appearance.theme, 'dark-navy', 'only the server can decide whether the legacy preference is eligible for migration');
});

test('category updates change only the selected preference group', () => {
  const initial = createDefaultUserPreferences();
  const updated = updatePreferenceGroup(initial, 'privacy', 'activityMap', false);
  assert.equal(updated.privacy.activityMap, false);
  assert.equal(updated.privacy.personalBest, true);
  assert.deepEqual(updated.appearance, initial.appearance);
});

test('reduced motion follows the system until a member explicitly overrides it', () => {
  const defaults = createDefaultUserPreferences();
  assert.equal(getEffectiveReducedMotion(defaults, true), true);
  assert.equal(getEffectiveReducedMotion(defaults, false), false);
  assert.equal(getEffectiveReducedMotion({ ...defaults, accessibility: { reduceMotion: false } }, true), false);
  assert.equal(getEffectiveReducedMotion({ ...defaults, accessibility: { reduceMotion: true } }, false), true);
});
