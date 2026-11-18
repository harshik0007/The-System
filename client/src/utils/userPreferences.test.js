import test from 'node:test';
import assert from 'node:assert/strict';
import { notificationPreferenceGroups } from '../data/notificationPreferenceGroups.js';
import { createDefaultUserPreferences, getEffectiveReducedMotion, normalizeUserPreferences, updatePreferenceGroup } from './userPreferences.js';

test('default preferences cover public visibility, appearance, accessibility and every notification group', () => {
  const defaults = createDefaultUserPreferences();
  assert.equal(defaults.profile.displayName, 'Demo Member');
  assert.equal(defaults.privacy.publicProfile, true);
  assert.equal(defaults.appearance.voidShardCursor, true);
  assert.equal(defaults.accessibility.reduceMotion, null);
  assert.equal(Object.keys(defaults.notifications).length, notificationPreferenceGroups.reduce((count, group) => count + group.items.length, 0));
});

test('normalization preserves supported saved choices and fills missing fields safely', () => {
  const normalized = normalizeUserPreferences({
    profile: { displayName: '  Aster Vale  ', avatarMark: 'spark' },
    privacy: { publicProfile: false, level: false },
    appearance: { voidShardCursor: false, clickRipple: true },
    notifications: { rankUp: false },
    accessibility: { reduceMotion: true },
  });
  assert.equal(normalized.profile.displayName, '  Aster Vale  ');
  assert.equal(normalized.profile.avatarMark, 'spark');
  assert.equal(normalized.privacy.publicProfile, false);
  assert.equal(normalized.privacy.activityMap, true);
  assert.equal(normalized.appearance.voidShardCursor, false);
  assert.equal(normalized.notifications.rankUp, false);
  assert.equal(normalized.notifications.levelLost, true);
  assert.equal(normalized.accessibility.reduceMotion, true);
  assert.equal(normalized.privacy.unknown, undefined);
});

test('category updates change only the selected preference group', () => {
  const initial = createDefaultUserPreferences();
  const updated = updatePreferenceGroup(initial, 'privacy', 'activityMap', false);
  assert.equal(updated.privacy.activityMap, false);
  assert.equal(updated.privacy.personalBest, true);
  assert.deepEqual(updated.appearance, initial.appearance);
  assert.deepEqual(updated.notifications, initial.notifications);
});

test('reduced motion follows the system until a member explicitly overrides it', () => {
  const defaults = createDefaultUserPreferences();
  assert.equal(getEffectiveReducedMotion(defaults, true), true);
  assert.equal(getEffectiveReducedMotion(defaults, false), false);
  assert.equal(getEffectiveReducedMotion({ ...defaults, accessibility: { reduceMotion: false } }, true), false);
  assert.equal(getEffectiveReducedMotion({ ...defaults, accessibility: { reduceMotion: true } }, false), true);
});
