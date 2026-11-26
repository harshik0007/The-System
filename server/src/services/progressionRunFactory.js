import ProgressionRun from '../models/ProgressionRun.js';
import { getIstDateKey, getIstMonthKey } from '../utils/ist.js';
import { startDisciplineForNewRunWithinSession } from './disciplineService.js';

export function getInitialProgressionState() {
  return { currentRankSlug: 'origin', level: 0, totalXp: 0 };
}

/** Create the approved clean-run baseline inside the caller's transaction. */
export async function createFreshProgressionRunWithinSession({
  userId,
  runNumber,
  startedAt = new Date(),
  emergencyPauseActivationsUsed = 0,
  session,
}) {
  if (!session) throw new TypeError('Fresh Progression Run creation requires the caller transaction session.');
  if (!Number.isInteger(runNumber) || runNumber < 1) throw new TypeError('A valid Progression Run number is required.');

  const instant = new Date(startedAt);
  const startedOn = getIstDateKey(instant);
  const initialProgression = getInitialProgressionState();
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
