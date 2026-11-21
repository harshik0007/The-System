import test from 'node:test';
import assert from 'node:assert/strict';
import { getEligibleTheme, isThemeEligible, isThemeId, THEME_ENTITLEMENTS } from '../utils/themeEntitlements.js';

test('Aurora requires current Rank 03 Apex or higher', () => {
  assert.equal(isThemeId('aurora'), true);
  assert.equal(THEME_ENTITLEMENTS.aurora.requiredRank, 'apex');
  for (const level of [0, 9, 10, 19, 20, 34, 35, 49]) assert.equal(isThemeEligible('aurora', level), false, `Level ${level} remains below Rank 03`);
  for (const level of [50, 74, 75, 100, 120]) assert.equal(isThemeEligible('aurora', level), true, `Level ${level} qualifies for Aurora`);
  assert.equal(getEligibleTheme('aurora', 49), 'dark-navy');
  assert.equal(getEligibleTheme('aurora', 50), 'aurora');
});

test('Eclipse requires current Rank 02 Zenith or higher and future themes remain unavailable', () => {
  assert.equal(isThemeId('eclipse'), true);
  assert.equal(THEME_ENTITLEMENTS.eclipse.requiredRank, 'zenith');
  for (const level of [0, 9, 10, 19, 20, 34, 35, 49, 50, 74]) {
    assert.equal(isThemeEligible('eclipse', level), false, `Level ${level} remains below Rank 02`);
  }
  for (const level of [75, 100, 120]) assert.equal(isThemeEligible('eclipse', level), true, `Level ${level} qualifies for Eclipse`);
  assert.equal(getEligibleTheme('eclipse', 74), 'dark-navy');
  assert.equal(getEligibleTheme('eclipse', 75), 'eclipse');
});

test('Eclipse unlock does not alter lower theme eligibility', () => {
  assert.equal(isThemeEligible('obsidian', 20), true);
  assert.equal(isThemeEligible('obsidian', 19), false);
  assert.equal(isThemeEligible('aurora', 50), true);
  assert.equal(isThemeId('galaxion'), true);
  assert.equal(isThemeId('waterfury'), false);
  assert.equal(isThemeId('nexus-prime'), false);
});

test('Galaxion requires current Rank 01 Continuum and falls back on demotion', () => {
  assert.equal(THEME_ENTITLEMENTS.galaxion.requiredRank, 'continuum');
  assert.equal(THEME_ENTITLEMENTS.galaxion.requiredRankLabel, 'Rank 01 — Continuum');
  for (const level of [0, 9, 10, 19, 20, 34, 35, 49, 50, 74, 75, 99]) {
    assert.equal(isThemeEligible('galaxion', level), false, `Level ${level} remains below Rank 01`);
    assert.equal(getEligibleTheme('galaxion', level), 'dark-navy');
  }
  for (const level of [100, 101, 120]) assert.equal(isThemeEligible('galaxion', level), true, `Level ${level} qualifies for Galaxion`);
  assert.equal(getEligibleTheme('galaxion', 100), 'galaxion');
  assert.equal(getEligibleTheme('galaxion', 99), 'dark-navy');
});

test('a Level 100 Rank 01 account is eligible for all five registered themes', () => {
  for (const themeId of ['dark-navy', 'obsidian', 'aurora', 'eclipse', 'galaxion']) {
    assert.equal(isThemeEligible(themeId, 100), true, `${themeId} is available at Rank 01`);
  }
});

test('legacy Rank 01 theme preferences migrate only when the current Rank qualifies', () => {
  assert.equal(isThemeId('nexus-prime'), false, 'the replaced theme is no longer available');
  assert.equal(isThemeId('waterfury'), false, 'legacy WaterFury is no longer available as a selectable theme');
  assert.equal(isThemeEligible('nexus-prime', 100), false, 'legacy identifiers cannot be applied by clients');
  assert.equal(getEligibleTheme('nexus-prime', 100), 'galaxion');
  assert.equal(getEligibleTheme('nexus-prime', 99), 'dark-navy');
  assert.equal(getEligibleTheme('waterfury', 100), 'galaxion');
  assert.equal(getEligibleTheme('waterfury', 99), 'dark-navy');
});
