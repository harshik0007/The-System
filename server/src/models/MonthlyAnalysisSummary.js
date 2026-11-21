import mongoose from 'mongoose';

const { Schema } = mongoose;

const monthlyAnalysisSummarySchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  progressionRunId: { type: Schema.Types.ObjectId, ref: 'ProgressionRun', required: true, immutable: true },
  monthKey: { type: String, required: true, immutable: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
  monthStartAt: { type: Date, required: true, immutable: true },
  monthEndAt: { type: Date, required: true, immutable: true },
  coveredFrom: { type: String, required: true, immutable: true },
  coveredThrough: { type: String, required: true },
  status: { type: String, enum: ['partial', 'finalized'], required: true },
  aggregationVersion: { type: Number, required: true, min: 1 },
  hasData: { type: Boolean, required: true },
  metrics: { type: Schema.Types.Mixed, required: true },
  sourceCounts: { type: Schema.Types.Mixed, required: true },
  createdAt: { type: Date, required: true, immutable: true },
  updatedAt: { type: Date, required: true },
}, { collection: 'monthly_analysis_summaries', versionKey: false });

monthlyAnalysisSummarySchema.index(
  { userId: 1, progressionRunId: 1, monthKey: 1 },
  { unique: true, name: 'monthly_summary_user_run_month_unique' },
);
monthlyAnalysisSummarySchema.index({ userId: 1, progressionRunId: 1, monthKey: -1 }, { name: 'monthly_summary_run_history' });

export default mongoose.models.MonthlyAnalysisSummary || mongoose.model('MonthlyAnalysisSummary', monthlyAnalysisSummarySchema);
