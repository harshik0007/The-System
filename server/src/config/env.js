import dotenv from 'dotenv';
import { createHmac, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const envPath = fileURLToPath(new URL('../../.env', import.meta.url));
dotenv.config({ path: envPath });

const supportedEnvironments = new Set(['development', 'test', 'production']);

function parsePort(value, name = 'PORT') {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be an integer between 1 and 65535.`);
  }
  return port;
}

function parseMongoUri(value, nodeEnv) {
  const uri = value || (nodeEnv === 'development' ? 'mongodb://127.0.0.1:27017/the-system?replicaSet=rs0' : undefined);
  if (!uri) {
    if (nodeEnv === 'test') return undefined;
    throw new Error('MONGODB_URI is required outside development.');
  }
  if (!/^mongodb(?:\+srv)?:\/\//i.test(uri)) throw new Error('MONGODB_URI must use the mongodb:// or mongodb+srv:// scheme.');
  return uri;
}

function parseCorsOrigins(value) {
  if (!value?.trim()) return [];
  return value.split(',').map((entry) => {
    const origin = entry.trim();
    let parsed;
    try { parsed = new URL(origin); } catch { throw new Error('CORS_ORIGINS must contain comma-separated origin URLs.'); }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin || origin.includes('*')) {
      throw new Error('CORS_ORIGINS must contain exact http(s) origins without paths or wildcards.');
    }
    return parsed.origin;
  });
}

function isLoopbackOrigin(origin) {
  const hostname = new URL(origin).hostname.toLowerCase();
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function parseTrustedOrigins(env) {
  const configured = env.AUTH_TRUSTED_ORIGINS?.trim() || env.CORS_ORIGINS?.trim();
  if (configured) return parseCorsOrigins(configured);
  if (env.NODE_ENV === 'production') return [];
  const vitePorts = Array.from({ length: 27 }, (_, index) => 5173 + index);
  return [
    ...vitePorts.flatMap((port) => [`http://localhost:${port}`, `http://127.0.0.1:${port}`]),
    'http://localhost:4173', 'http://127.0.0.1:4173',
  ];
}

function parseNonNegativeInteger(value, name, fallback = 0, maximum = 5) {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > maximum) throw new Error(`${name} must be an integer between 0 and ${maximum}.`);
  return parsed;
}

function parseAppBaseUrl(value, nodeEnv) {
  const input = value?.trim() || (nodeEnv === 'production' ? undefined : 'http://localhost:5175');
  if (!input) return undefined;
  let parsed;
  try { parsed = new URL(input); } catch { throw new Error('APP_BASE_URL must be an absolute http(s) URL.'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== input.replace(/\/$/, '')) {
    throw new Error('APP_BASE_URL must be an origin URL without a path, query or fragment.');
  }
  if (nodeEnv === 'production' && parsed.protocol !== 'https:') throw new Error('APP_BASE_URL must use HTTPS in production.');
  return parsed.origin;
}

function parseGoogleCallbackUrl(value, nodeEnv) {
  const input = value?.trim() || (nodeEnv === 'development' ? 'http://localhost:5175/api/v1/auth/google/callback' : undefined);
  if (!input) return undefined;
  let parsed;
  try { parsed = new URL(input); } catch { throw new Error('GOOGLE_CALLBACK_URL must be an absolute http(s) URL.'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.href !== input) {
    throw new Error('GOOGLE_CALLBACK_URL must be an absolute URL without a fragment.');
  }
  if (nodeEnv === 'development' && input !== 'http://localhost:5175/api/v1/auth/google/callback') {
    throw new Error('The development Google callback must be http://localhost:5175/api/v1/auth/google/callback.');
  }
  if (nodeEnv === 'production' && parsed.protocol !== 'https:') throw new Error('GOOGLE_CALLBACK_URL must use HTTPS in production.');
  return parsed.href;
}

export function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV ?? 'development';
  if (!supportedEnvironments.has(nodeEnv)) throw new Error('NODE_ENV must be development, test, or production.');
  const mongoUri = parseMongoUri(env.MONGODB_URI, nodeEnv);
  const developmentIdentitySelector = env.DEV_IDENTITY_SELECTOR?.trim() || undefined;
  if (nodeEnv === 'production' && developmentIdentitySelector) throw new Error('DEV_IDENTITY_SELECTOR is not allowed in production.');

  const corsOrigins = parseCorsOrigins(env.CORS_ORIGINS);
  if (nodeEnv === 'development' && corsOrigins.some((origin) => !isLoopbackOrigin(origin))) throw new Error('Development CORS origins must resolve to localhost or a loopback address.');
  const trustedOrigins = parseTrustedOrigins({ ...env, NODE_ENV: nodeEnv });
  if (nodeEnv === 'development' && trustedOrigins.some((origin) => !isLoopbackOrigin(origin))) throw new Error('Development trusted origins must resolve to localhost or a loopback address.');
  if (nodeEnv === 'production' && trustedOrigins.some((origin) => new URL(origin).protocol !== 'https:')) throw new Error('Production trusted origins must use HTTPS.');
  const appBaseUrl = parseAppBaseUrl(env.APP_BASE_URL, nodeEnv);
  if (appBaseUrl && nodeEnv === 'production' && !trustedOrigins.includes(appBaseUrl)) throw new Error('APP_BASE_URL must be included in AUTH_TRUSTED_ORIGINS in production.');
  const googleClientId = env.GOOGLE_CLIENT_ID?.trim() || undefined;
  const googleClientSecret = env.GOOGLE_CLIENT_SECRET?.trim() || undefined;
  const googleCallbackUrl = parseGoogleCallbackUrl(env.GOOGLE_CALLBACK_URL, nodeEnv);
  const googleOAuthEnabled = Boolean(googleClientId && googleClientSecret && googleCallbackUrl);

  // A local development install should be able to exercise signup without a
  // hand-edited secret file. This process-local key is intentionally ephemeral;
  // configure AUTH_SESSION_SECRET when local sessions/recovery codes must
  // survive a backend restart. Production still requires both explicit keys.
  const configuredSessionSecret = env.AUTH_SESSION_SECRET?.trim() || undefined;
  const sessionSecret = configuredSessionSecret
    || (nodeEnv === 'development' ? randomBytes(48).toString('base64url') : undefined);
  const recoveryCodeHmacSecret = env.RECOVERY_CODE_HMAC_SECRET?.trim()
    || (nodeEnv === 'development' && sessionSecret
      ? createHmac('sha256', sessionSecret).update('the-system:recovery-code-hmac:v1').digest('base64url')
      : undefined);
  if (nodeEnv === 'production') {
    for (const [name, secret] of [['AUTH_SESSION_SECRET', sessionSecret], ['RECOVERY_CODE_HMAC_SECRET', recoveryCodeHmacSecret]]) {
      if (!secret || Buffer.byteLength(secret) < 32) throw new Error(`${name} must contain at least 32 bytes in production.`);
    }
    if (!trustedOrigins.length) throw new Error('AUTH_TRUSTED_ORIGINS must contain exact HTTPS origins in production.');
    if (!appBaseUrl) throw new Error('APP_BASE_URL is required in production.');
  }

  return Object.freeze({
    nodeEnv,
    port: parsePort(env.PORT ?? '5001'),
    host: nodeEnv === 'development' ? '127.0.0.1' : '0.0.0.0',
    mongoUri,
    developmentIdentitySelector,
    corsOrigins: Object.freeze(corsOrigins),
    trustedOrigins: Object.freeze(trustedOrigins),
    appBaseUrl,
    authSessionSecret: sessionSecret,
    recoveryCodeHmacSecret,
    googleClientId,
    googleClientSecret,
    googleCallbackUrl,
    googleOAuthEnabled,
    authSessionCookieName: nodeEnv === 'production' ? '__Host-the-system.sid' : 'the-system.sid',
    // Render terminates TLS at its edge. Production must trust at least that
    // proxy hop so Express recognizes HTTPS and express-session emits its
    // Secure cookie; local development remains unproxied by default.
    trustProxyHops: nodeEnv === 'production'
      ? Math.max(1, parseNonNegativeInteger(env.AUTH_TRUST_PROXY_HOPS, 'AUTH_TRUST_PROXY_HOPS', 1))
      : parseNonNegativeInteger(env.AUTH_TRUST_PROXY_HOPS, 'AUTH_TRUST_PROXY_HOPS', 0),
    jsonLimit: '100kb',
  });
}

export const config = loadConfig();
