import mongoose from 'mongoose';
import { isValidIstDateKey } from '../utils/ist.js';

const { Schema } = mongoose;
const resetEventSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  previousRunId: { type: Schema.Types.ObjectId, ref: 'ProgressionRun', required: true, immutable: true },
  newRunId: { type: Schema.Types.ObjectId, ref: 'ProgressionRun', required: true, immutable: true },
  reason: {
    type: String,
    enum: ['automatic-grace-exhaustion', 'manual-reset-and-restart'],
    required: true,
    immutable: true,
  },
  sourceEventKey: { type: String, required: true, trim: true, minlength: 1, maxlength: 160, immutable: true },
  resetCountAfter: {
    type: Number,
    required() { return this.reason === 'automatic-grace-exhaustion'; },
    min: 1,
    validate: Number.isInteger,
    immutable: true,
  },
  occurredAt: { type: Date, required: true, default: Date.now, immutable: true },
  businessDate: { type: String, required: true, immutable: true, validate: isValidIstDateKey },
}, {
  collection: 'progression_reset_events',
  versionKey: false,
  timestamps: false,
});

resetEventSchema.index(
  { userId: 1, sourceEventKey: 1 },
  { unique: true, name: 'reset_events_user_source_unique' },
);
resetEventSchema.index({ userId: 1, occurredAt: -1 }, { name: 'reset_events_user_date' });
resetEventSchema.index({ previousRunId: 1, newRunId: 1 });

export default mongoose.models.ProgressionResetEvent || mongoose.model('ProgressionResetEvent', resetEventSchema);
