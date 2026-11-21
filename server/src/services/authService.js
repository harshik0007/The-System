import ProgressionRun from '../models/ProgressionRun.js';
import User from '../models/User.js';
import { config } from '../config/env.js';
import { authRateLimitService } from './authRateLimitService.js';
import { withMongoTransaction } from './mongoTransaction.js';
import { createFreshProgressionRunWithinSession } from './progressionRunFactory.js';
import { grantInitialRankEntryRewardWithinSession } from './progressionXpService.js';
import { getPasswordValidationError, hashPassword, passwordHashNeedsUpgrade, performDummyPasswordVerification, verifyPassword } from './passwordService.js';
import { accountRateKey } from '../utils/authPrimitives.js';
import {
  generateRecoveryCodes, isRecoveryCodeFormat, normalizeLoginIdentifier,
  normalizeUsername, recoveryCodeDigest, validateIdentityEmail, validatePersonalName, validateUsername,
} from '../utils/identity.js';
import { ConflictError, HttpError, NotFoundError, ServiceUnavailableError, ValidationError } from '../utils/httpErrors.js';

const GENERIC_CREDENTIAL_ERROR = 'The sign-in details are incorrect.';
const GENERIC_RECOVERY_ERROR = 'The account or recovery code could not be verified.';
const RECOVERY_CODE_COUNT = 10;
const PENDING_GOOGLE_TTL_MS = 10 * 60_000;

function memberName(user) {
  return [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ');
}

export function toAuthMember(user) {
  if (!user) return null;
  return {
    id: String(user._id),
    username: user.username || null,
    publicHandle: user.publicHandle || null,
    email: user.emailNormalized || null,
    firstName: user.firstName || '',
    middleName: user.middleName || '',
    lastName: user.lastName || '',
    personalName: memberName(user),
    authMethod: resolveAuthMethod(user),
    memberSince: user.memberSince || null,
    createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt || null,
    authProviders: {
      localPassword: Boolean(user.authProviders?.localPassword || user.passwordHash),
      google: Boolean(user.authProviders?.google || user.googleSub),
    },
  };
}

function resolveAuthMethod(user) {
  const hasLocal = Boolean(user?.authProviders?.localPassword || user?.passwordHash);
  const hasGoogle = Boolean(user?.authProviders?.google || user?.googleSub);
  // A legacy record with both credentials must not silently become a mixed
  // account merely because its old authMethod field names one provider.
  if (hasLocal && hasGoogle) return null;
  if (user?.authMethod === 'local') return hasLocal ? 'local' : null;
  if (user?.authMethod === 'google') return hasGoogle ? 'google' : null;
  if (hasLocal === hasGoogle) return null;
  return hasLocal ? 'local' : 'google';
}

function accountMethodConflict(method) {
  const methodName = method === 'google' ? 'Google Sign-In' : 'username or email and password';
  return new ConflictError('ACCOUNT_METHOD_CONFLICT', `This email belongs to an account that uses ${methodName}. Sign in with that method; accounts cannot be linked.`);
}

function ensureRecoverySecret(settings) {
  const secret = settings.recoveryCodeHmacSecret;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new ServiceUnavailableError('Recovery-code protection is not configured. Contact the site operator.');
  }
  return secret;
}

function validateNames(input) {
  const first = validatePersonalName(input.firstName, 'First name');
  const middle = validatePersonalName(input.middleName, 'Middle name', { required: false });
  const last = validatePersonalName(input.lastName, 'Last name');
  const errors = [first, middle, last].filter((item) => item.error).map((item) => item.error);
  if (errors.length) throw new ValidationError(errors.join(' '));
  return { firstName: first.value, middleName: middle.value, lastName: last.value };
}

function validatePasswordPair(password, confirmPassword, tools) {
  const error = tools.getPasswordValidationError(password);
  if (error) throw new ValidationError(error);
  if (password !== confirmPassword) throw new ValidationError('Password confirmation does not match.');
}

function duplicateIdentityError(error) {
  if (error?.code !== 11000) return error;
  const fields = Object.keys(error.keyPattern || error.keyValue || {});
  if (fields.includes('emailNormalized')) return new ConflictError('EMAIL_ALREADY_EXISTS', 'An account already uses this email address.');
  if (fields.includes('usernameNormalized')) return new ConflictError('USERNAME_ALREADY_TAKEN', 'That username is already in use.');
  if (fields.includes('googleSub')) return new ConflictError('GOOGLE_ACCOUNT_ALREADY_LINKED', 'That Google account is already linked to another member.');
  return new ConflictError('IDENTITY_ALREADY_EXISTS', 'An account already uses one of those sign-in details.');
}

function errorCodeMatches(error, key) {
  return Object.keys(error?.keyPattern || error?.keyValue || {}).includes(key);
}

export function createAuthService({
  UserModel = User,
  ProgressionRunModel = ProgressionRun,
  rateLimits = authRateLimitService,
  transaction = withMongoTransaction,
  settings = config,
  now = () => new Date(),
  passwordTools = { hashPassword, verifyPassword, passwordHashNeedsUpgrade, performDummyPasswordVerification, getPasswordValidationError },
  initializeProgression = createFreshProgressionRunWithinSession,
  grantReviewModeRankEntryReward = grantInitialRankEntryRewardWithinSession,
} = {}) {
  async function rateLimit(action, ip, key) {
    await rateLimits.check({ action, ip, accountKey: key ? accountRateKey(key) : undefined });
  }

  async function findLoginAccount(identifier, { session } = {}) {
    const normalized = normalizeLoginIdentifier(identifier);
    if (!normalized) return null;
    const query = UserModel.findOne({
      identityKind: 'account',
      $or: [{ emailNormalized: normalized }, { usernameNormalized: normalized }],
    }).select('+passwordHash +emailNormalized +usernameNormalized +authVersion +recoveryCodeHashes +googleSub');
    if (session) query.session(session);
    return query;
  }

  async function createMemberAndProgression(fields) {
    return transaction(async (mongoSession) => {
      const reviewMode = settings.appReviewMode === true;
      const initialUserFields = reviewMode ? { ...fields, highestRankAchieved: 'continuum' } : fields;
      const [user] = await UserModel.create([initialUserFields], { session: mongoSession });
      const activeRun = await ProgressionRunModel.findOne({ userId: user._id, status: 'active' }).session(mongoSession);
      if (activeRun) throw new ConflictError('ACTIVE_PROGRESSION_EXISTS', 'This account already has an active progression.');
      const latestRun = await ProgressionRunModel.findOne({ userId: user._id }).sort({ runNumber: -1 }).session(mongoSession);
      const startedAt = now();
      const run = await initializeProgression({
        userId: user._id,
        runNumber: (latestRun?.runNumber || 0) + 1,
        startedAt,
        reviewMode,
        session: mongoSession,
      });
      if (reviewMode) {
        await grantReviewModeRankEntryReward({
          userId: user._id,
          run,
          rankSlug: 'continuum',
          occurredAt: startedAt,
          businessDate: run.startedOn,
          session: mongoSession,
        });
      }
      user.currentProgressionRunId = run._id;
      await user.save({ session: mongoSession });
      return user;
    });
  }

  function newRecoveryCodeSet() {
    const codes = generateRecoveryCodes(RECOVERY_CODE_COUNT);
    const secret = ensureRecoverySecret(settings);
    return { codes, hashes: codes.map((code) => recoveryCodeDigest(code, secret)) };
  }

  function readGoogleIdentity(profile) {
    const providerEmail = profile?._json?.email;
    const verifiedProfileEmail = profile?.emails?.find((entry) => entry?.verified === true
      && typeof entry?.value === 'string')?.value;
    // Use the email whose verification status Google actually attested to.
    // Do not accept the first listed address merely because another address
    // on the same profile is verified.
    const emailValue = profile?._json?.email_verified === true && typeof providerEmail === 'string'
      ? providerEmail
      : verifiedProfileEmail;
    const email = validateIdentityEmail(emailValue);
    const emailVerified = (profile?._json?.email_verified === true && typeof providerEmail === 'string')
      || Boolean(verifiedProfileEmail);
    const sub = typeof profile?.id === 'string' ? profile.id : '';
    if (!sub || sub.length > 255 || !email || !emailVerified) {
      throw new HttpError(401, 'GOOGLE_IDENTITY_INVALID', 'Google could not verify this sign-in. Try again.');
    }
    const firstName = typeof profile?.name?.givenName === 'string'
      ? profile.name.givenName.normalize('NFC').trim().slice(0, 80) : '';
    const lastName = typeof profile?.name?.familyName === 'string'
      ? profile.name.familyName.normalize('NFC').trim().slice(0, 80) : '';
    return { sub, email, firstName, lastName };
  }

  function makeUserIdentity({ username, email, names, passwordHash, googleSub, recoveryCodeHashes, now: instant }) {
    const authMethod = googleSub ? 'google' : 'local';
    return {
      identityKind: 'account',
      accountStatus: 'active',
      username,
      usernameNormalized: normalizeUsername(username),
      emailNormalized: email,
      authMethod,
      passwordHash: passwordHash || undefined,
      firstName: names.firstName,
      middleName: names.middleName,
      lastName: names.lastName,
      authProviders: { localPassword: Boolean(passwordHash), google: Boolean(googleSub) },
      googleSub: googleSub || undefined,
      emailVerified: Boolean(googleSub),
      emailVerifiedAt: googleSub ? instant : null,
      recoveryCodeHashes,
      authVersion: 0,
    };
  }

  return Object.freeze({
    async capabilities() {
      return {
        localPassword: true,
        googleSignIn: Boolean(settings.googleOAuthEnabled),
        recoveryCodes: RECOVERY_CODE_COUNT,
        minimumPasswordLength: 8,
        passwordRequirements: ['8 characters', 'one letter', 'one digit (0–9)', 'one non-whitespace symbol'],
      };
    },

    async usernameAvailability(username, ip) {
      const result = validateUsername(username);
      if (result.error) return { available: false, username: result.username, message: result.error };
      await rateLimit('username-check', ip, result.normalized);
      const exists = await UserModel.exists({ usernameNormalized: result.normalized });
      return { available: !exists, username: result.username, message: exists ? 'That username is already in use.' : 'Username is available.' };
    },

    async signup({ firstName, middleName, lastName, username, email, password, confirmPassword, termsAccepted, ip }) {
      const cleanEmail = validateIdentityEmail(email);
      const cleanUsername = validateUsername(username);
      await rateLimit('signup', ip, cleanEmail || username);
      if (!cleanEmail) throw new ValidationError('Enter a valid email address.');
      if (cleanUsername.error) throw new ValidationError(cleanUsername.error, [{ field: 'username', code: 'INVALID_USERNAME' }]);
      if (termsAccepted !== true) throw new ValidationError('Acknowledge the Terms and Conditions to create an account.');
      const names = validateNames({ firstName, middleName, lastName });
      validatePasswordPair(password, confirmPassword, passwordTools);

      const existingEmail = await UserModel.findOne({ emailNormalized: cleanEmail }).select('authMethod authProviders +passwordHash +googleSub');
      if (existingEmail) {
        const method = resolveAuthMethod(existingEmail);
        if (method && method !== 'local') throw accountMethodConflict(method);
        if (!method) throw new ConflictError('ACCOUNT_METHOD_CONFLICT', 'This account has an unsupported sign-in setup. Contact support before creating another account.');
        throw new ConflictError('EMAIL_ALREADY_EXISTS', 'An account already uses this email address.');
      }
      if (await UserModel.exists({ usernameNormalized: cleanUsername.normalized })) throw new ConflictError('USERNAME_ALREADY_TAKEN', 'That username is already in use.');
      const passwordHash = await passwordTools.hashPassword(password);
      const recovery = newRecoveryCodeSet();
      let user;
      try {
        user = await createMemberAndProgression({
          ...makeUserIdentity({ username: cleanUsername.username, email: cleanEmail, names, passwordHash, recoveryCodeHashes: recovery.hashes, now: now() }),
          emailVerified: false,
          emailVerifiedAt: null,
        });
      } catch (error) {
        if (error?.code === 11000) throw duplicateIdentityError(error);
        throw error;
      }
      return { member: toAuthMember(user), sessionUser: user, recoveryCodes: recovery.codes, requiresScheduleSetup: true };
    },

    async login({ identifier, email, password, ip }) {
      const value = identifier ?? email;
      const normalized = normalizeLoginIdentifier(value);
      await rateLimit('login', ip, normalized || undefined);
      if (!normalized || typeof password !== 'string' || Buffer.byteLength(password, 'utf8') > 1024) {
        await passwordTools.performDummyPasswordVerification(typeof password === 'string' ? password : '');
        throw new HttpError(401, 'INVALID_CREDENTIALS', GENERIC_CREDENTIAL_ERROR);
      }
      const user = await findLoginAccount(normalized);
      if (!user) {
        await passwordTools.performDummyPasswordVerification(password);
        throw new HttpError(401, 'INVALID_CREDENTIALS', GENERIC_CREDENTIAL_ERROR);
      }
      const method = resolveAuthMethod(user);
      if (user.accountStatus !== 'active') {
        throw new HttpError(401, 'INVALID_CREDENTIALS', GENERIC_CREDENTIAL_ERROR);
      }
      if (method !== 'local') {
        await passwordTools.performDummyPasswordVerification(password);
        if (method === 'google') throw accountMethodConflict('google');
        throw new ConflictError('ACCOUNT_METHOD_CONFLICT', 'This account has an unsupported sign-in setup. Contact support before continuing.');
      }
      if (!user.passwordHash || !await passwordTools.verifyPassword(password, user.passwordHash)) throw new HttpError(401, 'INVALID_CREDENTIALS', GENERIC_CREDENTIAL_ERROR);
      if (passwordTools.passwordHashNeedsUpgrade?.(user.passwordHash)) {
        const previousHash = user.passwordHash;
        const upgradedHash = await passwordTools.hashPassword(password);
        // Update only the exact credential version that was verified. A
        // concurrent password reset must never be overwritten by login.
        await UserModel.updateOne({
          _id: user._id,
          passwordHash: previousHash,
          authVersion: user.authVersion,
        }, { $set: { passwordHash: upgradedHash } });
      }
      if (user.authMethod !== 'local') await UserModel.updateOne({
        _id: user._id,
        $or: [{ authMethod: { $exists: false } }, { authMethod: null }],
      }, { $set: { authMethod: 'local' } });
      return { member: toAuthMember(user), sessionUser: user };
    },

    async googleOAuthSignIn({ profile, ip }) {
      if (!settings.googleOAuthEnabled) throw new ServiceUnavailableError('Google Sign-In is not configured on this deployment.');
      await rateLimit('google', ip, undefined);
      const identity = readGoogleIdentity(profile);
      const linkedUser = await UserModel.findOne({ googleSub: identity.sub }).select('+emailNormalized +authVersion +googleSub +passwordHash authMethod authProviders');
      if (linkedUser) {
        if (linkedUser.accountStatus !== 'active') throw new HttpError(401, 'INVALID_CREDENTIALS', GENERIC_CREDENTIAL_ERROR);
        if (resolveAuthMethod(linkedUser) !== 'google') throw accountMethodConflict('local');
        if (linkedUser.authMethod !== 'google') {
          await UserModel.updateOne({ _id: linkedUser._id, googleSub: identity.sub }, { $set: { authMethod: 'google' } });
        }
        return { kind: 'authenticated', member: toAuthMember(linkedUser), sessionUser: linkedUser };
      }
      const existingEmailUser = await UserModel.findOne({ emailNormalized: identity.email }).select('_id authMethod authProviders +passwordHash +googleSub');
      if (existingEmailUser) {
        const method = resolveAuthMethod(existingEmailUser);
        if (method && method !== 'google') throw accountMethodConflict(method);
        if (method === 'google') throw new ConflictError('EMAIL_ALREADY_EXISTS', 'A Google account already uses this email, but it has a different Google identity.');
        throw new ConflictError('ACCOUNT_METHOD_CONFLICT', 'This account has an unsupported sign-in setup. Contact support before continuing.');
      }
      return {
        kind: 'profile-completion-required',
        profile: { email: identity.email, firstName: identity.firstName, middleName: '', lastName: identity.lastName },
        pendingRegistration: { ...identity, expiresAt: now().getTime() + PENDING_GOOGLE_TTL_MS },
      };
    },

    async completeGoogleSignup({ pendingRegistration, firstName, middleName, lastName, username, termsAccepted, ip }) {
      await rateLimit('google-complete', ip, pendingRegistration?.email);
      if (!pendingRegistration || Number(pendingRegistration.expiresAt) <= now().getTime()) {
        throw new HttpError(401, 'GOOGLE_REGISTRATION_EXPIRED', 'This Google sign-up expired. Start again.');
      }
      if (termsAccepted !== true) throw new ValidationError('Acknowledge the Terms and Conditions to create an account.');
      const cleanUsername = validateUsername(username);
      if (cleanUsername.error) throw new ValidationError(cleanUsername.error, [{ field: 'username', code: 'INVALID_USERNAME' }]);
      const names = validateNames({ firstName, middleName, lastName });
      const existingEmail = await UserModel.findOne({ emailNormalized: pendingRegistration.email }).select('authMethod authProviders +passwordHash +googleSub');
      if (existingEmail) {
        const method = resolveAuthMethod(existingEmail);
        if (method && method !== 'google') throw accountMethodConflict(method);
        throw new ConflictError('EMAIL_ALREADY_EXISTS', 'An account already uses this email address.');
      }
      if (await UserModel.exists({ usernameNormalized: cleanUsername.normalized })) throw new ConflictError('USERNAME_ALREADY_TAKEN', 'That username is already in use.');
      try {
        const user = await createMemberAndProgression(makeUserIdentity({
          username: cleanUsername.username,
          email: pendingRegistration.email,
          names,
          googleSub: pendingRegistration.sub,
          now: now(),
        }));
        return { member: toAuthMember(user), sessionUser: user, requiresScheduleSetup: true };
      } catch (error) {
        if (error?.code === 11000) throw duplicateIdentityError(error);
        throw error;
      }
    },

    async changePassword({ userId, currentPassword, newPassword, confirmPassword, ip }) {
      await rateLimit('change', ip, String(userId));
      validatePasswordPair(newPassword, confirmPassword, passwordTools);
      if (typeof currentPassword !== 'string' || Buffer.byteLength(currentPassword, 'utf8') > 1024) throw new ValidationError('Enter your current password.');
      const user = await UserModel.findOne({ _id: userId, identityKind: 'account', accountStatus: 'active' }).select('+passwordHash +emailNormalized +authVersion');
      if (!user?.authProviders?.localPassword || !user.passwordHash || !await passwordTools.verifyPassword(currentPassword, user.passwordHash)) {
        throw new HttpError(401, 'INVALID_CREDENTIALS', 'The current password is incorrect.');
      }
      const passwordHash = await passwordTools.hashPassword(newPassword);
      const updated = await transaction(async (mongoSession) => {
        const current = await UserModel.findOne({ _id: userId, authVersion: user.authVersion }).select('+passwordHash +emailNormalized +authVersion').session(mongoSession);
        if (!current || !await passwordTools.verifyPassword(currentPassword, current.passwordHash)) throw new HttpError(401, 'INVALID_CREDENTIALS', 'The current password is incorrect.');
        current.passwordHash = passwordHash;
        current.authVersion = (current.authVersion || 0) + 1;
        await current.save({ session: mongoSession });
        return current;
      });
      return { member: toAuthMember(updated), sessionUser: updated, message: 'Password updated. Other active sessions were signed out.' };
    },

    async resetPassword({ identifier, code, newPassword, confirmPassword, ip }) {
      const normalized = normalizeLoginIdentifier(identifier);
      await rateLimit('reset', ip, normalized || undefined);
      if (!normalized || !isRecoveryCodeFormat(code)) throw new HttpError(400, 'RECOVERY_CODE_INVALID', GENERIC_RECOVERY_ERROR);
      validatePasswordPair(newPassword, confirmPassword, passwordTools);
      const digest = recoveryCodeDigest(code, ensureRecoverySecret(settings));
      const passwordHash = await passwordTools.hashPassword(newPassword);
      const changed = await transaction(async (mongoSession) => {
        const user = await findLoginAccount(normalized, { session: mongoSession });
        if (!user || user.accountStatus !== 'active' || !user.authProviders?.localPassword || !user.passwordHash
          || !user.recoveryCodeHashes?.includes(digest)) return false;
        const update = await UserModel.updateOne({
          _id: user._id,
          authVersion: user.authVersion,
          recoveryCodeHashes: digest,
          accountStatus: 'active',
        }, {
          $pull: { recoveryCodeHashes: digest },
          $set: { passwordHash },
          $inc: { authVersion: 1 },
        }, { session: mongoSession, runValidators: true });
        return update.modifiedCount === 1;
      });
      if (!changed) throw new HttpError(400, 'RECOVERY_CODE_INVALID', GENERIC_RECOVERY_ERROR);
      return { message: 'Password updated. Sign in again with your new password.' };
    },

    async regenerateRecoveryCodes({ userId, currentPassword, ip }) {
      await rateLimit('recovery-codes', ip, String(userId));
      const user = await UserModel.findOne({ _id: userId, identityKind: 'account', accountStatus: 'active' }).select('+passwordHash +emailNormalized +authVersion +googleSub +recoveryCodeHashes');
      if (!user) throw new NotFoundError('The account could not be found.');
      if (resolveAuthMethod(user) === 'local') {
        if (typeof currentPassword !== 'string' || !await passwordTools.verifyPassword(currentPassword, user.passwordHash)) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Confirm your current password to replace recovery codes.');
      } else throw new ConflictError('RECOVERY_NOT_AVAILABLE', 'Recovery codes are available only for Local Accounts. Use Google account recovery for this account.');
      const recovery = newRecoveryCodeSet();
      const result = await UserModel.updateOne({ _id: userId, authVersion: user.authVersion }, { $set: { recoveryCodeHashes: recovery.hashes } }, { runValidators: true });
      if (result.modifiedCount !== 1) throw new ConflictError('ACCOUNT_CHANGED', 'The account changed. Refresh and try again.');
      return { recoveryCodes: recovery.codes };
    },

    async updateIdentity({ userId, username, firstName, middleName, lastName }) {
      const cleanUsername = validateUsername(username);
      if (cleanUsername.error) throw new ValidationError(cleanUsername.error, [{ field: 'username', code: 'INVALID_USERNAME' }]);
      const names = validateNames({ firstName, middleName, lastName });
      const duplicate = await UserModel.exists({ usernameNormalized: cleanUsername.normalized, _id: { $ne: userId } });
      if (duplicate) throw new ConflictError('USERNAME_ALREADY_TAKEN', 'That username is already in use.');
      try {
        const user = await UserModel.findOneAndUpdate({ _id: userId, identityKind: 'account', accountStatus: 'active' }, {
          $set: { username: cleanUsername.username, usernameNormalized: cleanUsername.normalized, ...names },
        }, { new: true, runValidators: true }).select('+emailNormalized +authVersion');
        if (!user) throw new NotFoundError('The account could not be found.');
        return { member: toAuthMember(user) };
      } catch (error) {
        if (error?.code === 11000 && errorCodeMatches(error, 'usernameNormalized')) throw duplicateIdentityError(error);
        throw error;
      }
    },

    async currentMember(user) {
      return user?.accountStatus === 'active' ? toAuthMember(user) : null;
    },
  });
}

export const authService = createAuthService();
