import { createHash } from 'node:crypto';
import AuthRateLimit from '../models/AuthRateLimit.js';
import { config } from '../config/env.js';
import { HttpError, ServiceUnavailableError } from '../utils/httpErrors.js';

const RULES = Object.freeze({
  signup: { ip: [8, 60 * 60_000], account: [3, 60 * 60_000] },
  login: { ip: [30, 15 * 60_000], account: [10, 15 * 60_000] },
  'username-check': { ip: [40, 15 * 60_000], account: [15, 15 * 60_000] },
  google: { ip: [20, 15 * 60_000], account: [10, 15 * 60_000] },
  'google-complete': { ip: [8, 60 * 60_000], account: [4, 60 * 60_000] },
  'google-link': { ip: [10, 15 * 60_000], account: [5, 15 * 60_000] },
  reset: { ip: [20, 60 * 60_000], account: [10, 60 * 60_000] },
  change: { ip: [10, 15 * 60_000], account: [5, 15 * 60_000] },
  'recovery-codes': { ip: [6, 60 * 60_000], account: [4, 60 * 60_000] },
  'account-delete': { ip: [3, 60 * 60_000], account: [3, 60 * 60_000] },
  'google-delete-reauth': { ip: [5, 60 * 60_000], account: [5, 60 * 60_000] },
});

export function createAuthRateLimitService({ RateLimitModel = AuthRateLimit, now = () => new Date(), nodeEnv = 'development' } = {}) {
  const localBuckets = new Map();

  async function consume(dimension, key, limit, windowMs, action) {
    const instant = now();
    const windowNumber = Math.floor(instant.getTime() / windowMs);
    const bucketId = createHash('sha256').update(`${action}:${dimension}:${key}:${windowNumber}`).digest('hex');
    let count;
    if (nodeEnv === 'test' || nodeEnv === 'development') {
      const existing = localBuckets.get(bucketId) || 0;
      count = existing + 1;
      localBuckets.set(bucketId, count);
    } else {
      try {
        const row = await RateLimitModel.findOneAndUpdate(
          { _id: bucketId },
          { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((windowNumber + 2) * windowMs) } },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );
        count = row.count;
      } catch (error) {
        if (error?.code !== 11000) throw new ServiceUnavailableError('Authentication is temporarily unavailable.');
        const row = await RateLimitModel.findOneAndUpdate({ _id: bucketId }, { $inc: { count: 1 } }, { new: true });
        if (!row) throw new ServiceUnavailableError('Authentication is temporarily unavailable.');
        count = row.count;
      }
    }
    if (count > limit) throw new HttpError(429, 'RATE_LIMITED', 'Too many attempts. Wait before trying again.');
  }

  return Object.freeze({
    async check({ action, ip, accountKey }) {
      const rule = RULES[action];
      if (!rule) throw new TypeError(`Unknown authentication rate limit: ${action}`);
      const [ipLimit, ipWindow] = rule.ip;
      await consume('ip', ip || 'unknown', ipLimit, ipWindow, action);
      if (accountKey) {
        const [accountLimit, accountWindow] = rule.account;
        await consume('account', accountKey, accountLimit, accountWindow, action);
      }
    },
  });
}

export const authRateLimitService = createAuthRateLimitService({ nodeEnv: config.nodeEnv });
