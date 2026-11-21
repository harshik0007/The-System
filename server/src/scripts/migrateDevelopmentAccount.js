import mongoose from 'mongoose';
import { createInterface } from 'node:readline/promises';
import { StringDecoder } from 'node:string_decoder';
import { stdin, stdout } from 'node:process';
import { config } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import User from '../models/User.js';
import ProgressionRun from '../models/ProgressionRun.js';
import TaskSchedule from '../models/TaskSchedule.js';
import Task from '../models/Task.js';
import TaskOccurrence from '../models/TaskOccurrence.js';
import RecoveryQuest from '../models/RecoveryQuest.js';
import Notification from '../models/Notification.js';
import { initializeAuthStorage } from '../services/authStorage.js';
import { getPasswordValidationError, hashPassword } from '../services/passwordService.js';
import { withMongoTransaction } from '../services/mongoTransaction.js';
import { createFreshProgressionRunWithinSession } from '../services/progressionRunFactory.js';
import { generateRecoveryCodes, recoveryCodeDigest, validateIdentityEmail, validatePersonalName, validateUsername } from '../utils/identity.js';

const APPLY = process.argv.includes('--apply');
const CONFIRMATION = 'MIGRATE DEVELOPMENT ACCOUNT';
const prompt = createInterface({ input: stdin, output: stdout });

async function hiddenPrompt(label) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') throw new Error('Password entry requires an interactive terminal.');
  stdout.write(label);
  const decoder = new StringDecoder('utf8');
  let value = '';
  return new Promise((resolve, reject) => {
    const previousRawMode = stdin.isRaw;
    const finish = (error) => {
      stdin.off('data', onData); stdin.setRawMode(previousRawMode); stdin.pause(); stdout.write('\n');
      if (error) reject(error); else resolve(value);
    };
    const onData = (chunk) => {
      for (const character of decoder.write(chunk)) {
        if (character === '\u0003') return finish(new Error('Migration cancelled.'));
        if (character === '\r' || character === '\n') return finish();
        if (character === '\u007f' || character === '\b') value = [...value].slice(0, -1).join('');
        else if (character >= ' ') value += character;
      }
    };
    stdin.setRawMode(true); stdin.resume(); stdin.on('data', onData);
  });
}

function validatedName(value, label, required = true) {
  const result = validatePersonalName(value, label, { required });
  if (result.error) throw new Error(result.error);
  return result.value;
}

function safeErrorMessage(error) {
  return (error instanceof Error ? error.message : 'unknown error').replace(/mongodb(?:\+srv)?:\/\/[^\s"'`]+/gi, '[REDACTED_MONGODB_URI]');
}

async function main() {
  if (config.nodeEnv !== 'development' || !config.developmentIdentitySelector) {
    throw new Error('This explicit migration is only available in development when DEV_IDENTITY_SELECTOR is configured.');
  }
  if (!stdin.isTTY && APPLY) throw new Error('The --apply migration requires an interactive terminal. Preview mode remains safe for automation.');
  mongoose.set('autoIndex', false);
  await connectDatabase();
  try {
    const seed = await User.findOne({ developmentIdentitySelector: config.developmentIdentitySelector, identityKind: 'development-seed' })
      .select('+developmentIdentitySelector +emailNormalized +usernameNormalized +passwordHash +authVersion').lean();
    if (!seed) throw new Error('The configured development seed was not found. No records were changed.');
    if (seed.emailNormalized || seed.usernameNormalized || seed.passwordHash || seed.accountStatus !== 'active') {
      throw new Error('The seed is already migrated or is not eligible. No records were changed.');
    }
    const activeRuns = await ProgressionRun.countDocuments({ userId: seed._id, status: 'active' });
    if (activeRuns > 1) throw new Error('The seed has multiple active ProgressionRuns. Resolve them before migration.');
    const preserved = {
      userIdPreserved: true,
      memberSince: seed.memberSince,
      accountCreatedAt: seed.createdAt?.toISOString?.() || null,
      activeProgressionRuns: activeRuns,
      totalProgressionRuns: await ProgressionRun.countDocuments({ userId: seed._id }),
      taskSchedules: await TaskSchedule.countDocuments({ userId: seed._id }),
      tasks: await Task.countDocuments({ userId: seed._id }),
      taskOccurrences: await TaskOccurrence.countDocuments({ userId: seed._id }),
      recoveryQuests: await RecoveryQuest.countDocuments({ userId: seed._id }),
      notifications: await Notification.countDocuments({ userId: seed._id }),
      nameReview: 'First, optional Middle, and Last Name will be entered explicitly; no automatic name splitting is performed.',
    };
    console.info(JSON.stringify({ mode: APPLY ? 'interactive-apply' : 'preview-only', seedFound: true, preserved }, null, 2));
    if (!APPLY) {
      console.info('Preview only. No account data changed. After review, run the explicit interactive --apply command.');
      return;
    }

    await initializeAuthStorage();
    const stableSecretConfigured = Boolean(process.env.RECOVERY_CODE_HMAC_SECRET?.trim() || process.env.AUTH_SESSION_SECRET?.trim());
    if (!stableSecretConfigured || !config.recoveryCodeHmacSecret || Buffer.byteLength(config.recoveryCodeHmacSecret) < 32) {
      throw new Error('Set a stable RECOVERY_CODE_HMAC_SECRET or AUTH_SESSION_SECRET before migrating an account. No account fields were changed.');
    }
    const email = validateIdentityEmail(await prompt.question('Sign-in email for this existing account: '));
    if (!email) throw new Error('Enter a valid email address. No account fields were changed.');
    const usernameInput = await prompt.question('Unique username: ');
    const username = validateUsername(usernameInput);
    if (username.error) throw new Error(`${username.error} No account fields were changed.`);
    const firstName = validatedName(await prompt.question('First Name: '), 'First name');
    const middleName = validatedName(await prompt.question('Middle Name (optional; press Enter to skip): '), 'Middle name', false);
    const lastName = validatedName(await prompt.question('Last Name: '), 'Last name');
    if (await User.exists({ emailNormalized: email, _id: { $ne: seed._id } })) throw new Error('That email already belongs to another User. No records were changed.');
    if (await User.exists({ usernameNormalized: username.normalized, _id: { $ne: seed._id } })) throw new Error('That username already belongs to another User. No records were changed.');
    const confirmation = await prompt.question(`This keeps User ID ${String(seed._id)} and its history. Type ${CONFIRMATION} to continue: `);
    if (confirmation !== CONFIRMATION) throw new Error('Confirmation did not match. No records were changed.');
    const password = await hiddenPrompt('Choose a password with at least 8 characters, one letter, one digit and one symbol (hidden): ');
    const confirmPassword = await hiddenPrompt('Confirm password (hidden): ');
    const passwordError = getPasswordValidationError(password);
    if (passwordError) throw new Error(passwordError);
    if (password !== confirmPassword) throw new Error('Password confirmation does not match.');
    const passwordHash = await hashPassword(password);
    const codes = generateRecoveryCodes(10);
    const recoveryCodeHashes = codes.map((code) => recoveryCodeDigest(code, config.recoveryCodeHmacSecret));
    const now = new Date();

    await withMongoTransaction(async (session) => {
      const current = await User.findOne({
        _id: seed._id, identityKind: 'development-seed', developmentIdentitySelector: config.developmentIdentitySelector,
        emailNormalized: { $exists: false }, usernameNormalized: { $exists: false }, passwordHash: { $exists: false }, accountStatus: 'active',
      }).select('+developmentIdentitySelector +authVersion').session(session);
      if (!current || await User.exists({ $or: [{ emailNormalized: email }, { usernameNormalized: username.normalized }], _id: { $ne: seed._id } }).session(session)) {
        throw new Error('The seed or identity values changed while migrating. No conflicting account was changed.');
      }
      current.identityKind = 'account';
      current.developmentIdentitySelector = undefined;
      current.emailNormalized = email;
      current.username = username.username;
      current.usernameNormalized = username.normalized;
      current.firstName = firstName;
      current.middleName = middleName;
      current.lastName = lastName;
      current.passwordHash = passwordHash;
      current.authMethod = 'local';
      current.authProviders = { localPassword: true, google: false };
      current.emailVerified = false;
      current.emailVerifiedAt = null;
      current.recoveryCodeHashes = recoveryCodeHashes;
      current.accountStatus = 'active';
      current.authVersion = (current.authVersion || 0) + 1;

      let activeRun = await ProgressionRun.findOne({ userId: current._id, status: 'active' }).session(session);
      if (!activeRun) {
        const latestRun = await ProgressionRun.findOne({ userId: current._id }).sort({ runNumber: -1 }).session(session);
        activeRun = await createFreshProgressionRunWithinSession({ userId: current._id, runNumber: (latestRun?.runNumber || 0) + 1, startedAt: now, session });
      }
      current.currentProgressionRunId = activeRun._id;
      await current.save({ session });
    });
    console.info(JSON.stringify({ migration: 'complete', preservedUserId: String(seed._id), recoveryCodes: codes }, null, 2));
    console.info('Save these ten recovery codes now. They are displayed only during this migration and are not sent by email.');
  } finally {
    prompt.close();
    await disconnectDatabase();
  }
}

main().catch((error) => {
  console.error('Development account migration stopped:', safeErrorMessage(error));
  process.exitCode = 1;
});
