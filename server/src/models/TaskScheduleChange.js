import mongoose from 'mongoose';
import { isValidIstDateKey } from '../utils/ist.js';

const { Schema } = mongoose;
const snapshotSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  cycleDays: { type: [Number], required: true },
  accountabilityAction: {
    title: { type: String, required: true },
    description: { type: String, required: true },
    weakness: { type: String, default: '' },
  },
  revision: { type: Number, required: true, min: 1, validate: Number.isInteger },
  status: { type: String, enum: ['active', 'archived'], required: true },
}, { _id: false });

const taskScheduleChangeSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  progressionRunId: { type: Schema.Types.ObjectId, ref: 'ProgressionRun', required: true, immutable: true },
  taskScheduleId: { type: Schema.Types.ObjectId, ref: 'TaskSchedule', required: true, immutable: true },
  taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true, immutable: true },
  changeType: { type: String, enum: ['added', 'edited', 'rescheduled', 'archived'], required: true, immutable: true },
  beforeSnapshot: { type: snapshotSchema, default: null, immutable: true },
  afterSnapshot: { type: snapshotSchema, required: true, immutable: true },
  effectiveDate: { type: String, required: true, immutable: true, validate: isValidIstDateKey },
  weekStartDate: { type: String, required: true, immutable: true, validate: isValidIstDateKey },
  scheduleVersion: { type: Number, required: true, min: 1, validate: Number.isInteger, immutable: true },
  idempotencyKey: { type: String, required: true, trim: true, minlength: 8, maxlength: 160, immutable: true },
  occurredAt: { type: Date, required: true, default: Date.now, immutable: true },
}, {
  collection: 'task_schedule_changes',
  versionKey: false,
  timestamps: false,
});

taskScheduleChangeSchema.index(
  { userId: 1, idempotencyKey: 1 },
  { unique: true, name: 'task_changes_idempotency_unique' },
);
taskScheduleChangeSchema.index({ userId: 1, progressionRunId: 1, weekStartDate: 1, occurredAt: -1 });
taskScheduleChangeSchema.index({ taskId: 1, effectiveDate: 1, occurredAt: 1 });

export default mongoose.models.TaskScheduleChange || mongoose.model('TaskScheduleChange', taskScheduleChangeSchema);
