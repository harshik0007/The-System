import mongoose from 'mongoose';
import { isValidIstDateKey } from '../utils/ist.js';

const { Schema } = mongoose;
const recoveryQuestDailyResetSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  progressionRunId: { type: Schema.Types.ObjectId, ref: 'ProgressionRun', required: true, immutable: true },
  date: { type: String, required: true, immutable: true, validate: isValidIstDateKey },
  status: { type: String, enum: ['completed', 'skipped-emergency-pause'], required: true, immutable: true },
  protectedTaskDate: { type: Boolean, default: false, required: true, immutable: true },
  activeQuestCount: { type: Number, default: 0, min: 0, validate: Number.isInteger, immutable: true },
  xpTransactionId: { type: Schema.Types.ObjectId, ref: 'XpTransaction', default: null, immutable: true },
  processedAt: { type: Date, required: true, immutable: true },
}, {
  collection: 'recovery_quest_daily_resets',
  timestamps: false,
  versionKey: false,
});

recoveryQuestDailyResetSchema.index({ userId: 1, progressionRunId: 1, date: 1 }, { unique: true, name: 'recovery_quest_reset_run_date_unique' });

export default mongoose.models.RecoveryQuestDailyReset || mongoose.model('RecoveryQuestDailyReset', recoveryQuestDailyResetSchema);
