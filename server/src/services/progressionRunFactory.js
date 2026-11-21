import ProgressionRun from '../models/ProgressionRun.js';
import { PROGRESSION_RANK_BY_SLUG } from '../config/progressionConfiguration.js';
import { getIstDateKey, getIstMonthKey } from '../utils/ist.js';
import { startDisciplineForNewRunWithinSession } from './disciplineService.js';

export function getInitialProgressionState(reviewMode = false) {
  if (!reviewMode) return { currentRankSlug: 'origin', level: 0, totalXp: 0 };
  const continuum = PROGRESSION_RANK_BY_SLUG.continuum;
  return {
    currentRankSlug: continuum.slug,
    level: continuum.minimumLevel,
    totalXp: continuum.cumulativeXpThreshold,
  };
}

/** Create the approved clean-run baseline inside the caller's transaction. */
export async function createFreshProgressionRunWithinSession({
  userId,
  runNumber,
  startedAt = new Date(),
  emergencyPauseActivationsUsed = 0,
  reviewMode = false,
  session,
}) {
  if (!session) throw new TypeError('Fresh Progression Run creation requires the caller transaction session.');
  if (!Number.isInteger(runNumber) || runNumber < 1) throw new TypeError('A valid Progression Run number is required.');

  const instant = new Date(startedAt);
  const startedOn = getIstDateKey(instant);
  const initialProgression = getInitialProgressionState(reviewMode === true);
  const [run] = await ProgressionRun.create([{
    userId,
    runNumber,
    status: 'active',
    startedAt: instant,
    startedOn,
    ...initialProgression,
    gracePoints: 3,
    disciplinePoints: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastFinalizedDisciplineDate: null,
    rewardCycle: { cycleNumber: 0, qualifiedDays: 0 },
    dpRedemptionCooldownUntil: null,
    dpRedemptionLastAt: null,
    disciplineStartedOn: startedOn,
    taskScheduleId: null,
    emergencyPause: {
      active: false,
      allowanceMonthKey: getIstMonthKey(instant),
      activationsUsed: emergencyPauseActivationsUsed,
      activatedAt: null,
      resumesAt: null,
    },
    recoveryQuestLastResetDate: startedOn,
    resetConfigurationVersion: 'milestone-21',
  }], { session });

  await startDisciplineForNewRunWithinSession({ userId, run, startDate: startedOn, session });
  return run;
}
