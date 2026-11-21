// Versioned, authoritative progression rewards. Keep server calculations and
// API configuration DTOs sourced from this single table.
export const PROGRESSION_CONFIGURATION = Object.freeze({
  version: 'm22-v1',
  xp: Object.freeze({
    baseRequirement: 100,
    growthRate: 0.05,
    dailyTaskPoolCents: 30_000,
    recoveryQuestDrainBasisPoints: 700,
    decimalPlaces: 2,
  }),
  dailyXpCapsCents: Object.freeze({
    origin: 30_000,
    ember: 40_000,
    surge: 50_000,
    vector: 60_000,
    apex: 70_000,
    zenith: 90_000,
    continuum: 110_000,
  }),
  ranks: Object.freeze([
    Object.freeze({ slug: 'origin', number: '07', name: 'Origin', minimumLevel: 0, cumulativeXpThreshold: 0, multiplierBasisPoints: 10_000, entryXpCents: 0, entryDpCents: 0, accentColor: '#78C9F2', recurringDpPreview: Object.freeze({ qualifyingDays: 30, rewardDpCents: 25 }) }),
    Object.freeze({ slug: 'ember', number: '06', name: 'Ember', minimumLevel: 10, cumulativeXpThreshold: 1_262, multiplierBasisPoints: 11_000, entryXpCents: 164_240, entryDpCents: 10, accentColor: '#FF9857', recurringDpPreview: Object.freeze({ qualifyingDays: 35, rewardDpCents: 40 }) }),
    Object.freeze({ slug: 'surge', number: '05', name: 'Surge', minimumLevel: 20, cumulativeXpThreshold: 3_315, multiplierBasisPoints: 12_000, entryXpCents: 458_720, entryDpCents: 20, accentColor: '#54D7C5', recurringDpPreview: Object.freeze({ qualifyingDays: 40, rewardDpCents: 50 }) }),
    Object.freeze({ slug: 'vector', number: '04', name: 'Vector', minimumLevel: 35, cumulativeXpThreshold: 9_049, multiplierBasisPoints: 13_000, entryXpCents: 952_880, entryDpCents: 30, accentColor: '#579EFF', recurringDpPreview: Object.freeze({ qualifyingDays: 45, rewardDpCents: 60 }) }),
    Object.freeze({ slug: 'apex', number: '03', name: 'Apex', minimumLevel: 50, cumulativeXpThreshold: 20_960, multiplierBasisPoints: 14_000, entryXpCents: 4_379_360, entryDpCents: 40, accentColor: '#A38BFF', recurringDpPreview: Object.freeze({ qualifyingDays: 50, rewardDpCents: 70 }) }),
    Object.freeze({ slug: 'zenith', number: '02', name: 'Zenith', minimumLevel: 75, cumulativeXpThreshold: 75_702, multiplierBasisPoints: 15_000, entryXpCents: 14_828_000, entryDpCents: 55, accentColor: '#F2C96B', recurringDpPreview: Object.freeze({ qualifyingDays: 55, rewardDpCents: 80 }) }),
    Object.freeze({ slug: 'continuum', number: '01', name: 'Continuum', minimumLevel: 100, cumulativeXpThreshold: 261_052, multiplierBasisPoints: 16_000, entryXpCents: null, entryDpCents: 75, accentColor: '#F0443E', recurringDpPreview: Object.freeze({ qualifyingDays: 60, rewardDpCents: 90 }) }),
  ]),
  disciplinePointWalletCapCents: 400,
});

export const PROGRESSION_RANKS = PROGRESSION_CONFIGURATION.ranks;
export const PROGRESSION_RANK_BY_SLUG = Object.freeze(Object.fromEntries(PROGRESSION_RANKS.map((rank) => [rank.slug, rank])));

const xpAmount = (cents) => cents === null ? null : (cents / 100).toFixed(2);
export function toRankBenefitDto(rank) {
  if (!rank) return null;
  const multiplier = rank.multiplierBasisPoints / 10_000;
  return {
    slug: rank.slug,
    number: rank.number,
    name: rank.name,
    minimumLevel: rank.minimumLevel,
    cumulativeXpThreshold: rank.cumulativeXpThreshold,
    multiplier,
    multiplierLabel: `${multiplier.toFixed(2)}×`,
    dailyXpCap: xpAmount(PROGRESSION_CONFIGURATION.dailyXpCapsCents[rank.slug]),
    entryXp: xpAmount(rank.entryXpCents),
    entryXpConfigured: rank.entryXpCents !== null,
    entryDp: xpAmount(rank.entryDpCents),
    recurringDpPreview: {
      qualifyingDays: rank.recurringDpPreview.qualifyingDays,
      rewardDp: xpAmount(rank.recurringDpPreview.rewardDpCents),
    },
    accentColor: rank.accentColor,
  };
}

export function getProgressionConfigurationDto() {
  return {
    version: PROGRESSION_CONFIGURATION.version,
    xp: {
      ...PROGRESSION_CONFIGURATION.xp,
      dailyTaskPool: xpAmount(PROGRESSION_CONFIGURATION.xp.dailyTaskPoolCents),
      recoveryQuestDrainRate: `${(PROGRESSION_CONFIGURATION.xp.recoveryQuestDrainBasisPoints / 100).toFixed(2)}%`,
    },
    disciplinePointWalletCap: xpAmount(PROGRESSION_CONFIGURATION.disciplinePointWalletCapCents),
    ranks: PROGRESSION_RANKS.map(toRankBenefitDto),
  };
}
