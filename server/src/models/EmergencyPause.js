import mongoose from 'mongoose';

const { Schema } = mongoose;

const questSnapshotSchema = new Schema({
  questId: { type: Schema.Types.ObjectId, ref: 'RecoveryQuest', required: true, immutable: true },
  remainingDurationMs: { type: Number, required: true, min: 0, immutable: true },
}, { _id: false });

const emergencyPauseSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  progressionRunId: { type: Schema.Types.ObjectId, ref: 'ProgressionRun', required: true, immutable: true },
  activationMonthKey: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/, immutable: true },
  idempotencyKey: { type: String, required: true, trim: true, maxlength: 160, immutable: true },
  resumeIdempotencyKey: { type: String, trim: true, maxlength: 160, default: null },
  durationDays: { type: Number, required: true, min: 1, max: 7, validate: Number.isInteger, immutable: true },
  startedAt: { type: Date, required: true, immutable: true },
  selectedEndAt: { type: Date, required: true, immutable: true },
  effectiveEndAt: { type: Date, required: true, immutable: true },
  scheduledEndReason: { type: String, enum: ['selected-duration', 'monthly-boundary'], required: true, immutable: true },
  actualEndAt: { type: Date, default: null },
  transitionRecordedAt: { type: Date, default: null },
  endReason: { type: String, enum: ['early-resume', 'selected-duration', 'monthly-boundary', 'manual-reset', null], default: null },
  status: { type: String, enum: ['active', 'ended'], default: 'active', required: true },
  recoveryQuestSnapshots: { type: [questSnapshotSchema], default: () => [], immutable: true },
}, {
  collection: 'emergency_pauses',
  timestamps: true,
  versionKey: false,
});

emergencyPauseSchema.index({ userId: 1 }, {
  unique: true,
  name: 'emergency_pauses_one_active_per_user',
  partialFilterExpression: { status: 'active' },
});
emergencyPauseSchema.index({ userId: 1, activationMonthKey: 1, startedAt: -1 }, { name: 'emergency_pauses_user_month_history' });
emergencyPauseSchema.index({ userId: 1, progressionRunId: 1, startedAt: -1 }, { name: 'emergency_pauses_run_history' });
emergencyPauseSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true, name: 'emergency_pauses_idempotency_unique' });
emergencyPauseSchema.index({ userId: 1, resumeIdempotencyKey: 1 }, {
  unique: true,
  name: 'emergency_pauses_resume_idempotency_unique',
  partialFilterExpression: { resumeIdempotencyKey: { $type: 'string' } },
});
emergencyPauseSchema.index({ userId: 1, startedAt: 1, actualEndAt: 1 }, { name: 'emergency_pauses_interval_lookup' });

export default mongoose.models.EmergencyPause || mongoose.model('EmergencyPause', emergencyPauseSchema);
