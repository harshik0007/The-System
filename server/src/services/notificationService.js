import mongoose from 'mongoose';
import Notification, { NOTIFICATION_CATEGORY_IDS } from '../models/Notification.js';
import User from '../models/User.js';
import { NotFoundError, ValidationError } from '../utils/httpErrors.js';

export const NOTIFICATION_CATEGORIES = Object.freeze([
  { id: 'tasks', label: 'Tasks' },
  { id: 'recovery-quests', label: 'Recovery Quests' },
  { id: 'discipline', label: 'Discipline' },
  { id: 'rank-xp', label: 'Rank & XP' },
  { id: 'emergency-pause', label: 'Emergency Pause' },
  { id: 'monthly-retention', label: 'Monthly Analysis' },
]);
const DEFAULT_PREFERENCES = Object.freeze(Object.fromEntries(NOTIFICATION_CATEGORY_IDS.map((id) => [id, true])));
const SAFE_ROUTES = [
  /^\/app\/tasks(?:\?date=\d{4}-\d{2}-\d{2})?$/,
  /^\/app\/recovery-quests$/,
  /^\/app\/discipline(?:\?date=\d{4}-\d{2}-\d{2})?$/,
  /^\/app\/dashboard$/,
  /^\/app\/monthly-analysis(?:\?month=\d{4}-(?:0[1-9]|1[0-2]))?$/,
  /^\/ranks\/(?:origin|ember|surge|vector|apex|zenith|continuum)$/,
];

export function isSafeNotificationRoute(route) {
  return typeof route === 'string' && route.length <= 220 && !route.includes('\\') && !route.includes('#')
    && SAFE_ROUTES.some((pattern) => pattern.test(route));
}

export async function createNotificationWithinSession({
  userId, progressionRunId = null, category, eventType, title, description, targetRoute,
  idempotencyKey, occurredAt = null, createdAt = new Date(), session,
}) {
  if (!session) throw new TypeError('Notifications created from business events require the caller transaction.');
  if (!NOTIFICATION_CATEGORY_IDS.includes(category) || !isSafeNotificationRoute(targetRoute)) {
    throw new TypeError('Notification category or internal destination is invalid.');
  }
  if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 8 || idempotencyKey.length > 200) {
    throw new TypeError('A stable notification event key is required.');
  }
  const existing = await Notification.findOne({ userId, idempotencyKey }).session(session);
  if (existing) return { notification: existing, created: false, disabled: false };
  const user = await User.findById(userId).select('notificationPreferences').session(session);
  if (!user) throw new NotFoundError('The notification owner was not found.');
  const categories = user.notificationPreferences?.categories || DEFAULT_PREFERENCES;
  if (categories[category] === false) return { notification: null, created: false, disabled: true };

  const [notification] = await Notification.create([{
    userId,
    progressionRunId: progressionRunId || null,
    category,
    eventType,
    title,
    description,
    targetRoute,
    idempotencyKey,
    occurredAt: occurredAt ? new Date(occurredAt) : null,
    createdAt: new Date(createdAt),
    readAt: null,
  }], { session });
  return { notification, created: true, disabled: false };
}

function toDto(item) {
  return {
    id: String(item._id),
    category: item.category,
    eventType: item.eventType,
    title: item.title,
    description: item.description,
    targetRoute: item.targetRoute,
    occurredAt: item.occurredAt?.toISOString?.() || null,
    createdAt: item.createdAt.toISOString(),
    isRead: Boolean(item.readAt),
    readAt: item.readAt?.toISOString?.() || null,
  };
}

function encodeCursor(item) {
  return Buffer.from(`${item.createdAt.toISOString()}|${item._id}`, 'utf8').toString('base64url');
}

function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const [createdAt, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
    const date = new Date(createdAt);
    if (!Number.isFinite(date.getTime()) || !mongoose.isValidObjectId(id)) throw new Error('Invalid cursor');
    return { createdAt: date, _id: new mongoose.Types.ObjectId(id) };
  } catch {
    throw new ValidationError('The notification cursor is invalid.');
  }
}

export async function listNotifications(userId, { category = null, readState = 'all', cursor = null, limit = 20 } = {}) {
  const parsedLimit = Number(limit);
  if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) throw new ValidationError('Notification page size must be from 1 through 50.');
  if (category && !NOTIFICATION_CATEGORY_IDS.includes(category)) throw new ValidationError('The notification category is invalid.');
  if (!['all', 'unread', 'read'].includes(readState)) throw new ValidationError('The notification read-state filter is invalid.');
  const query = { userId };
  if (category) query.category = category;
  if (readState === 'unread') query.readAt = null;
  if (readState === 'read') query.readAt = { $ne: null };
  const before = decodeCursor(cursor);
  if (before) query.$or = [
    { createdAt: { $lt: before.createdAt } },
    { createdAt: before.createdAt, _id: { $lt: before._id } },
  ];
  const rows = await Notification.find(query).sort({ createdAt: -1, _id: -1 }).limit(parsedLimit + 1).lean();
  const hasMore = rows.length > parsedLimit;
  const page = rows.slice(0, parsedLimit);
  return { notifications: page.map(toDto), nextCursor: hasMore ? encodeCursor(page.at(-1)) : null, hasMore, limit: parsedLimit };
}

export async function getUnreadNotificationCount(userId) {
  const unreadCount = await Notification.countDocuments({ userId, readAt: null });
  return { unreadCount };
}

export async function getNotificationPreferences(userId) {
  const user = await User.findById(userId).select('notificationPreferences');
  if (!user) throw new NotFoundError('The notification owner was not found.');
  return { categories: { ...DEFAULT_PREFERENCES, ...(user.notificationPreferences?.categories?.toObject?.() || user.notificationPreferences?.categories || {}) } };
}

export async function updateNotificationPreferences(userId, categories) {
  if (!categories || typeof categories !== 'object' || Array.isArray(categories)
    || Object.keys(categories).length !== NOTIFICATION_CATEGORY_IDS.length
    || NOTIFICATION_CATEGORY_IDS.some((id) => typeof categories[id] !== 'boolean')) {
    throw new ValidationError('Provide an enabled or disabled value for each notification category.');
  }
  const user = await User.findOneAndUpdate({ _id: userId }, {
    $set: { 'notificationPreferences.categories': Object.fromEntries(NOTIFICATION_CATEGORY_IDS.map((id) => [id, categories[id]])) },
  }, { new: true, runValidators: true }).select('notificationPreferences');
  if (!user) throw new NotFoundError('The notification owner was not found.');
  return getNotificationPreferences(userId);
}

export async function markNotificationRead(userId, notificationId, { now = new Date() } = {}) {
  if (!mongoose.isValidObjectId(notificationId)) throw new NotFoundError('The notification was not found.');
  const item = await Notification.findOneAndUpdate({ _id: notificationId, userId, readAt: null }, { $set: { readAt: now } }, { new: true });
  const existing = item || await Notification.findOne({ _id: notificationId, userId });
  if (!existing) throw new NotFoundError('The notification was not found.');
  return { notification: toDto(existing), unreadCount: (await getUnreadNotificationCount(userId)).unreadCount };
}

export async function markAllNotificationsRead(userId, { now = new Date() } = {}) {
  const result = await Notification.updateMany({ userId, readAt: null }, { $set: { readAt: now } });
  const { unreadCount } = await getUnreadNotificationCount(userId);
  return { modifiedCount: result.modifiedCount, unreadCount };
}
