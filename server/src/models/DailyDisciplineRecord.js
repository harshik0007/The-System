import mongoose from 'mongoose';
import { isValidIstDateKey } from '../utils/ist.js';

const { Schema } = mongoose;
const dailyDisciplineRecordSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  progressionRunId: { type: Schema.Types.ObjectId, ref: 'ProgressionRun', required: true, immutable: true },
  date: { type: String, required: true, immutable: true, validate: isValidIstDateKey },
  scheduledOriginalTaskCount: { type: Number, required: true, min: 0, validate: Number.isInteger, immutable: true },
  completedOriginalTaskCount: { type: Number, required: true, min: 0, validate: Number.isInteger, immutable: true },
  qualificationStatus: { type: String, enum: ['qualified', 'not-qualified', 'emergency-pause-protected'], required: true, immutable: true },
  protectedByEmergencyPause: { type: Boolean, required: true, immutable: true },
  finalizedAt: { type: Date, required: true, immutable: true },
  currentStreakBefore: { type: Number, required: true, min: 0, validate: Number.isInteger, immutable: true },
  currentStreakAfter: { type: Number, required: true, min: 0, validate: Number.isInteger, immutable: true },
  runLongestStreakAfter: { type: Number, required: true, min: 0, validate: Number.isInteger, immutable: true },
  lifetimeLongestStreakAfter: { type: Number, required: true, min: 0, validate: Number.isInteger, immutable: true },
  rewardCycleId: { type: Schema.Types.ObjectId, ref: 'DisciplineRewardCycle', default: null, immutable: true },
  rewardCycleProgressBefore: { type: Number, default: null, min: 0, validate: (value) => value == null || Number.isInteger(value), immutable: true },
  rewardCycleProgressAfter: { type: Number, default: null, min: 0, validate: (value) => value == null || Number.isInteger(value), immutable: true },
  sourceOccurrenceIds: { type: [{ type: Schema.Types.ObjectId, ref: 'TaskOccurrence' }], default: () => [], immutable: true },
  sourceDailyResetId: { type: Schema.Types.ObjectId, ref: 'RecoveryQuestDailyReset', default: null, immutable: true },
  sourceEventKey: { type: String, required: true, maxlength: 200, immutable: true },
}, { collection: 'daily_discipline_records', timestamps: { createdAt: false, updatedAt: false }, versionKey: false });

dailyDisciplineRecordSchema.path('completedOriginalTaskCount').validate(function validateCompletedDoesNotExceedScheduled(value) {
  return value <= this.scheduledOriginalTaskCount;
}, 'completedOriginalTaskCount cannot exceed scheduledOriginalTaskCount.');
dailyDisciplineRecordSchema.index({ userId: 1, progressionRunId: 1, date: 1 }, { unique: true, name: 'daily_discipline_user_run_date_unique' });
dailyDisciplineRecordSchema.index({ userId: 1, progressionRunId: 1, date: -1 }, { name: 'daily_discipline_run_history' });
dailyDisciplineRecordSchema.index({ userId: 1, sourceEventKey: 1 }, { unique: true, name: 'daily_discipline_event_unique' });

export default mongoose.models.DailyDisciplineRecord || mongoose.model('DailyDisciplineRecord', dailyDisciplineRecordSchema);
