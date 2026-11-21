const SHARED_INFORMATION_ROUTES = [
  /^\/(?:about|how-it-works|features|ranks|badges|rules|faq|getting-started|contact)\/?$/,
  /^\/ranks\/[^/]+\/?$/,
  /^\/legal\/[^/]+\/?$/,
];

export function isApplicationPath(pathname = '') {
  return pathname === '/app' || pathname.startsWith('/app/');
}

export function isSharedInformationPath(pathname = '') {
  return SHARED_INFORMATION_ROUTES.some((pattern) => pattern.test(pathname));
}

export function isAuthenticatedExperiencePath(pathname = '') {
  return isApplicationPath(pathname) || isSharedInformationPath(pathname);
}
