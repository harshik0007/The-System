import { PROGRESSION_RANKS } from '../config/progressionConfiguration.js';

export const RANK_SLUGS = Object.freeze(PROGRESSION_RANKS.map((rank) => rank.slug));

export const RANK_HIGHEST_TO_LOWEST = Object.freeze([...RANK_SLUGS].reverse());
export const RANK_SET = new Set(RANK_SLUGS);

// Product-approved automatic Rank gates. Keep these aligned with the product rule table.
export const RANK_LEVEL_THRESHOLDS = Object.freeze(Object.fromEntries(PROGRESSION_RANKS.map((rank) => [rank.slug, rank.minimumLevel])));

export function getRankSlugForLevel(level) {
  const safeLevel = Math.max(0, Math.floor(Number(level) || 0));
  return RANK_SLUGS.reduce((rank, slug) => (safeLevel >= RANK_LEVEL_THRESHOLDS[slug] ? slug : rank), 'origin');
}

export function getRankProgressionOrder(rankSlug) {
  return RANK_SLUGS.indexOf(rankSlug);
}

export function getCurrentRankFromLevel(level) {
  const slug = getRankSlugForLevel(level);
  return PROGRESSION_RANKS.find((rank) => rank.slug === slug) || PROGRESSION_RANKS[0];
}

export function isRankSlug(value) {
  return RANK_SET.has(value);
}
