import mongoose from 'mongoose';
import { randomBytes } from 'node:crypto';
import { getIstDateKey, isValidIstDateKey } from '../utils/ist.js';
import { RANK_SLUGS } from '../utils/ranks.js';

const { Schema } = mongoose;
const avatarMarks = ['initials', 'spark', 'shield', 'activity', 'profile'];
const privacySchema = new Schema({
  publicProfile: { type: Boolean, default: true, required: true },
  fullName: { type: Boolean, default: true, required: true },
  activityMap: { type: Boolean, default: true, required: true },
  personalBest: { type: Boolean, default: true, required: true },
  currentRank: { type: Boolean, default: true, required: true },
  level: { type: Boolean, default: true, required: true },
  progressionStats: { type: Boolean, default: true, required: true },
  currentStreak: { type: Boolean, default: true, required: true },
  longestStreak: { type: Boolean, default: true, required: true },
  disciplinePointBalance: { type: Boolean, default: true, required: true },
  gracePointBalance: { type: Boolean, default: true, required: true },
}, { _id: false });
const notificationCategoryPreferencesSchema = new Schema({
  tasks: { type: Boolean, default: true, required: true },
  'recovery-quests': { type: Boolean, default: true, required: true },
  discipline: { type: Boolean, default: true, required: true },
  'rank-xp': { type: Boolean, default: true, required: true },
  'emergency-pause': { type: Boolean, default: true, required: true },
  'monthly-retention': { type: Boolean, default: true, required: true },
}, { _id: false });
const notificationPreferencesSchema = new Schema({
  categories: { type: notificationCategoryPreferencesSchema, default: () => ({}) },
}, { _id: false });
const authProvidersSchema = new Schema({
  localPassword: { type: Boolean, default: false, required: true },
  google: { type: Boolean, default: false, required: true },
}, { _id: false });
const appearancePreferencesSchema = new Schema({
  voidShardCursor: { type: Boolean, default: true, required: true },
  clickRipple: { type: Boolean, default: true, required: true },
  nonessentialAnimations: { type: Boolean, default: true, required: true },
  reduceDecorativeEffects: { type: Boolean, default: false, required: true },
  effectQuality: { type: String, enum: ['high', 'balanced', 'low'], default: 'balanced', required: true },
}, { _id: false });
const accessibilityPreferencesSchema = new Schema({
  reduceMotion: { type: Boolean, default: null },
}, { _id: false });
const createPublicHandle = () => `member-${randomBytes(8).toString('hex')}`;

const userSchema = new Schema({
  identityKind: {
    type: String,
    enum: ['account', 'development-seed'],
    required: true,
    default: 'account',
  },
  developmentIdentitySelector: { type: String, trim: true, select: false },
  username: { type: String, trim: true, minlength: 3, maxlength: 24 },
  usernameNormalized: { type: String, trim: true, lowercase: true, select: false },
  emailNormalized: { type: String, trim: true, lowercase: true, select: false },
  // Optional for untouched legacy records; all newly registered accounts set
  // exactly one sign-in method and legacy dual-method records are rejected.
  authMethod: { type: String, enum: ['local', 'google'], default: undefined },
  passwordHash: { type: String, select: false },
  authProviders: { type: authProvidersSchema, default: () => ({}) },
  googleSub: { type: String, trim: true, select: false },
  emailVerified: { type: Boolean, default: false, required: true },
  firstName: { type: String, trim: true, maxlength: 80, default: '' },
  middleName: { type: String, trim: true, maxlength: 80, default: '' },
  lastName: { type: String, trim: true, maxlength: 80, default: '' },
  recoveryCodeHashes: { type: [String], default: [], select: false },
  emailVerifiedAt: { type: Date, default: null },
  authVersion: { type: Number, default: 0, min: 0, validate: Number.isInteger, required: true, select: false },
  accountStatus: { type: String, enum: ['pending', 'active', 'disabled', 'deletion-pending'], default: 'pending', required: true },
  createdAt: { type: Date, default: Date.now, immutable: true },
  memberSince: {
    type: String,
    required: true,
    immutable: true,
    default: () => getIstDateKey(),
    validate: { validator: isValidIstDateKey, message: 'memberSince must be a valid IST YYYY-MM-DD date.' },
  },
  currentProgressionRunId: { type: Schema.Types.ObjectId, ref: 'ProgressionRun', default: null },
  resetCount: { type: Number, default: 0, min: 0, validate: Number.isInteger, required: true },
  lifetimeLongestStreak: { type: Number, default: 0, min: 0, validate: Number.isInteger, required: true },
  highestRankAchieved: { type: String, enum: [...RANK_SLUGS, null], default: null },
  publicHandle: { type: String, trim: true, lowercase: true, minlength: 3, maxlength: 48, default: createPublicHandle },
  displayName: { type: String, trim: true, minlength: 2, maxlength: 40, default: undefined },
  avatarMark: { type: String, enum: avatarMarks, default: 'initials' },
  publicProfileSettingsInitialized: { type: Boolean, default: false, required: true },
  privacy: { type: privacySchema, default: () => ({}) },
  appearancePreferences: { type: appearancePreferencesSchema, default: () => ({}) },
  accessibilityPreferences: { type: accessibilityPreferencesSchema, default: () => ({}) },
  accountPreferencesInitialized: { type: Boolean, default: false, required: true },
  notificationPreferences: { type: notificationPreferencesSchema, default: () => ({}) },
  // Mixed preserves pre-M26 lifetime-position values while allowing the new
  // independently timestamped category records to be migrated atomically.
  personalBestRecords: { type: Schema.Types.Mixed, default: () => ({ overall: {}, discipline: {}, xp: {} }) },
}, {
  timestamps: { createdAt: false, updatedAt: true },
  collection: 'users',
  versionKey: false,
  toJSON: {
    transform(_document, returned) {
      delete returned.passwordHash;
      delete returned.developmentIdentitySelector;
      delete returned.emailNormalized;
      delete returned.usernameNormalized;
      delete returned.googleSub;
      delete returned.recoveryCodeHashes;
      delete returned.authVersion;
      delete returned.__v;
      return returned;
    },
  },
  toObject: {
    transform(_document, returned) {
      delete returned.passwordHash;
      delete returned.developmentIdentitySelector;
      delete returned.emailNormalized;
      delete returned.usernameNormalized;
      delete returned.googleSub;
      delete returned.recoveryCodeHashes;
      delete returned.authVersion;
      delete returned.__v;
      return returned;
    },
  },
});

userSchema.index(
  { emailNormalized: 1 },
  { unique: true, name: 'users_email_normalized_unique', partialFilterExpression: { emailNormalized: { $type: 'string' } } },
);
userSchema.index(
  { usernameNormalized: 1 },
  { unique: true, name: 'users_username_normalized_unique', partialFilterExpression: { usernameNormalized: { $type: 'string' } } },
);
userSchema.index(
  { googleSub: 1 },
  { unique: true, name: 'users_google_sub_unique', partialFilterExpression: { googleSub: { $type: 'string' } } },
);
userSchema.index(
  { developmentIdentitySelector: 1 },
  { unique: true, name: 'users_dev_selector_unique', partialFilterExpression: { identityKind: 'development-seed' } },
);
userSchema.index({ highestRankAchieved: 1 });
userSchema.index({ publicHandle: 1 }, { unique: true, name: 'users_public_handle_unique', partialFilterExpression: { publicHandle: { $type: 'string' } } });

export default mongoose.models.User || mongoose.model('User', userSchema);
