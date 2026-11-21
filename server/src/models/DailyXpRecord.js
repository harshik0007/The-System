import mongoose from 'mongoose';
import { isValidIstDateKey } from '../utils/ist.js';
import { RANK_SLUGS } from '../utils/ranks.js';

const { Schema } = mongoose;

const sourceEventSchema = new Schema({
  eventKey: { type: String, required: true, immutable: true },
  xpTransactionId: { type: Schema.Types.ObjectId, ref: 'XpTransaction', required: true, immutable: true },
}, { _id: false });

const dailyXpRecordSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  date: { type: String, required: true, immutable: true, validate: isValidIstDateKey },
  rankAtDayStart: { type: String, enum: RANK_SLUGS, required: true, immutable: true },
  capAmountCents: { type: Number, required: true, min: 0, validate: Number.isInteger, immutable: true },
  ordinaryXpCreditedCents: { type: Number, default: 0, min: 0, validate: Number.isInteger, required: true },
  sourceEvents: { type: [sourceEventSchema], default: [] },
  configurationVersion: { type: String, required: true, immutable: true },
  createdAt: { type: Date, required: true, immutable: true },
  updatedAt: { type: Date, required: true },
}, { collection: 'daily_xp_records', versionKey: false });

dailyXpRecordSchema.index({ userId: 1, date: 1 }, { unique: true, name: 'daily_xp_user_date_unique' });

export default mongoose.models.DailyXpRecord || mongoose.model('DailyXpRecord', dailyXpRecordSchema);
