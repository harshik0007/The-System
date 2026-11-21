import mongoose from 'mongoose';
import { randomBytes } from 'node:crypto';
import DailyDisciplineRecord from '../models/DailyDisciplineRecord.js';
import DailyTaskXpAllocation from '../models/DailyTaskXpAllocation.js';
import DailyXpRecord from '../models/DailyXpRecord.js';
import DisciplinePointTransaction from '../models/DisciplinePointTransaction.js';
import DisciplineRewardCycle from '../models/DisciplineRewardCycle.js';
import EmergencyPause from '../models/EmergencyPause.js';
import EmergencyPauseMonthlyUsage from '../models/EmergencyPauseMonthlyUsage.js';
import GracePointTransaction from '../models/GracePointTransaction.js';
import MonthlyAnalysisReminder from '../models/MonthlyAnalysisReminder.js';
import MonthlyAnalysisSummary from '../models/MonthlyAnalysisSummary.js';
import MonthlyAnalysisWorkerCheckpoint from '../models/MonthlyAnalysisWorkerCheckpoint.js';
import Notification from '../models/Notification.js';
import ProgressionResetEvent from '../models/ProgressionResetEvent.js';
import ProgressionRun from '../models/ProgressionRun.js';
import RankEntryEvent from '../models/RankEntryEvent.js';
import RecoveryQuest from '../models/RecoveryQuest.js';
import RecoveryQuestDailyReset from '../models/RecoveryQuestDailyReset.js';
import Task from '../models/Task.js';
import TaskOccurrence from '../models/TaskOccurrence.js';
import TaskSchedule from '../models/TaskSchedule.js';
import TaskScheduleChange from '../models/TaskScheduleChange.js';
import User from '../models/User.js';
import WeeklyTaskChangeUsage from '../models/WeeklyTaskChangeUsage.js';
import XpTransaction from '../models/XpTransaction.js';
import { config } from '../config/env.js';
import { authRateLimitService } from './authRateLimitService.js';
import { withMongoTransaction } from './mongoTransaction.js';
import { verifyPassword } from './passwordService.js';
import { accountRateKey } from '../utils/authPrimitives.js';
import { ConflictError, HttpError, NotFoundError, ServiceUnavailableError, ValidationError } from '../utils/httpErrors.js';

// Every listed model has an explicit User reference and is exclusively owned by
// that account. Shared abuse-limit buckets and system-wide configuration are
// intentionally excluded. There are no external media models in this schema.
export const ACCOUNT_OWNED_DATA_MODELS = Object.freeze([
  DailyTaskXpAllocation, DailyXpRecord, DailyDisciplineRecord,
  DisciplinePointTransaction, DisciplineRewardCycle, EmergencyPause,
  EmergencyPauseMonthlyUsage, GracePointTransaction,
  MonthlyAnalysisReminder, MonthlyAnalysisSummary, MonthlyAnalysisWorkerCheckpoint,
  Notification, ProgressionResetEvent, RankEntryEvent,
  RecoveryQuestDailyReset, RecoveryQuest, TaskOccurrence, TaskScheduleChange,
  WeeklyTaskChangeUsage, XpTransaction, Task, TaskSchedule, ProgressionRun,
]);

const USER_CREDENTIAL_FIELDS = '+passwordHash +googleSub +authVersion +emailNormalized authMethod authProviders identityKind accountStatus';
const DELETION_AUTH_TTL_MS = 5 * 60_000;
const REAUTH_INTENT_TTL_MS = 10 * 60_000;

function authMethodForUser(user) {
  const local = Boolean(user?.passwordHash || user?.authProviders?.localPassword);
  const google = Boolean(user?.googleSub || user?.authProviders?.google);
  if (local === google) return null;
  if (local && (user?.authMethod === 'local' || !user?.authMethod)) return 'local';
  if (google && (user?.authMethod === 'google' || !user?.authMethod)) return 'google';
  return null;
}

function selectUser(UserModel, userId, session) {
  let query = UserModel.findOne({ _id: userId, identityKind: 'account', accountStatus: 'active' }).select(USER_CREDENTIAL_FIELDS);
  if (session) query = query.session(session);
  return query;
}

function assertConfirmation(confirmationPhrase) {
  if (confirmationPhrase !== 'DELETE') {
    throw new ValidationError('Type DELETE exactly to confirm permanent account deletion.', [{ field: 'confirmationPhrase', code: 'CONFIRMATION_REQUIRED' }]);
  }
}

function assertLiveGoogleAuthorization(authorization, user, instant = Date.now()) {
  if (!authorization
    || authorization.userId !== String(user._id)
    || authorization.googleSub !== user.googleSub
    || authorization.authVersion !== (user.authVersion || 0)
    || !Number.isFinite(authorization.expiresAt)
    || authorization.expiresAt <= instant) {
    throw new HttpError(403, 'FRESH_GOOGLE_REAUTH_REQUIRED', 'Verify this Google account again before deleting the THE SYSTEM account.');
  }
}

function removeUserSessions(userId) {
  const database = mongoose.connection.db;
  if (!database) throw new ServiceUnavailableError('The account was deleted, but session cleanup could not reach the database.');
  // connect-mongo stores session data as a JSON string by default, so dotted
  // Mongo paths do not reliably find account IDs inside it. Narrow candidates
  // by the exact ID text, parse them, and delete only rows whose auth or
  // Passport identity matches this account.
  const escapedId = String(userId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (async () => {
    const collection = database.collection('sessions');
    const candidates = await collection.find({
      $or: [
        { 'session.auth.userId': String(userId) },
        { 'session.passport.user': String(userId) },
        { session: { $type: 'string', $regex: escapedId } },
      ],
    }, { projection: { session: 1 } }).toArray();
    const ownedSessionIds = candidates.filter((document) => {
      let value = document.session;
      if (typeof value === 'string') {
        try { value = JSON.parse(value); } catch { return false; }
      }
      return String(value?.auth?.userId || '') === String(userId)
        || String(value?.passport?.user || '') === String(userId);
    }).map(({ _id }) => _id);
    if (!ownedSessionIds.length) return { deletedCount: 0 };
    return collection.deleteMany({ _id: { $in: ownedSessionIds } });
  })();
}

export function createAccountDeletionService({
  UserModel = User,
  ownedModels = ACCOUNT_OWNED_DATA_MODELS,
  rateLimits = authRateLimitService,
  transaction = withMongoTransaction,
  verifyPasswordFn = verifyPassword,
  sessionCleanup = removeUserSessions,
  now = () => new Date(),
  settings = config,
} = {}) {
  async function loadUser(userId) {
    const user = await selectUser(UserModel, userId);
    if (!user) throw new NotFoundError('The current account was not found.');
    return user;
  }

  async function consumeLimit(action, ip, userId) {
    await rateLimits.check({ action, ip, accountKey: accountRateKey(String(userId)) });
  }

  return Object.freeze({
    async status({ userId, authorization }) {
      const user = await loadUser(userId);
      const method = authMethodForUser(user);
      const ready = method === 'google'
        && authorization?.userId === String(user._id)
        && authorization?.googleSub === user.googleSub
        && authorization?.authVersion === (user.authVersion || 0)
        && Number.isFinite(authorization?.expiresAt)
        && authorization.expiresAt > now().getTime();
      return {
        authMethod: method,
        googleReauthAvailable: Boolean(ready),
        googleReauthConfigured: Boolean(settings.googleOAuthEnabled),
      };
    },

    async beginGoogleReauthentication({ userId, ip }) {
      if (!settings.googleOAuthEnabled) throw new ServiceUnavailableError('Google re-authentication is not configured on this deployment.');
      await consumeLimit('google-delete-reauth', ip, userId);
      const user = await loadUser(userId);
      if (authMethodForUser(user) !== 'google' || !user.googleSub) {
        throw new ValidationError('Fresh Google verification is available only for a Google-only account.');
      }
      const instant = now().getTime();
      return {
        userId: String(user._id),
        authVersion: user.authVersion || 0,
        googleSub: user.googleSub,
        nonce: randomBytes(32).toString('base64url'),
        expiresAt: instant + REAUTH_INTENT_TTL_MS,
      };
    },

    async finishGoogleReauthentication({ userId, intent, googleSub }) {
      const instant = now().getTime();
      if (!intent || intent.userId !== String(userId) || !Number.isFinite(intent.expiresAt) || intent.expiresAt <= instant) {
        throw new HttpError(403, 'GOOGLE_REAUTH_EXPIRED', 'The Google verification expired. Start the verification again.');
      }
      const user = await loadUser(userId);
      if (authMethodForUser(user) !== 'google'
        || !user.googleSub
        || user.googleSub !== intent.googleSub
        || user.googleSub !== googleSub
        || (user.authVersion || 0) !== intent.authVersion) {
        throw new HttpError(403, 'GOOGLE_IDENTITY_MISMATCH', 'The verified Google identity does not match this THE SYSTEM account.');
      }
      return {
        userId: String(user._id),
        authVersion: user.authVersion || 0,
        googleSub: user.googleSub,
        authorizedAt: instant,
        expiresAt: instant + DELETION_AUTH_TTL_MS,
      };
    },

    async deleteAccount({ userId, ip, confirmationPhrase, currentPassword, authorization }) {
      assertConfirmation(confirmationPhrase);
      await consumeLimit('account-delete', ip, userId);
      const verifiedUser = await loadUser(userId);
      const method = authMethodForUser(verifiedUser);
      if (method === 'local') {
        if (typeof currentPassword !== 'string' || !currentPassword || !verifiedUser.passwordHash) {
          throw new ValidationError('Enter your current password to delete this account.', [{ field: 'currentPassword', code: 'REQUIRED' }]);
        }
        if (!await verifyPasswordFn(currentPassword, verifiedUser.passwordHash)) {
          throw new HttpError(401, 'CURRENT_PASSWORD_INVALID', 'The current password could not be verified.');
        }
      } else if (method === 'google') {
        if (currentPassword !== undefined) throw new ValidationError('Google-only accounts do not use a THE SYSTEM password.');
        assertLiveGoogleAuthorization(authorization, verifiedUser, now().getTime());
      } else {
        throw new ConflictError('ACCOUNT_METHOD_UNSUPPORTED', 'The account sign-in method could not be verified. Contact support before deletion.');
      }

      const expectedAuthVersion = verifiedUser.authVersion || 0;
      await transaction(async (session) => {
        const current = await selectUser(UserModel, userId, session);
        if (!current || (current.authVersion || 0) !== expectedAuthVersion) {
          throw new ConflictError('ACCOUNT_CHANGED', 'Account credentials changed. Re-authenticate and try again.');
        }
        if (method === 'local' && current.passwordHash !== verifiedUser.passwordHash) {
          throw new ConflictError('ACCOUNT_CHANGED', 'Account credentials changed. Re-authenticate and try again.');
        }
        if (method === 'google') assertLiveGoogleAuthorization(authorization, current, now().getTime());

        // A transactional state change serializes concurrent deletion requests;
        // it is rolled back together with all child deletes if any write fails.
        const claimed = await UserModel.updateOne({
          _id: current._id, identityKind: 'account', accountStatus: 'active', authVersion: expectedAuthVersion,
        }, { $set: { accountStatus: 'deletion-pending' }, $inc: { authVersion: 1 } }, { session, runValidators: true });
        if (claimed.matchedCount !== 1) throw new ConflictError('ACCOUNT_DELETION_IN_PROGRESS', 'Account deletion is already being processed.');

        for (const Model of ownedModels) {
          await Model.deleteMany({ userId: current._id }, { session });
        }
        const removedUser = await UserModel.deleteOne({ _id: current._id, accountStatus: 'deletion-pending' }, { session });
        if (removedUser.deletedCount !== 1) throw new ConflictError('ACCOUNT_DELETION_IN_PROGRESS', 'Account deletion could not be completed safely.');
      });

      // The account record is gone atomically with its owned records. Any old
      // session is already unable to deserialize; this removes its stored rows
      // as an additional cleanup step, scoped to this account only.
      try {
        await sessionCleanup(String(userId));
      } catch (error) {
        // The account record is already gone, so any remaining session fails
        // Passport deserialization. Let the controller still clear the current
        // cookie and return the committed deletion result instead of reporting
        // a false failure after an irreversible transaction.
        console.error('[account-deletion-session-cleanup]', JSON.stringify({
          errorName: error?.name || 'Error',
          code: error?.code || null,
        }));
      }
      return { deleted: true };
    },
  });
}

export const accountDeletionService = createAccountDeletionService();
