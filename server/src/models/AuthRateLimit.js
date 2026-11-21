import mongoose from 'mongoose';

const authRateLimitSchema = new mongoose.Schema({
  _id: { type: String },
  count: { type: Number, min: 0, required: true },
  expiresAt: { type: Date, required: true },
}, { collection: 'auth_rate_limits', versionKey: false });

authRateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'auth_rate_limit_ttl' });

export default mongoose.models.AuthRateLimit || mongoose.model('AuthRateLimit', authRateLimitSchema);
