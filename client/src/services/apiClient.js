const API_ROOT = '/api/v1';
let csrfToken = null;
let csrfRequest = null;
let csrfGeneration = 0;

export class ApiError extends Error {
  constructor(status, code, message, details = [], requestId = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = Array.isArray(details) ? details : [];
    this.requestId = requestId;
  }
}

export function invalidateCsrfToken() {
  csrfToken = null;
  csrfGeneration += 1;
}

function isSafeMethod(method) {
  return ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
}

async function getCsrfToken(signal) {
  while (true) {
    const generation = csrfGeneration;
    if (csrfToken?.generation === generation) return csrfToken.value;

    if (csrfRequest) {
      const pendingRequest = csrfRequest;
      try {
        await pendingRequest.promise;
      } catch (error) {
        if (pendingRequest.generation !== generation || generation !== csrfGeneration) continue;
        throw error;
      }
      // A concurrent request may have invalidated the shared token while the
      // bootstrap was in flight. Re-read the current generation before use.
      if (pendingRequest.generation !== generation || generation !== csrfGeneration) continue;
      if (csrfToken?.generation === generation) return csrfToken.value;
      continue;
    }

    const request = { generation, promise: null };
    request.promise = fetch(`${API_ROOT}/auth/csrf`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
      signal,
    }).then(async (response) => {
      const payload = await readJson(response);
      if (!response.ok || typeof payload?.csrfToken !== 'string') {
        throw apiErrorFromResponse(response, payload, 'A secure request token could not be loaded. Retry the action.');
      }
      if (request.generation === csrfGeneration) {
        csrfToken = { value: payload.csrfToken, generation: request.generation };
      }
      return payload.csrfToken;
    }).finally(() => {
      if (csrfRequest === request) csrfRequest = null;
    });
    csrfRequest = request;

    try {
      await request.promise;
    } catch (error) {
      if (generation !== csrfGeneration) continue;
      throw error;
    }
    if (generation === csrfGeneration && csrfToken?.generation === generation) return csrfToken.value;
  }
}

async function readJson(response) {
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  if (!text || !contentType.toLowerCase().includes('json')) return {};
  try { return JSON.parse(text); } catch { return { __invalidJson: true }; }
}

function apiErrorFromResponse(response, payload, fallback = 'The request could not be completed.') {
  const isProxyFailure = !(response.headers.get('content-type') || '').toLowerCase().includes('json') && response.status >= 500;
  if (isProxyFailure) return new ApiError(response.status, 'UPSTREAM_UNAVAILABLE', 'THE SYSTEM could not reach the service. Check that the server is running, then retry.');
  if (payload?.__invalidJson) return new ApiError(response.status, 'INVALID_RESPONSE', 'The service returned an unreadable response.');
  const details = payload?.error?.details;
  const detailMessage = Array.isArray(details) && details.length
    ? details.map((detail) => detail.field?.replaceAll('.', ' ')).filter(Boolean).join(', ')
    : '';
  return new ApiError(
    response.status,
    payload?.error?.code || 'REQUEST_FAILED',
    [payload?.error?.message || fallback, detailMessage].filter(Boolean).join(' '),
    details,
    payload?.error?.requestId || response.headers.get('X-Request-Id'),
  );
}

function announceUnauthorized(path, response) {
  if (typeof window !== 'undefined' && response.status === 401 && !path.startsWith('/auth/')) {
    window.dispatchEvent(new CustomEvent('system:auth-unauthorized'));
  }
}

async function fetchWithCsrf(path, { method, body, headers, signal }) {
  const requestHeaders = { ...headers };
  if (!isSafeMethod(method)) requestHeaders['X-CSRF-Token'] = await getCsrfToken(signal);
  let response;
  try {
    response = await fetch(`${API_ROOT}${path}`, {
      method,
      credentials: 'include',
      headers: requestHeaders,
      body,
      signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new ApiError(0, 'NETWORK_ERROR', 'THE SYSTEM could not reach the service. Check that the server and database are running.');
  }
  if (response.status === 403 && !isSafeMethod(method)) {
    const payload = await readJson(response.clone());
    if (['CSRF_INVALID', 'CSRF_VALIDATION_FAILED', 'INVALID_CSRF_TOKEN'].includes(payload?.error?.code)) {
      invalidateCsrfToken();
      let refreshed = false;
      try {
        await getCsrfToken(signal);
        refreshed = true;
      } catch (error) {
        if (error?.name === 'AbortError') throw error;
      }
      const originalError = apiErrorFromResponse(response, payload);
      throw new ApiError(
        originalError.status,
        originalError.code,
        refreshed
          ? 'Your secure request token was refreshed. Submit again to retry this action.'
          : 'Your secure session could not be refreshed. Refresh the page, then try again.',
        originalError.details,
        originalError.requestId,
      );
    }
  }
  announceUnauthorized(path, response);
  return response;
}

export async function requestApi(path, { method = 'GET', body, idempotencyKey, signal, accept = 'application/json' } = {}) {
  const normalizedMethod = method.toUpperCase();
  const headers = { Accept: accept };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const response = await fetchWithCsrf(path, {
    method: normalizedMethod,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  const payload = await readJson(response);
  if (!response.ok) throw apiErrorFromResponse(response, payload, 'The request could not be completed.');
  if (payload?.__invalidJson || !(response.headers.get('content-type') || '').toLowerCase().includes('json')) {
    throw new ApiError(response.status, 'INVALID_RESPONSE', 'The service returned an unreadable response.');
  }
  if (typeof window !== 'undefined' && !isSafeMethod(normalizedMethod)
    && !path.startsWith('/auth/') && !path.startsWith('/notifications') && !path.startsWith('/notification-preferences')) {
    window.dispatchEvent(new Event('system:notifications-refresh'));
  }
  if (['/auth/signup', '/auth/login', '/auth/google', '/auth/google/complete', '/auth/change-password', '/auth/logout', '/auth/account/delete', '/auth/reset-password'].includes(path)) invalidateCsrfToken();
  return payload;
}

export async function requestApiBlob(path, { signal, accept = 'application/pdf, application/json' } = {}) {
  const response = await fetchWithCsrf(path, { method: 'GET', headers: { Accept: accept }, signal });
  if (!response.ok) {
    const payload = await readJson(response.clone());
    throw apiErrorFromResponse(response, payload, 'The report could not be generated.');
  }
  if (!(response.headers.get('content-type') || '').toLowerCase().includes('application/pdf')) {
    throw new ApiError(response.status, 'INVALID_RESPONSE', 'The Monthly Analysis service returned an invalid report file.');
  }
  return response.blob();
}
