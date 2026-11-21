import { getRankProgressionOrder, getRankSlugForLevel } from './ranks.js';

export const THEME_ENTITLEMENTS = Object.freeze({
  'dark-navy': Object.freeze({ requiredRank: null }),
  obsidian: Object.freeze({ requiredRank: 'surge', requiredRankLabel: 'Rank 05 — Surge or higher' }),
  aurora: Object.freeze({ requiredRank: 'apex', requiredRankLabel: 'Rank 03 — Apex or higher' }),
  eclipse: Object.freeze({ requiredRank: 'zenith', requiredRankLabel: 'Rank 02 — Zenith or higher' }),
  galaxion: Object.freeze({ requiredRank: 'continuum', requiredRankLabel: 'Rank 01 — Continuum' }),
});

export const DEFAULT_THEME = 'dark-navy';

export function isThemeId(value) {
  return Object.hasOwn(THEME_ENTITLEMENTS, value);
}

export function isThemeEligible(themeId, level = 0) {
  const entitlement = THEME_ENTITLEMENTS[themeId];
  if (!entitlement || !Number.isSafeInteger(Number(level)) || Number(level) < 0) return false;
  if (!entitlement.requiredRank) return true;

  // PROGRESSION_RANKS is ordered from the starting Rank 07 upward to Rank 01.
  // Compare that canonical progression order rather than the displayed rank number.
  const currentRankOrder = getRankProgressionOrder(getRankSlugForLevel(Number(level)));
  const requiredRankOrder = getRankProgressionOrder(entitlement.requiredRank);
  return currentRankOrder >= requiredRankOrder;
}

export function getEligibleTheme(themeId, level = 0) {
  // WaterFury and Nexus Prime are legacy persisted IDs. Resolve either at the
  // authoritative rank before returning a theme for storage or display.
  const canonicalThemeId = ['waterfury', 'nexus-prime'].includes(themeId) ? 'galaxion' : themeId;
  return isThemeEligible(canonicalThemeId, level) ? canonicalThemeId : DEFAULT_THEME;
}
