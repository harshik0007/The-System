import mongoose from 'mongoose';
import { isValidIstDateKey } from '../utils/ist.js';

const { Schema } = mongoose;

const accountabilityActionSchema = new Schema({
  title: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, required: true, trim: true, maxlength: 300 },
  weakness: { type: String, default: '', trim: true, maxlength: 240 },
}, { _id: false });

const taskSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  progressionRunId: { type: Schema.Types.ObjectId, ref: 'ProgressionRun', required: true, immutable: true },
  taskScheduleId: { type: Schema.Types.ObjectId, ref: 'TaskSchedule', required: true, immutable: true },
  title: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
  description: { type: String, default: '', trim: true, maxlength: 300 },
  cycleDays: { type: [Number], required: true, validate: [(days) => days.length > 0, 'A Task must be assigned to at least one cycle day.'] },
  accountabilityAction: { type: accountabilityActionSchema, required: true },
  revision: { type: Number, default: 1, min: 1, validate: Number.isInteger, required: true },
  status: { type: String, enum: ['active', 'archived'], default: 'active', required: true },
  effectiveDate: { type: String, required: true, validate: isValidIstDateKey },
  createdEffectiveDate: { type: String, immutable: true, validate: isValidIstDateKey },
  archivedAt: { type: Date, default: null },
  idempotencyKey: { type: String, trim: true, maxlength: 160, immutable: true },
}, {
  timestamps: true,
  collection: 'tasks',
  versionKey: false,
});

taskSchema.path('cycleDays').validate((days) => days.every((day) => Number.isInteger(day) && day >= 1 && day <= 7), 'Cycle days must be integers from 1 through 7.');
taskSchema.path('cycleDays').validate((days) => new Set(days).size === days.length, 'Cycle-day assignments cannot contain duplicates.');
taskSchema.index({ userId: 1, progressionRunId: 1, taskScheduleId: 1, status: 1, cycleDays: 1 });
taskSchema.index(
  { userId: 1, progressionRunId: 1, idempotencyKey: 1 },
  { unique: true, name: 'tasks_idempotency_unique', partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);

export default mongoose.models.Task || mongoose.model('Task', taskSchema);
