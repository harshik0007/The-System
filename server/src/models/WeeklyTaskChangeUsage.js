import mongoose from 'mongoose';
import { isValidIstDateKey } from '../utils/ist.js';

const { Schema } = mongoose;
const weeklyTaskChangeUsageSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  progressionRunId: { type: Schema.Types.ObjectId, ref: 'ProgressionRun', required: true, immutable: true },
  weekStartDate: { type: String, required: true, immutable: true, validate: isValidIstDateKey },
  usedCount: { type: Number, default: 0, min: 0, max: 3, validate: Number.isInteger, required: true },
  maximumSnapshot: { type: Number, default: 3, min: 3, max: 3, validate: Number.isInteger, required: true },
}, {
  timestamps: true,
  collection: 'weekly_task_change_usage',
  versionKey: false,
});

weeklyTaskChangeUsageSchema.index(
  { userId: 1, progressionRunId: 1, weekStartDate: 1 },
  { unique: true, name: 'weekly_task_usage_owner_run_week_unique' },
);

export default mongoose.models.WeeklyTaskChangeUsage || mongoose.model('WeeklyTaskChangeUsage', weeklyTaskChangeUsageSchema);
