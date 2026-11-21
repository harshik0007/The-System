import AuthRateLimit from '../models/AuthRateLimit.js';
import User from '../models/User.js';

async function findDuplicate(UserModel, field) {
  return UserModel.aggregate([
    { $match: { [field]: { $type: 'string' } } },
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 1 },
  ]);
}

/**
 * Install only new auth indexes after checking existing data. Missing legacy
 * identity fields remain untouched; the explicit owner migration handles them.
 * Old auth_challenges/auth_sessions collections are deliberately not dropped.
 */
export async function initializeAuthStorage({ UserModel = User, RateLimitModel = AuthRateLimit } = {}) {
  for (const field of ['emailNormalized', 'usernameNormalized', 'googleSub']) {
    const duplicates = await findDuplicate(UserModel, field);
    if (duplicates.length) {
      const error = new Error(`Duplicate ${field} values must be resolved by an operator before its authentication index can be created.`);
      error.code = `AUTH_${field.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}_INDEX_CONFLICT`;
      throw error;
    }
  }
  await Promise.all([
    UserModel.collection.createIndex(
      { emailNormalized: 1 },
      { unique: true, name: 'users_email_normalized_unique', partialFilterExpression: { emailNormalized: { $type: 'string' } } },
    ),
    UserModel.collection.createIndex(
      { usernameNormalized: 1 },
      { unique: true, name: 'users_username_normalized_unique', partialFilterExpression: { usernameNormalized: { $type: 'string' } } },
    ),
    UserModel.collection.createIndex(
      { googleSub: 1 },
      { unique: true, name: 'users_google_sub_unique', partialFilterExpression: { googleSub: { $type: 'string' } } },
    ),
    RateLimitModel.createIndexes(),
  ]);
}
