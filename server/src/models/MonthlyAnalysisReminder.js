import mongoose from 'mongoose';

const { Schema } = mongoose;

const monthlyAnalysisReminderSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  progressionRunId: { type: Schema.Types.ObjectId, ref: 'ProgressionRun', required: true, immutable: true },
  monthKey: { type: String, required: true, immutable: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
  expiryAt: { type: Date, required: true, immutable: true },
  offsetHours: { type: Number, enum: [168, 48, 24], required: true, immutable: true },
  remindAt: { type: Date, required: true, immutable: true },
  surfacedAt: { type: Date, default: null },
  createdAt: { type: Date, required: true, immutable: true },
}, { collection: 'monthly_analysis_reminders', versionKey: false });

monthlyAnalysisReminderSchema.index(
  { userId: 1, progressionRunId: 1, monthKey: 1, offsetHours: 1 },
  { unique: true, name: 'monthly_reminder_run_month_offset_unique' },
);
monthlyAnalysisReminderSchema.index({ userId: 1, remindAt: 1, expiryAt: 1 }, { name: 'monthly_reminder_due_lookup' });

export default mongoose.models.MonthlyAnalysisReminder || mongoose.model('MonthlyAnalysisReminder', monthlyAnalysisReminderSchema);
