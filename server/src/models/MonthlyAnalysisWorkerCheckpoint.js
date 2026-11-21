import mongoose from 'mongoose';

const monthlyAnalysisWorkerCheckpointSchema = new mongoose.Schema({
  progressionRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProgressionRun', required: true, immutable: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  nextMonthKey: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
  updatedAt: { type: Date, required: true },
}, { collection: 'monthly_analysis_worker_checkpoints', versionKey: false });

monthlyAnalysisWorkerCheckpointSchema.index({ progressionRunId: 1 }, { unique: true, name: 'monthly_worker_checkpoint_run_unique' });

export default mongoose.models.MonthlyAnalysisWorkerCheckpoint || mongoose.model('MonthlyAnalysisWorkerCheckpoint', monthlyAnalysisWorkerCheckpointSchema);
