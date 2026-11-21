import mongoose from 'mongoose';

const { Schema } = mongoose;

const sourceSnapshotSchema = new Schema({
  taskTitle: { type: String, required: true, immutable: true },
  taskDescription: { type: String, default: '', immutable: true },
  accountabilityActionTitle: { type: String, required: true, immutable: true },
  accountabilityActionDescription: { type: String, required: true, immutable: true },
  taskRevision: { type: Number, required: true, min: 1, immutable: true },
}, { _id: false });

const recoveryQuestSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  progressionRunId: { type: Schema.Types.ObjectId, ref: 'ProgressionRun', required: true, immutable: true },
  sourceTaskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true, immutable: true },
  sourceOccurrenceId: { type: Schema.Types.ObjectId, ref: 'TaskOccurrence', required: true, immutable: true },
  sourceEventKey: { type: String, required: true, trim: true, maxlength: 180, immutable: true },
  sourceSnapshot: { type: sourceSnapshotSchema, required: true, immutable: true },
  activatedAt: { type: Date, required: true, immutable: true },
  baseExpiresAt: { type: Date, required: true, immutable: true },
  expiresAt: { type: Date, required: true },
  remainingDurationMs: { type: Number, default: null, min: 0 },
  pausedAt: { type: Date, default: null },
  status: { type: String, enum: ['active', 'completed', 'expired', 'threshold-cleared', 'run-ended'], default: 'active', required: true },
  completedAt: { type: Date, default: null },
  expiredAt: { type: Date, default: null },
  thresholdClearedAt: { type: Date, default: null },
  runEndedAt: { type: Date, default: null },
  gracePointTransactionId: { type: Schema.Types.ObjectId, ref: 'GracePointTransaction', default: null },
  thresholdTransactionId: { type: Schema.Types.ObjectId, ref: 'GracePointTransaction', default: null },
}, {
  collection: 'recovery_quests',
  timestamps: true,
  versionKey: false,
});

recoveryQuestSchema.index({ userId: 1, progressionRunId: 1, sourceOccurrenceId: 1 }, { unique: true, name: 'recovery_quests_source_occurrence_unique' });
recoveryQuestSchema.index({ userId: 1, sourceEventKey: 1 }, { unique: true, name: 'recovery_quests_user_source_unique' });
recoveryQuestSchema.index({ userId: 1, progressionRunId: 1, status: 1, expiresAt: 1 }, { name: 'recovery_quests_active_expiry' });

export default mongoose.models.RecoveryQuest || mongoose.model('RecoveryQuest', recoveryQuestSchema);
