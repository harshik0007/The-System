import mongoose from 'mongoose';
import { getIstDateKey, isValidIstDateKey } from '../utils/ist.js';
import { RANK_SLUGS } from '../utils/ranks.js';
import { EMERGENCY_PAUSE_ALLOWANCE } from '../config/emergencyPauseConfiguration.js';

const { Schema } = mongoose;
const integerAtLeastZero = (value) => Number.isInteger(value) && value >= 0;

const emergencyPauseSchema = new Schema({
  active: { type: Boolean, default: false, required: true },
  pauseId: { type: Schema.Types.ObjectId, ref: 'EmergencyPause', default: null },
  allowanceMonthKey: { type: String, default: null, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
  activationsUsed: { type: Number, default: 0, min: 0, max: EMERGENCY_PAUSE_ALLOWANCE, validate: Number.isInteger, required: true },
  selectedDurationDays: { type: Number, default: null, min: 1, max: 7, validate: (value) => value == null || Number.isInteger(value) },
  activatedAt: { type: Date, default: null },
  resumesAt: { type: Date, default: null },
}, { _id: false });

const rewardCycleSchema = new Schema({
  cycleNumber: { type: Number, default: 0, min: 0, validate: Number.isInteger, required: true },
  qualifiedDays: { type: Number, default: 0, min: 0, validate: Number.isInteger, required: true },
  rewardCycleId: { type: Schema.Types.ObjectId, ref: 'DisciplineRewardCycle', default: null },
  rankSlug: { type: String, enum: [...RANK_SLUGS, null], default: null },
  requiredQualifyingDays: { type: Number, default: null, min: 1, validate: (value) => value == null || Number.isInteger(value) },
  rewardDpCents: { type: Number, default: null, min: 0, validate: (value) => value == null || Number.isInteger(value) },
  startedOn: { type: String, default: null, validate: (value) => value == null || isValidIstDateKey(value) },
}, { _id: false });

const progressionRunSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true, index: true },
  runNumber: { type: Number, required: true, min: 1, validate: Number.isInteger, immutable: true },
  status: { type: String, enum: ['active', 'ended'], default: 'active', required: true },
  startedAt: { type: Date, default: Date.now, required: true, immutable: true },
  startedOn: {
    type: String,
    default: () => getIstDateKey(),
    required: true,
    immutable: true,
    validate: { validator: isValidIstDateKey, message: 'startedOn must be a valid IST YYYY-MM-DD date.' },
  },
  endedAt: { type: Date, default: null },
  endedOn: { type: String, default: null, validate: (value) => value == null || isValidIstDateKey(value) },
  endReason: { type: String, enum: ['automatic-grace-exhaustion', 'manual-reset-and-restart', null], default: null },
  currentRankSlug: { type: String, enum: RANK_SLUGS, default: 'origin', required: true },
  level: { type: Number, default: 0, min: 0, validate: Number.isInteger, required: true },
  totalXp: { type: Number, default: 0, min: 0, validate: (value) => Number.isFinite(value) && Math.abs(value * 100 - Math.round(value * 100)) < 1e-7, required: true },
  gracePoints: { type: Number, default: 3, min: 0, validate: Number.isInteger, required: true },
  disciplinePoints: { type: Number, default: 0, min: 0, max: 4, required: true },
  currentStreak: { type: Number, default: 0, min: 0, validate: Number.isInteger, required: true },
  longestStreak: { type: Number, default: 0, min: 0, validate: Number.isInteger, required: true },
  disciplineStartedOn: { type: String, default: null, validate: (value) => value == null || isValidIstDateKey(value) },
  lastFinalizedDisciplineDate: { type: String, default: null, validate: (value) => value == null || isValidIstDateKey(value) },
  rewardCycle: { type: rewardCycleSchema, default: () => ({}) },
  dpRedemptionCooldownUntil: { type: Date, default: null },
  dpRedemptionLastAt: { type: Date, default: null },
  taskScheduleId: { type: Schema.Types.ObjectId, ref: 'TaskSchedule', default: null },
  emergencyPause: { type: emergencyPauseSchema, default: () => ({}) },
  // The date of the last eligible IST reset processed for Recovery Quest lifecycle.
  recoveryQuestLastResetDate: {
    type: String,
    default: null,
    validate: (value) => value == null || isValidIstDateKey(value),
  },
  resetConfigurationVersion: { type: String, default: 'initial', required: true },
}, {
  timestamps: true,
  collection: 'progression_runs',
  versionKey: false,
});

progressionRunSchema.path('currentStreak').validate(integerAtLeastZero, 'currentStreak must be a non-negative integer.');
progressionRunSchema.path('longestStreak').validate(integerAtLeastZero, 'longestStreak must be a non-negative integer.');
progressionRunSchema.path('totalXp').validate((value) => Number.isFinite(value) && Math.abs(value * 100 - Math.round(value * 100)) < 1e-7, 'totalXp must have no more than two decimal places.');
progressionRunSchema.index({ userId: 1, runNumber: 1 }, { unique: true, name: 'runs_user_number_unique' });
progressionRunSchema.index(
  { userId: 1 },
  { unique: true, name: 'runs_one_active_per_user', partialFilterExpression: { status: 'active' } },
);

export default mongoose.models.ProgressionRun || mongoose.model('ProgressionRun', progressionRunSchema);
