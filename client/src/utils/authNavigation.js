const DEFAULT_AUTHENTICATED_DESTINATION = '/app/dashboard';

/** Accept only same-origin destinations inside the authenticated app shell. */
export function safeAuthenticatedDestination(candidate) {
  if (typeof candidate !== 'string' || !candidate.startsWith('/app')
    || candidate.startsWith('//') || candidate.includes('\\') || /[\u0000-\u001f]/.test(candidate)) {
    return DEFAULT_AUTHENTICATED_DESTINATION;
  }

  try {
    const origin = globalThis.window?.location?.origin || 'http://localhost';
    const target = new URL(candidate, origin);
    if (target.origin !== origin
      || (target.pathname !== '/app' && !target.pathname.startsWith('/app/'))) {
      return DEFAULT_AUTHENTICATED_DESTINATION;
    }
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return DEFAULT_AUTHENTICATED_DESTINATION;
  }
}

