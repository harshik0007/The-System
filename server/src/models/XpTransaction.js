import mongoose from 'mongoose';
import { RANK_SLUGS } from '../utils/ranks.js';

const { Schema } = mongoose;
const xpTransactionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  progressionRunId: { type: Schema.Types.ObjectId, ref: 'ProgressionRun', required: true, immutable: true },
  amount: { type: Schema.Types.Decimal128, required: true, immutable: true },
  type: { type: String, enum: ['recovery-quest-drain', 'task-completion', 'rank-entry'], required: true, immutable: true },
  sourceType: { type: String, enum: ['recovery-quest', 'task-occurrence', 'rank-entry'], default: null, immutable: true },
  sourceEntityId: { type: Schema.Types.ObjectId, default: null, immutable: true },
  sourceEventKey: { type: String, required: true, trim: true, maxlength: 180, immutable: true },
  baseAmount: { type: Schema.Types.Decimal128, default: null, immutable: true },
  multiplier: { type: Number, default: null, min: 0, immutable: true },
  calculatedAmount: { type: Schema.Types.Decimal128, default: null, immutable: true },
  actualCreditedAmount: { type: Schema.Types.Decimal128, default: null, immutable: true },
  dailyCapAmount: { type: Schema.Types.Decimal128, default: null, immutable: true },
  dailyCapRemainingBefore: { type: Schema.Types.Decimal128, default: null, immutable: true },
  dailyCapRemainingAfter: { type: Schema.Types.Decimal128, default: null, immutable: true },
  balanceBefore: { type: Schema.Types.Decimal128, required: true, immutable: true },
  balanceAfter: { type: Schema.Types.Decimal128, required: true, immutable: true },
  levelBefore: { type: Number, required: true, min: 0, validate: Number.isInteger, immutable: true },
  resultingLevel: { type: Number, required: true, min: 0, validate: Number.isInteger, immutable: true },
  currentRankBefore: { type: String, enum: RANK_SLUGS, default: null, immutable: true },
  currentRankAfter: { type: String, enum: RANK_SLUGS, default: null, immutable: true },
  levelRequirement: { type: Number, required: true, min: 0, validate: Number.isInteger, immutable: true },
  activeQuestCount: { type: Number, required: true, min: 0, validate: Number.isInteger, immutable: true },
  occurredAt: { type: Date, required: true, immutable: true },
  businessDate: { type: String, default: null, immutable: true },
  metadata: { type: Schema.Types.Mixed, default: () => ({}), immutable: true },
}, {
  collection: 'xp_transactions',
  timestamps: { createdAt: true, updatedAt: false },
  versionKey: false,
});

xpTransactionSchema.index({ userId: 1, progressionRunId: 1, sourceEventKey: 1 }, { unique: true, name: 'xp_transactions_run_source_unique' });
xpTransactionSchema.index({ userId: 1, progressionRunId: 1, occurredAt: -1 }, { name: 'xp_transactions_run_history' });

export default mongoose.models.XpTransaction || mongoose.model('XpTransaction', xpTransactionSchema);
