import { config } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import User from '../models/User.js';
import { getIstDateKey } from '../utils/ist.js';

async function seedDevelopmentUser() {
  if (process.env.NODE_ENV !== 'development' || config.nodeEnv !== 'development') {
    throw new Error('The development seed command is available only when NODE_ENV is exactly development.');
  }
  if (!config.developmentIdentitySelector) {
    throw new Error('DEV_IDENTITY_SELECTOR must be configured before seeding.');
  }

  await connectDatabase();
  await User.updateOne(
    {
      developmentIdentitySelector: config.developmentIdentitySelector,
      identityKind: 'development-seed',
    },
    {
      $setOnInsert: {
        identityKind: 'development-seed',
        developmentIdentitySelector: config.developmentIdentitySelector,
        accountStatus: 'active',
        memberSince: getIstDateKey(),
        resetCount: 0,
        lifetimeLongestStreak: 0,
        highestRankAchieved: null,
        avatarMark: 'initials',
      },
    },
    { upsert: true, setDefaultsOnInsert: true },
  );

  console.info('Development identity seed is ready. No credentials or progression run were created.');
}

try {
  await seedDevelopmentUser();
} catch (error) {
  const message = error instanceof Error
    ? error.message
    : String(error);

  const safeMessage = message.replace(
    /mongodb(?:\+srv)?:\/\/[^\s"'`]+/gi,
    '[REDACTED_MONGODB_URI]',
  );

  console.error('Development identity seed failed:', {
    name: error instanceof Error ? error.name : 'Error',
    message: safeMessage,
  });

  process.exitCode = 1;
} finally {
  try {
    await disconnectDatabase();
  } catch (error) {
    console.error('Database disconnection failed:', error.message);
    process.exitCode = 1;
  }
}
