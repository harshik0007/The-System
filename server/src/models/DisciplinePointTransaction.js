import mongoose from 'mongoose';

const { Schema } = mongoose;

const disciplinePointTransactionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  progressionRunId: { type: Schema.Types.ObjectId, ref: 'ProgressionRun', required: true, immutable: true },
  deltaCents: { type: Number, required: true, validate: Number.isInteger, immutable: true },
  type: { type: String, enum: ['rank-entry', 'recurring-discipline-cycle', 'dp-redemption'], required: true, immutable: true },
  sourceEntity: { type: String, enum: ['rank-entry', 'discipline-cycle', 'dp-redemption'], required: true, immutable: true },
  sourceId: { type: Schema.Types.ObjectId, required: true, immutable: true },
  sourceEventKey: { type: String, required: true, maxlength: 200, immutable: true },
  balanceBeforeCents: { type: Number, required: true, min: 0, validate: Number.isInteger, immutable: true },
  balanceAfterCents: { type: Number, required: true, min: 0, validate: Number.isInteger, immutable: true },
  calculatedDeltaCents: { type: Number, default: null, validate: (value) => value == null || Number.isInteger(value), immutable: true },
  businessDate: { type: String, default: null, validate: (value) => value == null || /^\d{4}-\d{2}-\d{2}$/.test(value), immutable: true },
  occurredAt: { type: Date, required: true, immutable: true },
  metadata: { type: Schema.Types.Mixed, default: () => ({}), immutable: true },
}, { collection: 'discipline_point_transactions', timestamps: { createdAt: true, updatedAt: false }, versionKey: false });

disciplinePointTransactionSchema.index({ userId: 1, sourceEventKey: 1 }, { unique: true, name: 'discipline_point_source_unique' });
disciplinePointTransactionSchema.index({ userId: 1, progressionRunId: 1, occurredAt: -1 }, { name: 'discipline_point_run_history' });

export default mongoose.models.DisciplinePointTransaction || mongoose.model('DisciplinePointTransaction', disciplinePointTransactionSchema);
