const { expect, test } = require('@playwright/test');

const categoryIds = ['tasks', 'recovery-quests', 'discipline', 'rank-xp', 'emergency-pause', 'monthly-retention'];
const notices = [
  ['tasks', 'task.completed', 'Task completed', 'A scheduled Task was completed.', '/app/tasks'],
  ['recovery-quests', 'recovery-quest.activated', 'Recovery Quest activated', 'A Recovery Quest is active.', '/app/recovery-quests'],
  ['discipline', 'discipline.qualified', 'Discipline day qualified', 'Your day met the Discipline requirement.', '/app/discipline'],
  ['rank-xp', 'rank.promoted', 'Rank promotion recorded', 'Your current Rank changed with your Level.', '/app/dashboard'],
  ['emergency-pause', 'emergency-pause.activated', 'Emergency Pause activated', 'Your selected pause is active.', '/app/discipline'],
  ['monthly-retention', 'monthly-analysis.reminder', 'Detailed history expires in 7 days', 'Review the saved Monthly Analysis while it is available.', '/app/monthly-analysis'],
].map(([category, eventType, title, description, targetRoute], index) => ({
  id: String(index + 1).padStart(24, '0'),
  category,
  eventType,
  title,
  description,
  targetRoute,
  occurredAt: new Date(Date.now() - index * 60_000).toISOString(),
  createdAt: new Date(Date.now() - index * 60_000).toISOString(),
  isRead: index === 5,
  readAt: index === 5 ? new Date().toISOString() : null,
}));

async function installNotificationApi(page) {
  const state = {
    notifications: notices.map((notice) => ({ ...notice })),
    categories: Object.fromEntries(categoryIds.map((id) => [id, true])),
  };
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    const json = (data) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) });

    if (path === '/notifications' && request.method() === 'GET') {
      const category = url.searchParams.get('category');
      const readState = url.searchParams.get('readState') || 'all';
      const limit = Number(url.searchParams.get('limit') || 20);
      const filtered = state.notifications.filter((notice) => (!category || notice.category === category)
        && (readState === 'all' || (readState === 'read' ? notice.isRead : !notice.isRead)));
      return json({ notifications: filtered.slice(0, limit), nextCursor: null, hasMore: false, limit });
    }
    if (path === '/notifications/unread-count' && request.method() === 'GET') {
      return json({ unreadCount: state.notifications.filter((notice) => !notice.isRead).length });
    }
    if (path === '/notifications/categories' && request.method() === 'GET') {
      return json({ categories: [
        { id: 'tasks', label: 'Tasks' }, { id: 'recovery-quests', label: 'Recovery Quests' },
        { id: 'discipline', label: 'Discipline' }, { id: 'rank-xp', label: 'Rank & XP' },
        { id: 'emergency-pause', label: 'Emergency Pause' }, { id: 'monthly-retention', label: 'Monthly Analysis' },
      ] });
    }
    if (path === '/notification-preferences' && request.method() === 'GET') return json({ categories: state.categories });
    if (path === '/notification-preferences' && request.method() === 'PATCH') {
      state.categories = JSON.parse(request.postData() || '{}').categories;
      return json({ categories: state.categories });
    }
    if (path === '/notifications/read-all' && request.method() === 'POST') {
      const now = new Date().toISOString();
      let modifiedCount = 0;
      state.notifications = state.notifications.map((notice) => {
        if (notice.isRead) return notice;
        modifiedCount += 1;
        return { ...notice, isRead: true, readAt: now };
      });
      return json({ modifiedCount, unreadCount: 0 });
    }
    const readMatch = path.match(/^\/notifications\/([a-f\d]{24})\/read$/i);
    if (readMatch && request.method() === 'PATCH') {
      const notification = state.notifications.find((notice) => notice.id === readMatch[1]);
      if (!notification) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Not found' } }) });
      notification.isRead = true;
      notification.readAt = new Date().toISOString();
      return json({ notification, unreadCount: state.notifications.filter((notice) => !notice.isRead).length });
    }
    return json({});
  });
}

test('persistent notification inbox filters, preferences and read actions work responsively', async ({ page }, testInfo) => {
  await installNotificationApi(page);
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });

  await page.goto('/app/notifications');
  await expect(page.getByRole('heading', { name: 'Notifications', exact: true })).toBeVisible();
  await expect(page.getByText('Task completed', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Notifications, 5 unread' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('notifications-responsive.png'), fullPage: true });

  const categoryFilters = page.getByRole('group', { name: 'Filter by category' });
  await categoryFilters.getByRole('button', { name: 'Recovery Quests' }).click();
  await expect(page.getByText('Recovery Quest activated', { exact: true })).toBeVisible();
  await expect(page.getByText('Task completed', { exact: true })).toHaveCount(0);
  await categoryFilters.getByRole('button', { name: 'All categories' }).click();
  await page.getByRole('group', { name: 'Filter by read state' }).getByRole('button', { name: 'Read', exact: true }).click();
  await expect(page.getByText('Detailed history expires in 7 days', { exact: true })).toBeVisible();
  await expect(page.getByText('Task completed', { exact: true })).toHaveCount(0);

  await page.getByRole('link', { name: /Notification preferences/ }).click();
  const taskPreference = page.getByRole('checkbox', { name: /Tasks notifications/ });
  await expect(taskPreference).toBeVisible();
  await expect(taskPreference).toBeChecked();
  await taskPreference.focus();
  await page.keyboard.press('Space');
  await expect(taskPreference).not.toBeChecked();
  await page.reload();
  await expect(page.getByRole('checkbox', { name: /Tasks notifications/ })).not.toBeChecked();

  await page.goto('/app/notifications');
  await page.getByRole('button', { name: 'Mark All as Read' }).click();
  await expect(page.getByRole('button', { name: 'Notifications, no unread items' })).toBeVisible();
  await page.getByRole('group', { name: 'Filter by read state' }).getByRole('button', { name: 'Unread', exact: true }).click();
  await expect(page.getByRole('heading', { name: "You're All Caught Up" })).toBeVisible();
  await page.getByRole('group', { name: 'Filter by read state' }).getByRole('button', { name: 'Read', exact: true }).click();
  await expect(page.getByText('Recovery Quest activated', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: /Recovery Quest activated/ }).click();
  await expect(page).toHaveURL(/\/app\/recovery-quests$/);

  const layout = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
  }));
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
