import { ranks } from './ranks.js';

export const DISCIPLINE_TASK_MINIMUM = 5;
export const DISCIPLINE_POINTS_CAP = 4;
export const DISCIPLINE_POINTS_START = 1.25;
export const GRACE_POINT_START = 3;
export const GRACE_REDEMPTION_COOLDOWN_HOURS = 72;
export const RECOVERY_QUEST_XP_DRAIN_RATE = 0.07;

// Frontend demonstration curve: explicit early step requirements with a rising extension for later Levels.
export const LEVEL_XP_CONFIG = Object.freeze({
  initialRequirements: Object.freeze([250, 350, 400, 800, 1000, 1300, 1600, 1900, 2200, 2500]),
  laterLevelIncrease: 300,
});

const rewardRows = [
  ['origin', 30, 0.25, 0.50, 0],
  ['ember', 35, 0.40, 0.75, 0.10],
  ['surge', 40, 0.50, 1.00, 0.20],
  ['vector', 45, 0.60, 1.25, 0.30],
  ['apex', 50, 0.70, 1.50, 0.40],
  ['zenith', 55, 0.80, 1.75, 0.55],
  ['continuum', 60, 0.90, 2.00, 0.75],
];

export const RANK_DISCIPLINE_CONFIG = Object.freeze(Object.fromEntries(rewardRows.map(([slug, cycleDays, recurringDp, dailyXpPercent, entryDp]) => {
  const rank = ranks.find((item) => item.slug === slug);
  return [slug, Object.freeze({
    id: rank.slug,
    number: rank.number,
    name: rank.name,
    progressionOrder: rank.progressionOrder,
    color: rank.color,
    cycleDays,
    recurringDp,
    dailyXpPercent,
    entryDp,
    entryXp: Object.freeze({ status: 'pending', amount: null }),
  })];
})));

export function getRankDisciplineConfig(rankSlug) {
  return RANK_DISCIPLINE_CONFIG[rankSlug] || RANK_DISCIPLINE_CONFIG.origin;
}
