import mongoose from 'mongoose';

const { Schema } = mongoose;
const gracePointTransactionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  progressionRunId: { type: Schema.Types.ObjectId, ref: 'ProgressionRun', required: true, immutable: true },
  delta: { type: Number, required: true, validate: Number.isInteger, immutable: true },
  type: { type: String, enum: ['recovery-quest-expiry', 'sixth-quest-threshold', 'dp-redemption'], required: true, immutable: true },
  sourceEntity: { type: String, enum: ['recovery-quest', 'dp-redemption'], required: true, immutable: true },
  sourceId: { type: Schema.Types.ObjectId, required: true, immutable: true },
  sourceEventKey: { type: String, required: true, trim: true, maxlength: 200, immutable: true },
  balanceBefore: { type: Number, required: true, min: 0, validate: Number.isInteger, immutable: true },
  balanceAfter: { type: Number, required: true, min: 0, validate: Number.isInteger, immutable: true },
  occurredAt: { type: Date, required: true, immutable: true },
  metadata: { type: Schema.Types.Mixed, default: () => ({}), immutable: true },
}, {
  collection: 'grace_point_transactions',
  timestamps: { createdAt: true, updatedAt: false },
  versionKey: false,
});

gracePointTransactionSchema.index({ userId: 1, sourceEventKey: 1 }, { unique: true, name: 'grace_transactions_user_source_unique' });
gracePointTransactionSchema.index({ userId: 1, progressionRunId: 1, occurredAt: -1 }, { name: 'grace_transactions_run_history' });

export default mongoose.models.GracePointTransaction || mongoose.model('GracePointTransaction', gracePointTransactionSchema);
