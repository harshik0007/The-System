import mongoose from 'mongoose';
import { RANK_SLUGS } from '../utils/ranks.js';

const { Schema } = mongoose;

const rankEntryEventSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  progressionRunId: { type: Schema.Types.ObjectId, ref: 'ProgressionRun', required: true, immutable: true },
  rankSlug: { type: String, enum: RANK_SLUGS, required: true, immutable: true },
  sourceEventKey: { type: String, required: true, maxlength: 200, immutable: true },
  // Every earned Rank entry links to the XP ledger transaction that crossed its gate.
  sourceXpTransactionId: {
    type: Schema.Types.ObjectId,
    ref: 'XpTransaction',
    default: null,
    required: true,
    immutable: true,
  },
  configuredXpRewardCents: { type: Number, default: 0, min: 0, validate: Number.isInteger, immutable: true },
  xpRewardConfigured: { type: Boolean, required: true, immutable: true },
  creditedXpRewardCents: { type: Number, default: 0, min: 0, validate: Number.isInteger, immutable: true },
  configuredDpRewardCents: { type: Number, default: 0, min: 0, validate: Number.isInteger, immutable: true },
  creditedDpRewardCents: { type: Number, default: 0, min: 0, validate: Number.isInteger, immutable: true },
  xpTransactionId: { type: Schema.Types.ObjectId, ref: 'XpTransaction', default: null },
  disciplinePointTransactionId: { type: Schema.Types.ObjectId, ref: 'DisciplinePointTransaction', default: null },
  occurredAt: { type: Date, required: true, immutable: true },
  businessDate: { type: String, required: true, immutable: true },
  configurationVersion: { type: String, required: true, immutable: true },
}, { collection: 'rank_entry_events', versionKey: false });

rankEntryEventSchema.index({ userId:  1, progressionRunId: 1, rankSlug: 1 }, { unique: true, name: 'rank_entry_run_rank_unique' });
rankEntryEventSchema.index({ userId: 1, sourceEventKey: 1 }, { unique: true, name: 'rank_entry_user_source_unique' });

export default mongoose.models.RankEntryEvent || mongoose.model('RankEntryEvent', rankEntryEventSchema);
