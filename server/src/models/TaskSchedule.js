import mongoose from 'mongoose';
import { isValidIstDateKey } from '../utils/ist.js';

const { Schema } = mongoose;
const taskScheduleSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  progressionRunId: { type: Schema.Types.ObjectId, ref: 'ProgressionRun', required: true, immutable: true },
  cycleLength: { type: Number, required: true, min: 1, max: 7, validate: Number.isInteger },
  cycleAnchorDate: { type: String, required: true, validate: isValidIstDateKey },
  status: { type: String, enum: ['active', 'archived'], default: 'active', required: true },
  version: { type: Number, default: 1, min: 1, validate: Number.isInteger, required: true },
  effectiveStartDate: { type: String, required: true, validate: isValidIstDateKey },
  effectiveEndDate: { type: String, default: null, validate: (value) => value == null || isValidIstDateKey(value) },
  idempotencyKey: { type: String, required: true, trim: true, minlength: 8, maxlength: 160, immutable: true },
}, {
  timestamps: true,
  collection: 'task_schedules',
  versionKey: false,
});

taskScheduleSchema.index(
  { progressionRunId: 1 },
  { unique: true, name: 'task_schedules_one_active_per_run', partialFilterExpression: { status: 'active' } },
);
taskScheduleSchema.index(
  { userId: 1, progressionRunId: 1, idempotencyKey: 1 },
  { unique: true, name: 'task_schedules_idempotency_unique' },
);
taskScheduleSchema.index({ userId: 1, progressionRunId: 1, status: 1 });

export default mongoose.models.TaskSchedule || mongoose.model('TaskSchedule', taskScheduleSchema);
