import mongoose from 'mongoose';
import { EMERGENCY_PAUSE_ALLOWANCE } from '../config/emergencyPauseConfiguration.js';

const emergencyPauseMonthlyUsageSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  monthKey: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/, immutable: true },
  // This points at the active run whose allowance is represented by this
  // operational counter. Pause activation history remains in EmergencyPause.
  progressionRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProgressionRun', default: null },
  activationsUsed: { type: Number, required: true, min: 0, max: EMERGENCY_PAUSE_ALLOWANCE, validate: Number.isInteger },
}, {
  collection: 'emergency_pause_monthly_usages',
  timestamps: true,
  versionKey: false,
});

emergencyPauseMonthlyUsageSchema.index({ userId: 1, monthKey: 1 }, { unique: true, name: 'emergency_pause_usage_user_month_unique' });

export default mongoose.models.EmergencyPauseMonthlyUsage || mongoose.model('EmergencyPauseMonthlyUsage', emergencyPauseMonthlyUsageSchema);
