import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../config/env.js';

test('development config provides loopback origins and accepts optional MongoDB for tests only', () => {
  assert.equal(loadConfig({ NODE_ENV: 'development' }).port, 5001);
  const result = loadConfig({ NODE_ENV: 'development', PORT: '5050' });
  assert.equal(result.port, 5050);
  assert.equal(result.mongoUri, 'mongodb://127.0.0.1:27017/the-system?replicaSet=rs0');
  assert.ok(result.trustedOrigins.includes('http://localhost:5176'));
  assert.ok(!result.trustedOrigins.includes('https://example.com'));
  assert.ok(Buffer.byteLength(result.authSessionSecret) >= 32);
  assert.ok(Buffer.byteLength(result.recoveryCodeHmacSecret) >= 32);
  assert.notEqual(result.authSessionSecret, result.recoveryCodeHmacSecret);
  assert.equal(loadConfig({ NODE_ENV: 'test' }).mongoUri, undefined);
  assert.equal(result.appBaseUrl, 'http://localhost:5175');
  assert.equal(result.googleCallbackUrl, 'http://localhost:5175/api/v1/auth/google/callback');
});

test('Review Mode reads only explicit true or false values and defaults off when omitted', () => {
  assert.equal(loadConfig({ NODE_ENV: 'development' }).appReviewMode, false);
  assert.equal(loadConfig({ NODE_ENV: 'development', APP_REVIEW_MODE: 'true' }).appReviewMode, true);
  assert.equal(loadConfig({ NODE_ENV: 'development', APP_REVIEW_MODE: ' TRUE ' }).appReviewMode, true);
  assert.equal(loadConfig({ NODE_ENV: 'development', APP_REVIEW_MODE: 'false' }).appReviewMode, false);
  assert.throws(() => loadConfig({ NODE_ENV: 'development', APP_REVIEW_MODE: 'enabled' }), /APP_REVIEW_MODE must be true or false/);
});

test('backend port configuration rejects port zero in every environment', () => {
  assert.throws(() => loadConfig({ NODE_ENV: 'development', PORT: '0' }), /PORT/);
  assert.throws(() => loadConfig({
    NODE_ENV: 'production', PORT: '0',
    MONGODB_URI: 'mongodb://127.0.0.1:27017/the-system',
    AUTH_SESSION_SECRET: 's'.repeat(48), RECOVERY_CODE_HMAC_SECRET: 'r'.repeat(48),
    AUTH_TRUSTED_ORIGINS: 'https://system.example', APP_BASE_URL: 'https://system.example',
  }), /PORT/);
});

test('development recovery-code protection derives from a configured session secret when supplied', () => {
  const sessionSecret = 's'.repeat(48);
  const result = loadConfig({ NODE_ENV: 'development', AUTH_SESSION_SECRET: sessionSecret });
  assert.equal(result.authSessionSecret, sessionSecret);
  assert.ok(Buffer.byteLength(result.recoveryCodeHmacSecret) >= 32);
  assert.notEqual(result.recoveryCodeHmacSecret, sessionSecret);
});

test('production requires stable session and recovery-code secrets, HTTPS origins and application origin', () => {
  assert.throws(() => loadConfig({ NODE_ENV: 'production' }), /MONGODB_URI is required/);
  const valid = {
    NODE_ENV: 'production', MONGODB_URI: 'mongodb://database.example/system',
    AUTH_SESSION_SECRET: 's'.repeat(48), RECOVERY_CODE_HMAC_SECRET: 'r'.repeat(48),
    AUTH_TRUSTED_ORIGINS: 'https://system.example', APP_BASE_URL: 'https://system.example',
    GOOGLE_CLIENT_ID: 'google-client-id', GOOGLE_CLIENT_SECRET: 'google-client-secret',
    GOOGLE_CALLBACK_URL: 'https://system.example/api/v1/auth/google/callback',
  };
  const result = loadConfig(valid);
  assert.equal(result.authSessionCookieName, '__Host-the-system.sid');
  assert.equal(result.googleClientId, 'google-client-id');
  assert.equal(result.googleOAuthEnabled, true);
  assert.equal(loadConfig({ ...valid, GOOGLE_CLIENT_SECRET: '' }).googleOAuthEnabled, false);
  assert.throws(() => loadConfig({ ...valid, RECOVERY_CODE_HMAC_SECRET: undefined }), /RECOVERY_CODE_HMAC_SECRET/);
  assert.throws(() => loadConfig({ ...valid, AUTH_TRUSTED_ORIGINS: 'http://system.example' }), /trusted origins must use HTTPS/);
  assert.throws(() => loadConfig({ ...valid, APP_BASE_URL: 'https://other.example' }), /must be included/);
});

test('configuration rejects invalid environment, Mongo scheme, CORS patterns and development remote origins', () => {
  assert.throws(() => loadConfig({ NODE_ENV: 'preview' }), /NODE_ENV/);
  assert.throws(() => loadConfig({ NODE_ENV: 'test', PORT: '70000' }), /PORT/);
  assert.throws(() => loadConfig({ NODE_ENV: 'test', MONGODB_URI: 'http://localhost' }), /MONGODB_URI/);
  assert.throws(() => loadConfig({ NODE_ENV: 'test', CORS_ORIGINS: '*' }), /CORS_ORIGINS/);
  assert.throws(() => loadConfig({ NODE_ENV: 'development', CORS_ORIGINS: 'https://remote.example' }), /loopback/);
  assert.deepEqual(loadConfig({ NODE_ENV: 'test', CORS_ORIGINS: 'https://app.example, http://localhost:5173' }).corsOrigins, ['https://app.example', 'http://localhost:5173']);
});
