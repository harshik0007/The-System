import mongoose from 'mongoose';
import { isValidIstDateKey } from '../utils/ist.js';

const { Schema } = mongoose;

const allocationSchema = new Schema({
  occurrenceId: { type: Schema.Types.ObjectId, ref: 'TaskOccurrence', required: true, immutable: true },
  taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true, immutable: true },
  baseXpCents: { type: Number, required: true, min: 0, validate: Number.isInteger, immutable: true },
}, { _id: false });

const dailyTaskXpAllocationSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  progressionRunId: { type: Schema.Types.ObjectId, ref: 'ProgressionRun', required: true, immutable: true },
  date: { type: String, required: true, immutable: true, validate: isValidIstDateKey },
  totalBaseXpCents: { type: Number, required: true, min: 0, validate: Number.isInteger, immutable: true },
  scheduledOccurrenceCount: { type: Number, required: true, min: 1, validate: Number.isInteger, immutable: true },
  allocations: { type: [allocationSchema], required: true, immutable: true },
  configurationVersion: { type: String, required: true, immutable: true },
  createdAt: { type: Date, required: true, immutable: true },
}, { collection: 'daily_task_xp_allocations', versionKey: false });

dailyTaskXpAllocationSchema.index(
  { userId: 1, progressionRunId: 1, date: 1 },
  { unique: true, name: 'daily_task_xp_run_date_unique' },
);
dailyTaskXpAllocationSchema.index({ userId: 1, date: 1, 'allocations.occurrenceId': 1 }, { name: 'daily_task_xp_occurrence_lookup' });

export default mongoose.models.DailyTaskXpAllocation || mongoose.model('DailyTaskXpAllocation', dailyTaskXpAllocationSchema);
