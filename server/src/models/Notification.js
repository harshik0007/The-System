import mongoose from 'mongoose';

const { Schema } = mongoose;
export const NOTIFICATION_CATEGORY_IDS = Object.freeze([
  'tasks', 'recovery-quests', 'discipline', 'rank-xp', 'emergency-pause', 'monthly-retention',
]);

const notificationSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  progressionRunId: { type: Schema.Types.ObjectId, ref: 'ProgressionRun', default: null, immutable: true },
  category: { type: String, enum: NOTIFICATION_CATEGORY_IDS, required: true, immutable: true },
  eventType: { type: String, trim: true, minlength: 3, maxlength: 80, required: true, immutable: true },
  title: { type: String, trim: true, minlength: 1, maxlength: 140, required: true, immutable: true },
  description: { type: String, trim: true, minlength: 1, maxlength: 600, required: true, immutable: true },
  targetRoute: { type: String, trim: true, maxlength: 220, required: true, immutable: true },
  idempotencyKey: { type: String, trim: true, minlength: 8, maxlength: 200, required: true, immutable: true },
  occurredAt: { type: Date, default: null, immutable: true },
  createdAt: { type: Date, default: Date.now, immutable: true },
  readAt: { type: Date, default: null },
}, { collection: 'notifications', versionKey: false });

notificationSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true, name: 'notifications_user_event_unique' });
notificationSchema.index({ userId: 1, createdAt: -1, _id: -1 }, { name: 'notifications_user_created' });
notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1, _id: -1 }, { name: 'notifications_user_read_created' });
notificationSchema.index({ userId: 1, category: 1, readAt: 1, createdAt: -1, _id: -1 }, { name: 'notifications_user_category_read_created' });

export default mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
