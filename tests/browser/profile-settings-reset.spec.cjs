const { test, expect } = require('@playwright/test');

const categories = ['tasks', 'recovery-quests', 'discipline', 'rank-xp', 'emergency-pause', 'monthly-retention'];

async function installAccountApi(page) {
  const requests = [];
  const state = {
    profile: { displayName: 'Isolated Member', avatarMark: 'initials', publicHandle: 'isolated-member' },
    privacy: { publicProfile: true, activityMap: true, personalBest: true, currentRank: true, level: true, progressionStats: true, currentStreak: true, longestStreak: true, disciplinePointBalance: true, gracePointBalance: true },
    appearance: { voidShardCursor: false, clickRipple: true, nonessentialAnimations: true, reduceDecorativeEffects: false },
    accessibility: { reduceMotion: true },
    notifications: Object.fromEntries(categories.map((category) => [category, category !== 'tasks'])),
    runId: 'isolated-run-1',
    resetPreview: {
      confirmationPhrase: 'RESET', expectedRunNumber: 1,
      reset: ['Current run progress, Rank achievements and Personal Best records will reset.', 'A fresh Origin run will begin.', 'A new Task Schedule must be created.'],
      preserved: ['Account identity and creation date.', 'Member Since, Reset Count and Lifetime Longest Streak.', 'Profile, privacy, appearance, accessibility and notification preferences.', 'M25 Monthly Analysis history remains attached to the old run.'],
    },
  };
  const accountDto = () => ({
    profile: state.profile,
    privacy: state.privacy,
    appearance: state.appearance,
    accessibility: state.accessibility,
    preferencesInitialized: true,
    notificationPreferences: { categories: state.notifications },
    account: { createdAt: '2024-01-01T00:00:00.000Z', memberSince: '2024-01-01', status: 'active', resetCount: 4, lifetimeLongestStreak: 25 },
    progression: { runNumber: state.runId === 'isolated-run-1' ? 1 : 2, startedAt: '2026-11-01T00:00:00.000Z', startedOn: '2026-11-01', currentRank: { slug: 'origin', number: '07', name: 'Origin' }, level: 3, totalXp: 1240, gracePoints: 3, disciplinePoints: 1.25, currentStreak: 2, runLongestStreak: 5, requiresScheduleSetup: state.runId !== 'isolated-run-1', emergencyPauseActive: false, emergencyPauseAllowance: 2, emergencyPauseActivationsUsed: 0 },
    achievements: { highestRankAchieved: 'zenith', personalBestRecords: { overall: { bestPosition: 2, achievedOn: '2026-10-01' }, discipline: { bestPosition: null, achievedOn: null }, xp: { bestPosition: 4, achievedOn: '2026-10-02' }, highestRankAchieved: { rankSlug: 'zenith', rankNumber: '02', rankName: 'Zenith', achievedOn: null } }, rankBadges: ['origin'] },
  });
  const progressionDto = () => ({
    progression: { id: state.runId, runNumber: state.runId === 'isolated-run-1' ? 1 : 2, currentRankSlug: 'origin', level: state.runId === 'isolated-run-1' ? 3 : 0, totalXp: state.runId === 'isolated-run-1' ? 1240 : 0, gracePoints: 3, disciplinePoints: 1.25, currentStreak: 2, longestStreak: 5, requiresScheduleSetup: state.runId !== 'isolated-run-1', emergencyPauseActive: false, emergencyPauseAllowanceUsed: 0, emergencyPauseAllowance: 2, startedOn: '2026-11-01', xpSummary: { currentRank: { slug: 'origin', number: '07', name: 'Origin' } } },
    resetCount: 4, lifetimeLongestStreak: 25, highestRankAchieved: state.runId === 'isolated-run-1' ? 'zenith' : null, memberSince: '2024-01-01',
    recentReset: state.runId === 'isolated-run-1' ? null : { id: 'reset-event-1', reason: 'manual-reset-and-restart', occurredAt: '2026-11-19T00:00:00.000Z', resetCount: 4, newProgressionRunId: state.runId },
  });
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    const method = request.method();
    if (path === '/account/settings' && method === 'GET') return json(route, { settings: accountDto() });
    if (path === '/leaderboard/profile-settings' && method === 'GET') return json(route, { settings: { ...state.profile, privacy: state.privacy, initialized: true } });
    if (path === '/leaderboard/profiles/isolated-member' && method === 'GET') return json(route, { profile: {
      isDemonstration: false, isCurrentMember: false, publicHandle: state.profile.publicHandle,
      displayName: state.profile.displayName, avatarMark: state.profile.avatarMark, memberSince: '2024-01-01',
      currentRank: state.privacy.currentRank ? { slug: 'origin', number: '07', name: 'Origin', color: '#78C9F2' } : null,
      level: state.privacy.level ? 3 : null, totalXp: state.privacy.progressionStats ? 1240 : null,
      currentStreak: state.privacy.currentStreak ? 2 : null, runLongestStreak: state.privacy.longestStreak ? 5 : null,
      lifetimeLongestStreak: state.privacy.longestStreak ? 25 : null, disciplinePointBalance: null, gracePointBalance: null,
      highestRankAchieved: null, rankBadges: state.privacy.currentRank ? ['origin'] : [], resetCount: 4,
      personalBestRecords: state.privacy.personalBest ? { overall: {}, discipline: {}, xp: {} } : null,
      activityMap: state.privacy.activityMap ? { memberSince: '2024-01-01', records: [] } : null, visibility: state.privacy,
    } });
    if (path === '/account/preferences' && method === 'PUT') {
      const body = JSON.parse(request.postData() || '{}');
      requests.push({ path, method, body });
      if (body.appearance) state.appearance = { ...state.appearance, ...body.appearance };
      if (body.accessibility) state.accessibility = { ...state.accessibility, ...body.accessibility };
      return json(route, { settings: accountDto() });
    }
    if (path === '/leaderboard/profile-settings' && method === 'PUT') {
      const body = JSON.parse(request.postData() || '{}');
      requests.push({ path, method, body });
      state.profile = { ...state.profile, displayName: body.displayName, avatarMark: body.avatarMark };
      state.privacy = body.privacy;
      return json(route, { settings: { ...state.profile, privacy: state.privacy, initialized: true } });
    }
    if (path === '/account/reset-preview' && method === 'GET') return json(route, { preview: state.resetPreview });
    if (path === '/account/reset-and-restart' && method === 'POST') {
      requests.push({ path, method, body: JSON.parse(request.postData() || '{}'), idempotencyKey: request.headers()['idempotency-key'] });
      state.runId = 'isolated-run-2';
      return json(route, { reset: { progressionRunId: state.runId, runNumber: 2, currentRank: 'origin', level: 0, totalXp: 0, gracePoints: 3, disciplinePoints: 0, requiresScheduleSetup: true, resetCount: 4, idempotentReplay: false } });
    }
    if (path === '/notification-preferences' && method === 'GET') return json(route, { data: { categories: state.notifications } });
    if (path === '/notification-preferences' && method === 'PATCH') {
      state.notifications = JSON.parse(request.postData() || '{}').categories;
      requests.push({ path, method, body: { categories: state.notifications } });
      return json(route, { data: { categories: state.notifications } });
    }
    if (path === '/notifications/unread-count') return json(route, { data: { unreadCount: 0 } });
    if (path === '/notifications/categories') return json(route, { data: { categories: categories.map((id) => ({ id, label: id })) } });
    if (path === '/notifications') return json(route, { data: { notifications: [], nextCursor: null, hasMore: false, limit: 20 } });
    if (path === '/task-schedules/current') return json(route, { schedule: null, todayDate: '2026-11-19', todayCycleDay: null });
    if (path === '/tasks') return json(route, { tasks: [] });
    if (path === '/task-schedule-changes/allowance') return json(route, { maximum: 3, used: 0, remaining: 3, weekStart: '2026-11-16' });
    if (path === '/recovery-quests') return json(route, { quests: [] });
    if (path === '/emergency-pause') return json(route, { currentIstMonth: '2026-11', allowance: 2, activationsUsed: 0, activationsRemaining: 2, isActive: false, pause: null, progressionRunId: state.runId, serverNow: new Date().toISOString() });
    if (path === '/grace-points') return json(route, { balance: 3 });
    if (path.startsWith('/grace-points/transactions')) return json(route, { transactions: [] });
    if (path === '/progression/current') return json(route, progressionDto());
    if (path === '/discipline/summary') return json(route, { summary: { currentStreak: 2, runLongestStreak: 5, lifetimeLongestStreak: 25, gracePointBalance: 3, dpBalance: 1.25, disciplinePointWalletCap: 4, currentRank: { slug: 'origin', number: '07', name: 'Origin' } } });
    return json(route, {});
  });
  return requests;
}

test('Profile and Settings persist supported preferences and confirm reset before entering fresh-run onboarding', async ({ page }) => {
  const requests = await installAccountApi(page);
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });

  await page.goto('/app/profile');
  await expect(page.getByRole('heading', { name: 'Member Profile' })).toBeVisible();
  await expect(page.getByText('Current Level', { exact: true })).toBeVisible();
  await page.goto('/app/settings?category=profile');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.getByLabel('Display name').fill('Browser Verified Member');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Profile and visibility saved to this member account.' })).toBeVisible();
  expect(requests.some((request) => request.path === '/leaderboard/profile-settings' && request.body.displayName === 'Browser Verified Member')).toBe(true);

  await page.getByRole('button', { name: 'Privacy & Visibility' }).click();
  await expect(page.getByRole('checkbox', { name: /Reset Count/ })).toHaveCount(0);
  const activityVisibility = page.getByRole('checkbox', { name: /Discipline Activity Map/ });
  await expect(activityVisibility).toBeChecked();
  await page.locator('label.settings-toggle[for="setting-discipline-activity-map"]').click();
  await expect(activityVisibility).not.toBeChecked();
  const rankVisibility = page.getByRole('checkbox', { name: /Current Rank/ });
  await expect(rankVisibility).toBeChecked();
  await page.locator('label.settings-toggle[for="setting-current-rank"]').click();
  await expect(rankVisibility).not.toBeChecked();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Profile and visibility saved to this member account.' })).toBeVisible();
  expect(requests.some((request) => request.path === '/leaderboard/profile-settings' && request.body.privacy?.activityMap === false && request.body.privacy?.currentRank === false)).toBe(true);
  await page.goto('/app/profile/isolated-member');
  await expect(page.getByRole('heading', { name: 'Browser Verified Member' })).toBeVisible();
  await expect(page.getByText('Current Rank hidden by member preference')).toBeVisible();
  await expect(page.getByText('PROGRESSION RESET COUNT')).toBeVisible();
  await expect(page.getByText('Discipline Activity Map', { exact: true })).toHaveCount(0);

  await page.goto('/app/settings?category=appearance');
  const cursorSetting = page.getByRole('checkbox', { name: /VOID SHARD cursor/ });
  await expect(cursorSetting).toBeVisible();
  await expect(cursorSetting).not.toBeChecked();
  await page.locator('label.settings-toggle[for="setting-void-shard-cursor"]').click();
  await expect(cursorSetting).toBeChecked();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Preferences saved to this member account.' })).toBeVisible();
  expect(requests.find((request) => request.path === '/account/preferences' && request.body.appearance)?.body.appearance.voidShardCursor).toBe(true);

  await page.getByRole('button', { name: 'Accessibility' }).click();
  const reduceMotion = page.getByRole('checkbox', { name: /Reduce Motion/ });
  await expect(reduceMotion).toBeChecked();
  await page.locator('label.settings-toggle[for="setting-reduce-motion"]').click();
  await expect(reduceMotion).not.toBeChecked();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Preferences saved to this member account.' })).toBeVisible();
  expect(requests.find((request) => request.path === '/account/preferences' && request.body.accessibility)?.body.accessibility.reduceMotion).toBe(false);

  await page.getByRole('button', { name: 'Notification Preferences' }).click();
  const taskNotifications = page.getByRole('checkbox', { name: /Tasks notifications/ });
  await expect(taskNotifications).not.toBeChecked();
  await page.locator('label.settings-toggle[for="setting-tasks-notifications"]').click();
  await expect(taskNotifications).toBeChecked();
  await expect(page.getByRole('status').filter({ hasText: 'Tasks preference saved.' })).toBeVisible();
  expect(requests.some((request) => request.path === '/notification-preferences' && request.method === 'PATCH' && request.body.categories.tasks)).toBe(true);

  await page.reload();
  await page.goto('/app/settings?category=appearance');
  await expect(page.getByRole('checkbox', { name: /VOID SHARD cursor/ })).toBeChecked();
  await page.getByRole('button', { name: 'Accessibility' }).click();
  await expect(page.getByRole('checkbox', { name: /Reduce Motion/ })).not.toBeChecked();

  await page.getByRole('button', { name: 'Account & Security' }).click();
  await expect(page.getByText('Reset Count', { exact: true })).toBeVisible();
  await expect(page.getByText('4', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reset & Restart THE SYSTEM' }).click();
  const dialog = page.getByRole('dialog', { name: /Reset & Restart THE SYSTEM/ });
  await expect(dialog).toBeVisible();
  await dialog.locator('.settings-reset-list').evaluate((element) => { element.scrollTop = element.scrollHeight; element.dispatchEvent(new Event('scroll')); });
  await dialog.getByRole('checkbox').check();
  await dialog.getByLabel(/Type RESET to confirm/).fill('RESET');
  await expect(dialog.getByRole('button', { name: 'Reset & Restart' })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Reset & Restart' }).click();
  await expect(page).toHaveURL(/\/app\/tasks\/create$/);
  expect(requests.some((request) => request.path === '/account/reset-and-restart' && request.body.confirmationPhrase === 'RESET' && request.body.expectedRunNumber === 1 && request.idempotencyKey)).toBe(true);

  const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, document: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
