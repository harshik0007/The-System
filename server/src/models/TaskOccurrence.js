import mongoose from 'mongoose';
import { isValidIstDateKey } from '../utils/ist.js';

const { Schema } = mongoose;
const occurrenceSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  progressionRunId: { type: Schema.Types.ObjectId, ref: 'ProgressionRun', required: true, immutable: true },
  taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true, immutable: true },
  taskScheduleId: { type: Schema.Types.ObjectId, ref: 'TaskSchedule', required: true, immutable: true },
  occurrenceDate: { type: String, required: true, immutable: true, validate: isValidIstDateKey },
  cycleDay: { type: Number, required: true, min: 1, max: 7, validate: Number.isInteger, immutable: true },
  snapshot: {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    accountabilityAction: {
      title: { type: String, required: true },
      description: { type: String, required: true },
      weakness: { type: String, default: '' },
    },
    revision: { type: Number, required: true, min: 1, validate: Number.isInteger },
  },
  status: { type: String, enum: ['scheduled', 'submitted', 'completed', 'missed', 'cancelled'], default: 'scheduled', required: true },
  completedAt: { type: Date, default: null },
  missedAt: { type: Date, default: null },
  submission: {
    note: { type: String, default: '' },
    fileName: { type: String, default: '' },
  },
  completionIdempotencyKey: { type: String, default: undefined, select: false },
  createdAt: { type: Date, default: Date.now, required: true, immutable: true },
}, {
  collection: 'task_occurrences',
  versionKey: false,
  timestamps: false,
});

occurrenceSchema.index(
  { userId: 1, progressionRunId: 1, taskId: 1, occurrenceDate: 1 },
  { unique: true, name: 'task_occurrences_task_run_date_unique' },
);
occurrenceSchema.index({ userId: 1, progressionRunId: 1, occurrenceDate: 1, cycleDay: 1 });
occurrenceSchema.index({ userId: 1, progressionRunId: 1, status: 1, occurrenceDate: 1 }, { name: 'task_occurrences_run_status_date' });
occurrenceSchema.index(
  { userId: 1, progressionRunId: 1, completionIdempotencyKey: 1 },
  {
    unique: true,
    name: 'task_occurrences_completion_key_unique',
    partialFilterExpression: { completionIdempotencyKey: { $type: 'string' } },
  },
);

export default mongoose.models.TaskOccurrence || mongoose.model('TaskOccurrence', occurrenceSchema);
