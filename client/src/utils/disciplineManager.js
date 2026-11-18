import {
  DISCIPLINE_POINTS_CAP,
  DISCIPLINE_POINTS_START,
  DISCIPLINE_TASK_MINIMUM,
  GRACE_REDEMPTION_COOLDOWN_HOURS,
  RANK_DISCIPLINE_CONFIG,
  RECOVERY_QUEST_XP_DRAIN_RATE,
  getRankDisciplineConfig,
  LEVEL_XP_CONFIG,
} from '../data/disciplineConfig.js';
import { getIstDateKey } from './taskScheduleBuilder.js';

const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const makeId = (prefix, suffix) => `${prefix}:${suffix}`;

export function getLevelFromTotalXp(totalXp) {
  const safeXp = Math.max(0, Number(totalXp) || 0);
  let low = 0;
  let high = 1;
  while (getLevelThreshold(high) <= safeXp) high *= 2;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if (getLevelThreshold(middle) <= safeXp) low = middle;
    else high = middle;
  }
  return low;
}

export function getLevelXpRequirement(level) {
  const index = Math.max(0, Math.floor(Number(level) || 0));
  const { initialRequirements, laterLevelIncrease } = LEVEL_XP_CONFIG;
  if (index < initialRequirements.length) return initialRequirements[index];
  return initialRequirements.at(-1) + (index - initialRequirements.length + 1) * laterLevelIncrease;
}

export function getLevelThreshold(level) {
  const target = Math.max(0, Math.floor(Number(level) || 0));
  const { initialRequirements, laterLevelIncrease } = LEVEL_XP_CONFIG;
  const initialCount = Math.min(target, initialRequirements.length);
  const initialTotal = initialRequirements.slice(0, initialCount).reduce((total, requirement) => total + requirement, 0);
  const additionalCount = target - initialCount;
  if (!additionalCount) return initialTotal;
  const firstAdditional = initialRequirements.at(-1) + laterLevelIncrease;
  const additionalTotal = additionalCount * (2 * firstAdditional + (additionalCount - 1) * laterLevelIncrease) / 2;
  return initialTotal + additionalTotal;
}

export function getLevelProgress(totalXp) {
  const level = getLevelFromTotalXp(totalXp);
  const start = getLevelThreshold(level);
  const requirement = getLevelXpRequirement(level);
  return {
    level,
    requirement,
    earnedInLevel: Math.max(0, round2(totalXp - start)),
    percent: Math.min(100, Math.max(0, Math.round(((totalXp - start) / requirement) * 100))),
  };
}

function rankAchievementRecord(rank, lastAchievedOn) {
  if (!rank) return null;
  return {
    rankSlug: rank.id,
    rankNumber: rank.number,
    rankName: rank.name,
    progressionOrder: rank.progressionOrder,
    ...(lastAchievedOn ? { lastAchievedOn } : {}),
  };
}

export function getHighestRankAchieved(state) {
  const currentRank = RANK_DISCIPLINE_CONFIG[state?.currentRankSlug];
  const savedRank = RANK_DISCIPLINE_CONFIG[state?.highestRankAchieved?.rankSlug];
  const eventRanks = (state?.rankEntryEvents || [])
    .map((event) => RANK_DISCIPLINE_CONFIG[event.rankSlug])
    .filter(Boolean);
  const candidates = [currentRank, savedRank, ...eventRanks].filter(Boolean);
  const highestRank = candidates.reduce((highest, rank) => !highest || rank.progressionOrder > highest.progressionOrder ? rank : highest, null);
  if (!highestRank) return null;

  const lastEventDate = (state?.rankEntryEvents || [])
    .filter((event) => event.rankSlug === highestRank.id && event.date)
    .map((event) => event.date)
    .sort()
    .at(0);
  const lastAchievedOn = (state?.highestRankAchieved?.rankSlug === highestRank.id
    ? state.highestRankAchieved.lastAchievedOn
    : null) || lastEventDate;
  return rankAchievementRecord(highestRank, lastAchievedOn);
}

export function normalizeHighestRankAchieved(state) {
  if (!state) return state;
  const highestRankAchieved = getHighestRankAchieved(state);
  if (!highestRankAchieved) return state;
  const existing = state.highestRankAchieved;
  if (existing?.rankSlug === highestRankAchieved.rankSlug
    && existing?.rankNumber === highestRankAchieved.rankNumber
    && existing?.rankName === highestRankAchieved.rankName
    && existing?.progressionOrder === highestRankAchieved.progressionOrder) return state;
  return { ...state, highestRankAchieved };
}

export function createDisciplineState({ now = new Date(), rankSlug = 'continuum', totalXp = 1240, dpBalance = DISCIPLINE_POINTS_START } = {}) {
  const rank = getRankDisciplineConfig(rankSlug);
  const dateKey = getIstDateKey(now);
  const cycle = { rankSlug, requiredDays: rank.cycleDays, rewardDp: rank.recurringDp, progress: 0, completedCycles: 0 };
  return {
    memberSince: dateKey,
    currentRunStartedDate: dateKey,
    lastObservedDate: dateKey,
    lastProcessedDate: null,
    dailyRecords: {},
    currentRankSlug: rankSlug,
    highestRankAchieved: rankAchievementRecord(RANK_DISCIPLINE_CONFIG[rankSlug]),
    personalBestCaptureEnabled: true,
    progressionRunId: `run-${dateKey}-demo`,
    claimedRankEntryIds: [],
    currentStreak: 0,
    longestStreak: 0,
    totalQualifyingDays: 0,
    totalCompletedScheduledTasks: 0,
    lastQualifyingDate: null,
    lastStreakBreakDate: null,
    cycle,
    dpBalance: round2(Math.min(DISCIPLINE_POINTS_CAP, Math.max(0, dpBalance))),
    dpEvents: [],
    rankEntryEvents: [],
    dailyRankXpEvents: [],
    xpDrainEvents: [],
    levelDownEvents: [],
    xpHistory: [],
    totalXp: Math.max(0, Number(totalXp) || 0),
    redemptionEvents: [],
    lastRedemptionAt: null,
  };
}

function nextCycleForRank(rankSlug, completedCycles = 0) {
  const config = getRankDisciplineConfig(rankSlug);
  return { rankSlug, requiredDays: config.cycleDays, rewardDp: config.recurringDp, progress: 0, completedCycles };
}

function awardDp(state, { eventId, kind, dateKey, configuredAmount, title }) {
  const before = state.dpBalance;
  const amount = round2(Math.min(Math.max(0, configuredAmount), Math.max(0, DISCIPLINE_POINTS_CAP - before)));
  const event = {
    id: eventId,
    progressionRunId: state.progressionRunId,
    kind,
    date: dateKey,
    title,
    configuredAmount,
    amount,
    balanceBefore: before,
    balanceAfter: round2(Math.min(DISCIPLINE_POINTS_CAP, before + amount)),
  };
  return { ...state, dpBalance: event.balanceAfter, dpEvents: [event, ...state.dpEvents] };
}

export function calculateRecoveryQuestXpDrain(levelRequirement, activeQuestCount) {
  return round2(Math.max(0, Number(levelRequirement) || 0) * RECOVERY_QUEST_XP_DRAIN_RATE * Math.max(0, Math.floor(Number(activeQuestCount) || 0)));
}

export function processDailyReset(state, {
  dateKey,
  scheduledTaskCount = 0,
  completedTaskCount = 0,
  activeRecoveryQuestCount = 0,
  emergencyPause = false,
} = {}) {
  if (!dateKey || state.dailyRecords[dateKey]) return { state, duplicate: true, record: state.dailyRecords[dateKey] || null };

  const scheduled = Math.max(0, Math.floor(scheduledTaskCount));
  const completed = Math.min(scheduled, Math.max(0, Math.floor(completedTaskCount)));
  const protectedDay = Boolean(emergencyPause);
  const qualified = protectedDay || completed >= DISCIPLINE_TASK_MINIMUM;
  const rankAtReset = getRankDisciplineConfig(state.currentRankSlug);
  let recurringRewardAwarded = 0;
  let next = { ...state, dailyRecords: { ...state.dailyRecords } };
  next.totalCompletedScheduledTasks += completed;

  if (qualified) {
    next.currentStreak += 1;
    next.longestStreak = Math.max(next.longestStreak, next.currentStreak);
    next.totalQualifyingDays += 1;
    next.lastQualifyingDate = dateKey;
    next.cycle = { ...next.cycle, progress: next.cycle.progress + 1 };
    if (next.cycle.progress >= next.cycle.requiredDays) {
      const eventId = makeId('recurring-dp', `${dateKey}:${next.cycle.rankSlug}:${next.cycle.completedCycles + 1}`);
      next = awardDp(next, {
        eventId,
        kind: 'recurring',
        dateKey,
        configuredAmount: next.cycle.rewardDp,
        title: `Rank ${getRankDisciplineConfig(next.cycle.rankSlug).number} ${getRankDisciplineConfig(next.cycle.rankSlug).name} Discipline cycle reward`,
      });
      recurringRewardAwarded = next.dpEvents[0]?.amount || 0;
      next.cycle = nextCycleForRank(next.currentRankSlug, next.cycle.completedCycles + 1);
    }
  } else {
    next.currentStreak = 0;
    next.lastStreakBreakDate = dateKey;
    next.cycle = nextCycleForRank(next.currentRankSlug, next.cycle.completedCycles);
  }

  const levelBeforeDrain = getLevelFromTotalXp(next.totalXp);
  const xpRequirement = getLevelXpRequirement(levelBeforeDrain);
  const activeCount = Math.max(0, Math.floor(activeRecoveryQuestCount));
  const xpDrained = protectedDay ? 0 : calculateRecoveryQuestXpDrain(xpRequirement, activeCount);
  const xpBeforeDrain = next.totalXp;
  next.totalXp = Math.max(0, round2(next.totalXp - xpDrained));
  const levelAfterDrain = getLevelFromTotalXp(next.totalXp);
  const drainEvent = {
    id: makeId('recovery-xp-drain', dateKey),
    progressionRunId: state.progressionRunId,
    date: dateKey,
    activeRecoveryQuestCount: activeCount,
    emergencyPause: protectedDay,
    levelAtCalculation: levelBeforeDrain,
    levelRequirement: xpRequirement,
    ratePerQuest: RECOVERY_QUEST_XP_DRAIN_RATE,
    amount: round2(xpBeforeDrain - next.totalXp),
    totalXpBefore: xpBeforeDrain,
    totalXpAfter: next.totalXp,
  };
  next.xpDrainEvents = [drainEvent, ...next.xpDrainEvents];
  next.xpHistory = [{ id: drainEvent.id, progressionRunId: state.progressionRunId, date: dateKey, kind: 'recovery-drain', amount: -drainEvent.amount, totalAfter: next.totalXp }, ...next.xpHistory];

  if (levelAfterDrain < levelBeforeDrain) {
    const events = [];
    for (let level = levelBeforeDrain; level > levelAfterDrain; level -= 1) {
      events.push({ id: makeId('level-down', `${dateKey}:${level}`), progressionRunId: state.progressionRunId, date: dateKey, fromLevel: level, toLevel: level - 1, totalXp: next.totalXp });
    }
    next.levelDownEvents = [...events, ...next.levelDownEvents];
  }

  const dailyXpAmount = Math.max(0, Math.round(getLevelXpRequirement(levelAfterDrain) * rankAtReset.dailyXpPercent / 100));
  const dailyXpEvent = {
    id: makeId('daily-rank-xp', dateKey),
    progressionRunId: state.progressionRunId,
    date: dateKey,
    rankSlug: next.currentRankSlug,
    rankName: rankAtReset.name,
    levelAtAward: levelAfterDrain,
    levelRequirement: getLevelXpRequirement(levelAfterDrain),
    percentage: rankAtReset.dailyXpPercent,
    amount: dailyXpAmount,
    totalXpBefore: next.totalXp,
    totalXpAfter: round2(next.totalXp + dailyXpAmount),
    rounding: 'nearest integer (Math.round)',
  };
  next.totalXp = dailyXpEvent.totalXpAfter;
  next.dailyRankXpEvents = [dailyXpEvent, ...next.dailyRankXpEvents];
  next.xpHistory = [{ id: dailyXpEvent.id, progressionRunId: state.progressionRunId, date: dateKey, kind: 'daily-rank-bonus', amount: dailyXpAmount, totalAfter: next.totalXp }, ...next.xpHistory];

  const record = {
    date: dateKey,
    progressionRunId: state.progressionRunId,
    hasDailyResetRecord: true,
    scheduledTaskCount: scheduled,
    completedTaskCount: completed,
    completionPercent: scheduled ? Math.round((completed / scheduled) * 100) : 0,
    qualifies: qualified,
    qualificationStatus: protectedDay ? 'emergency-pause-protected' : qualified ? 'qualified' : 'not-qualified',
    emergencyPause: protectedDay,
    xpDrained: drainEvent.amount,
    dailyRankXpAwarded: dailyXpAmount,
    dpRewardAwarded: recurringRewardAwarded,
    activeRecoveryQuestCount: activeCount,
    levelAfterReset: getLevelFromTotalXp(next.totalXp),
  };
  next.dailyRecords[dateKey] = record;
  next.lastProcessedDate = dateKey;
  return { state: next, duplicate: false, record };
}

export function enterHigherRank(state, rankSlug, dateKey = getIstDateKey()) {
  const target = RANK_DISCIPLINE_CONFIG[rankSlug];
  const current = getRankDisciplineConfig(state.currentRankSlug);
  if (!target || target.progressionOrder <= current.progressionOrder) return { state, event: null, reason: 'not-a-higher-rank' };

  const claimId = `${state.progressionRunId}:${target.id}`;
  if (state.claimedRankEntryIds.includes(claimId)) return { state, event: null, reason: 'already-claimed' };
  const highestRankAchieved = getHighestRankAchieved(state);
  const nextHighestRank = !highestRankAchieved || target.progressionOrder > highestRankAchieved.progressionOrder
    ? rankAchievementRecord(target, dateKey)
    : highestRankAchieved;
  let next = { ...state, currentRankSlug: target.id, highestRankAchieved: nextHighestRank, claimedRankEntryIds: [...state.claimedRankEntryIds, claimId] };
  const eventId = `rank-entry:${claimId}`;
  const beforeCount = next.dpEvents.length;
  if (target.entryDp > 0) {
    next = awardDp(next, { eventId, kind: 'rank-entry', dateKey, configuredAmount: target.entryDp, title: `Rank ${target.number} ${target.name} entry reward` });
  }
  const dpEvent = next.dpEvents.length > beforeCount ? next.dpEvents[0] : null;
  const event = {
    id: `rank-up:${claimId}`,
    date: dateKey,
    rankSlug: target.id,
    rankNumber: target.number,
    rankName: target.name,
    progressionRunId: state.progressionRunId,
    dpConfigured: target.entryDp,
    dpAwarded: dpEvent?.amount || 0,
    xpStatus: 'pending',
    xpAwarded: null,
  };
  next.rankEntryEvents = [event, ...next.rankEntryEvents];
  // The active cycle snapshot is intentionally unchanged. The new Rank config is used when that cycle finishes.
  return { state: next, event, reason: null };
}

export function startProgressionRun(state, { runId = `run-${Date.now()}`, rankSlug = 'origin' } = {}) {
  if (!RANK_DISCIPLINE_CONFIG[rankSlug]) return state;
  return { ...state, progressionRunId: runId, currentRankSlug: rankSlug };
}

export function redeemGracePoint(state, recoveryState, now = Date.now()) {
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  const cooldownMs = GRACE_REDEMPTION_COOLDOWN_HOURS * 60 * 60 * 1000;
  const lastAt = state.lastRedemptionAt ? new Date(state.lastRedemptionAt).getTime() : 0;
  if (nowMs - lastAt < cooldownMs) return { state, recoveryState, success: false, reason: 'cooldown' };
  if (state.dpBalance < 1) return { state, recoveryState, success: false, reason: 'insufficient-dp' };
  const date = new Date(nowMs).toISOString();
  const event = {
    id: `grace-redemption:${date}`,
    progressionRunId: state.progressionRunId,
    date: getIstDateKey(new Date(nowMs)),
    at: date,
    dpSpent: 1,
    gracePointsAdded: 1,
    dpBalanceBefore: state.dpBalance,
    dpBalanceAfter: round2(state.dpBalance - 1),
    gracePointsBefore: recoveryState.gracePoints,
    gracePointsAfter: recoveryState.gracePoints + 1,
  };
  return {
    state: { ...state, dpBalance: event.dpBalanceAfter, lastRedemptionAt: date, redemptionEvents: [event, ...state.redemptionEvents] },
    recoveryState: { ...recoveryState, gracePoints: event.gracePointsAfter },
    success: true,
    event,
    reason: null,
  };
}

export function getRedemptionCooldownRemaining(state, now = Date.now()) {
  if (!state.lastRedemptionAt) return 0;
  return Math.max(0, new Date(state.lastRedemptionAt).getTime() + GRACE_REDEMPTION_COOLDOWN_HOURS * 60 * 60 * 1000 - Number(now));
}

export function getQualifyingCycleSummary(state) {
  const config = getRankDisciplineConfig(state.currentRankSlug);
  return {
    rank: config,
    cycle: state.cycle,
    remainingDays: Math.max(0, state.cycle.requiredDays - state.cycle.progress),
    nextCycleConfig: getRankDisciplineConfig(state.currentRankSlug),
    entryReward: config.entryDp,
    entryXp: config.entryXp,
    rankConfigurations: Object.values(RANK_DISCIPLINE_CONFIG),
  };
}
