import mongoose from 'mongoose';
import { addIstCalendarDays, getIstMidnightInstant, isValidIstDateKey } from '../utils/ist.js';
import { RANK_SLUGS } from '../utils/ranks.js';

const { Schema } = mongoose;
const disciplineRewardCycleSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  progressionRunId: { type: Schema.Types.ObjectId, ref: 'ProgressionRun', required: true, immutable: true },
  cycleNumber: { type: Number, required: true, min: 1, validate: Number.isInteger, immutable: true },
  rankSlug: { type: String, enum: RANK_SLUGS, required: true, immutable: true },
  rankNumber: { type: String, required: true, immutable: true },
  rankName: { type: String, required: true, immutable: true },
  requiredQualifyingDays: { type: Number, required: true, min: 1, validate: Number.isInteger, immutable: true },
  completedQualifyingDays: { type: Number, required: true, min: 0, validate: Number.isInteger, default: 0 },
  rewardAmountCents: { type: Number, required: true, min: 0, validate: Number.isInteger, immutable: true },
  actualCreditedCents: { type: Number, default: null, min: 0, validate: (value) => value == null || Number.isInteger(value) },
  startDate: { type: String, required: true, immutable: true, validate: isValidIstDateKey },
  cycleStartedAt: { type: Date, default: null },
  baselineTargetDate: { type: String, default: null, validate: (value) => value == null || isValidIstDateKey(value) },
  baselineTargetAt: { type: Date, default: null },
  completionDate: { type: String, default: null, validate: (value) => value == null || isValidIstDateKey(value) },
  completedAt: { type: Date, default: null },
  status: { type: String, enum: ['active', 'completed'], required: true, default: 'active' },
  rewardTransactionId: { type: Schema.Types.ObjectId, ref: 'DisciplinePointTransaction', default: null },
  configurationVersion: { type: String, required: true, immutable: true },
}, { collection: 'discipline_reward_cycles', timestamps: true, versionKey: false });

disciplineRewardCycleSchema.path('completedQualifyingDays').validate(function validateCycleProgress(value) {
  return value <= this.requiredQualifyingDays;
}, 'completedQualifyingDays cannot exceed requiredQualifyingDays.');
disciplineRewardCycleSchema.path('cycleStartedAt').validate(function validateCycleStart(value) {
  return value == null || value.getTime() === getIstMidnightInstant(this.startDate).getTime();
}, 'cycleStartedAt must be the IST-midnight boundary for startDate.');
disciplineRewardCycleSchema.path('baselineTargetDate').validate(function validateCycleTargetDate(value) {
  return value == null || value === addIstCalendarDays(this.startDate, this.requiredQualifyingDays);
}, 'baselineTargetDate must follow the snapshotted qualifying-day requirement.');
disciplineRewardCycleSchema.path('baselineTargetAt').validate(function validateCycleTargetAt(value) {
  return value == null || (this.baselineTargetDate != null && value.getTime() === getIstMidnightInstant(this.baselineTargetDate).getTime());
}, 'baselineTargetAt must be the IST-midnight boundary for baselineTargetDate.');
disciplineRewardCycleSchema.index({ userId: 1, progressionRunId: 1, cycleNumber: 1 }, { unique: true, name: 'discipline_cycle_run_sequence_unique' });
disciplineRewardCycleSchema.index(
  { userId: 1, progressionRunId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'active' }, name: 'discipline_one_active_cycle_per_run' },
);
disciplineRewardCycleSchema.index({ userId: 1, progressionRunId: 1, createdAt: -1 }, { name: 'discipline_cycle_run_history' });

export default mongoose.models.DisciplineRewardCycle || mongoose.model('DisciplineRewardCycle', disciplineRewardCycleSchema);
