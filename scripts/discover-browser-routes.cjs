const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const appFile = path.join(root, 'client/src/App.jsx');
const navigationFile = path.join(root, 'client/src/data/applicationNavigation.js');
const rankFile = path.join(root, 'client/src/data/ranks.js');
const legalFile = path.join(root, 'client/src/data/legalDocuments.js');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function extractRoutes() {
  const source = read(appFile);
  const lines = source.split(/\r?\n/);
  let appShellOpen = false;
  const routes = [];

  for (const line of lines) {
    if (/<\/Route>/.test(line)) appShellOpen = false;

    const opening = line.match(/<Route\b/);
    if (!opening) continue;
    const pathMatch = line.match(/\bpath="([^"]+)"/);
    const isIndex = /\bindex\b/.test(line);
    const localPath = pathMatch?.[1] || null;
    const routePath = localPath === null
      ? null
      : localPath.startsWith('/') || !appShellOpen
        ? localPath
        : `/app/${localPath}`;

    if (!isIndex && routePath !== null && routePath !== '*') {
      const nestedComponents = [...line.matchAll(/<([A-Z][A-Za-z0-9]+)\b/g)]
        .map((match) => match[1])
        .filter((name) => !['Route', 'RouteView', 'RouteErrorBoundary'].includes(name));
      const component = nestedComponents.at(-1) || (routePath === '/app' ? 'AppLayout' : 'Unknown');
      routes.push({
        path: routePath || '/',
        component,
        requiresApplicationShell: routePath === '/app' || routePath.startsWith('/app/'),
        lazilyLoaded: component !== 'LandingPage' && component !== 'Navigate',
        source: 'client/src/App.jsx',
      });
    }

    if (localPath === '/app') appShellOpen = true;
  }

  return routes;
}

function expandDataBackedRoutes(routes) {
  const ranks = [...read(rankFile).matchAll(/slug:\s*'([^']+)'/g)].map((match) => match[1]);
  const legal = [...read(legalFile).matchAll(/^\s{2}(?:'([^']+)'|([\w-]+)):\s*\{\s*title:/gm)]
    .map((match) => match[1] || match[2]);
  const navigation = [...read(navigationFile).matchAll(/path:\s*'([^']+)'/g)].map((match) => match[1]);
  const expanded = [];

  for (const route of routes) {
    if (route.path === '/ranks/:rankSlug') {
      for (const slug of ranks) expanded.push({ ...route, path: `/ranks/${slug}`, routePattern: route.path, dataKey: slug });
    } else if (route.path === '/legal/:slug') {
      for (const slug of legal) expanded.push({ ...route, path: `/legal/${slug}`, routePattern: route.path, dataKey: slug });
    } else if (route.path === '/app/profile/:memberId') {
      expanded.push({ ...route, testPath: null, routePattern: route.path, note: 'Requires a real public member ID from the active local data.' });
    } else {
      expanded.push(route);
    }
  }

  const known = new Set(expanded.map((route) => route.path));
  for (const routePath of navigation) {
    if (known.has(routePath)) continue;
    const page = routePath.split('/').filter(Boolean).at(-1) || 'Application';
    expanded.push({
      path: routePath,
      component: 'AppPlaceholderPage',
      requiresApplicationShell: true,
      lazilyLoaded: true,
      source: 'client/src/data/applicationNavigation.js (rendered by App.jsx)',
      note: 'Placeholder page from the registered application navigation configuration.',
    });
    known.add(routePath);
  }

  return expanded;
}

function discoverRoutes() {
  return expandDataBackedRoutes(extractRoutes()).map((route) => ({
    ...route,
    testPath: route.testPath === undefined ? route.path : route.testPath,
    identity: route.requiresApplicationShell ? 'application development identity/provider' : 'not required',
  }));
}

if (require.main === module) {
  const inventory = discoverRoutes();
  process.stdout.write(`${JSON.stringify({ generatedFrom: ['client/src/App.jsx', 'client/src/data/applicationNavigation.js', 'client/src/data/ranks.js', 'client/src/data/legalDocuments.js'], count: inventory.length, routes: inventory }, null, 2)}\n`);
}

module.exports = { discoverRoutes };
