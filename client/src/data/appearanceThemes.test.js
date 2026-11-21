import test from 'node:test';
import assert from 'node:assert/strict';
import { APPEARANCE_THEMES, getAppearanceTheme, isAppearanceThemeEligible } from './appearanceThemes.js';

test('Dark Navy, Obsidian, Aurora, Eclipse and Galaxion use the approved unlock levels', () => {
  assert.deepEqual(APPEARANCE_THEMES.map((theme) => theme.id), ['dark-navy', 'obsidian', 'aurora', 'eclipse', 'galaxion']);
  assert.equal(isAppearanceThemeEligible('dark-navy', 0), true);
  assert.equal(isAppearanceThemeEligible('obsidian', 19), false);
  assert.equal(isAppearanceThemeEligible('obsidian', 20), true);
  assert.equal(isAppearanceThemeEligible('aurora', 49), false);
  assert.equal(isAppearanceThemeEligible('aurora', 50), true);
  assert.equal(isAppearanceThemeEligible('aurora', 100), true);
  assert.equal(isAppearanceThemeEligible('eclipse', 74), false);
  assert.equal(isAppearanceThemeEligible('eclipse', 75), true);
  assert.equal(isAppearanceThemeEligible('eclipse', 100), true);
  assert.equal(isAppearanceThemeEligible('galaxion', 99), false);
  assert.equal(isAppearanceThemeEligible('galaxion', 100), true);
  assert.equal(isAppearanceThemeEligible('galaxion', 120), true);
  assert.equal(isAppearanceThemeEligible('waterfury', 100), false);
  assert.equal(isAppearanceThemeEligible('nexus-prime', 100), false);
  assert.equal(isAppearanceThemeEligible('unknown', 100), false);
});

test('every registered theme provides a complete identity for the shared activation overlay', () => {
  for (const theme of APPEARANCE_THEMES) {
    assert.ok(theme.transition, `${theme.id} transition metadata`);
    for (const field of ['accent', 'secondary', 'background', 'surface', 'glow', 'text', 'completion']) {
      assert.equal(typeof theme.transition[field], 'string', `${theme.id} transition ${field}`);
    }
    assert.ok(theme.transition.emblem.viewBox, `${theme.id} emblem viewBox`);
    assert.ok(theme.transition.emblem.paths.length > 0, `${theme.id} emblem paths`);
    assert.equal(getAppearanceTheme(theme.id), theme);
  }
  assert.equal(getAppearanceTheme('galaxion').transition.durationSeconds, 8);
  assert.equal(getAppearanceTheme('eclipse').transition.durationSeconds, undefined, 'other theme transitions retain their six-second shared default');
});
