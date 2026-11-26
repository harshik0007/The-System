import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultUserPreferences, getEffectiveReducedMotion, normalizeUserPreferences, updatePreferenceGroup } from './userPreferences.js';

test('default preferences cover profile visibility, interface effects and accessibility', () => {
  const defaults = createDefaultUserPreferences();
  assert.equal(defaults.profile.username, '');
  assert.equal(defaults.privacy.publicProfile, true);
  assert.equal(defaults.privacy.fullName, true);
  assert.equal(defaults.appearance.nonessentialAnimations, true);
  assert.equal(defaults.appearance.effectQuality, 'balanced');
  assert.equal(defaults.accessibility.reduceMotion, null);
});

test('normalization preserves supported saved choices and fills missing fields safely', () => {
  const normalized = normalizeUserPreferences({
    profile: { username: '  aster_v  ', avatarMark: 'spark' },
    privacy: { publicProfile: false, level: false },
    appearance: { nonessentialAnimations: false, effectQuality: 'high', reduceDecorativeEffects: true },
    accessibility: { reduceMotion: true },
  });
  assert.equal(normalized.profile.username, '  aster_v  ');
  assert.equal(normalized.profile.avatarMark, 'spark');
  assert.equal(normalized.privacy.publicProfile, false);
  assert.equal(normalized.privacy.fullName, true);
  assert.equal(normalized.privacy.activityMap, true);
  assert.equal(normalized.appearance.nonessentialAnimations, false);
  assert.equal(normalized.appearance.effectQuality, 'high');
  assert.equal(normalized.appearance.reduceDecorativeEffects, true);
  assert.equal(normalized.accessibility.reduceMotion, true);
  assert.equal(normalized.privacy.unknown, undefined);
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
