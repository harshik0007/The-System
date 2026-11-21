import * as notifications from '../services/notificationService.js';

export async function list(request, response) {
  const result = await notifications.listNotifications(request.user.id, {
    category: request.query.category || null,
    readState: request.query.readState || 'all',
    cursor: request.query.cursor || null,
    limit: request.query.limit ?? 20,
  });
  response.status(200).json({ data: result });
}

export async function unreadCount(request, response) {
  response.status(200).json({ data: await notifications.getUnreadNotificationCount(request.user.id) });
}

export async function categories(_request, response) {
  response.status(200).json({ data: { categories: notifications.NOTIFICATION_CATEGORIES } });
}

export async function markOneRead(request, response) {
  response.status(200).json({ data: await notifications.markNotificationRead(request.user.id, request.params.notificationId) });
}

export async function markAllRead(request, response) {
  response.status(200).json({ data: await notifications.markAllNotificationsRead(request.user.id) });
}

export async function getPreferences(request, response) {
  response.status(200).json({ data: await notifications.getNotificationPreferences(request.user.id) });
}

export async function updatePreferences(request, response) {
  response.status(200).json({ data: await notifications.updateNotificationPreferences(request.user.id, request.body?.categories) });
}
