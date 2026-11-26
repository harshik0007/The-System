import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import DailyDisciplineRecord from '../models/DailyDisciplineRecord.js';
import MonthlyAnalysisSummary from '../models/MonthlyAnalysisSummary.js';
import ProgressionRun from '../models/ProgressionRun.js';
import RankEntryEvent from '../models/RankEntryEvent.js';
import RecoveryQuest from '../models/RecoveryQuest.js';
import TaskOccurrence from '../models/TaskOccurrence.js';
import User from '../models/User.js';
import { PROGRESSION_RANKS } from '../config/progressionConfiguration.js';
import { NotFoundError, ServiceUnavailableError, ValidationError } from '../utils/httpErrors.js';
import { addIstCalendarDays, getIstDateKey } from '../utils/ist.js';
import { getRankSlugForLevel } from '../utils/ranks.js';
import { getLevelFromTotalXp } from './progressionXpService.js';
import { calculateNextPersonalBest, rankLeaderboardRows, toSafeTieBreakDto } from '../utils/leaderboardRanking.js';
import { withMongoTransaction } from './mongoTransaction.js';

const rankBySlug = new Map(PROGRESSION_RANKS.map((rank) => [rank.slug, rank]));
const CATEGORIES = ['overall', 'discipline', 'xp'];
const DEFAULT_PRIVACY = Object.freeze({
  publicProfile: true, fullName: true, activityMap: true, personalBest: true, currentRank: true, level: true,
  progressionStats: true, currentStreak: true, longestStreak: true,
  disciplinePointBalance: true, gracePointBalance: true,
});
const ALLOWED_AVATAR_MARKS = new Set(['initials', 'spark', 'shield', 'activity', 'profile']);

function validCount(value, field) {
  const number = Number(value ?? 0);
  if (!Number.isSafeInteger(number) || number < 0) throw new ServiceUnavailableError(`Leaderboard data for ${field} is unavailable.`);
  return number;
}

function validRunMetrics(run) {
  if (!rankBySlug.has(run.currentRankSlug) || !Number.isSafeInteger(run.level) || run.level < 0
    || !Number.isFinite(run.totalXp) || run.totalXp < 0
    || !Number.isSafeInteger(run.currentStreak) || run.currentStreak < 0
    || !Number.isSafeInteger(run.longestStreak) || run.longestStreak < 0
    || getRankSlugForLevel(run.level) !== run.currentRankSlug
    || getLevelFromTotalXp(run.totalXp) !== run.level) {
    throw new ServiceUnavailableError('Current progression data is inconsistent; leaderboard positions were not updated.');
  }
  const totalXpCents = Math.round((run.totalXp + Number.EPSILON) * 100);
  if (!Number.isSafeInteger(totalXpCents) || Math.abs(totalXpCents / 100 - run.totalXp) > 1e-7) {
    throw new ServiceUnavailableError('Current XP cannot be ranked safely; leaderboard positions were not updated.');
  }
  return { totalXpCents };
}

function profilePrivacy(user) {
  return Object.fromEntries(Object.entries(DEFAULT_PRIVACY).map(([key, fallback]) => [key,
    typeof user.privacy?.[key] === 'boolean' ? user.privacy[key] : fallback,
  ]));
}

function normalizeProfileInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ValidationError('Profile settings are invalid.');
  const unknown = Object.keys(body).filter((key) => !['avatarMark', 'privacy'].includes(key));
  if (unknown.length) throw new ValidationError('Profile settings contain unsupported fields.', unknown.map((field) => ({ field, code: 'FIELD_NOT_ALLOWED' })));
  const avatarMark = body.avatarMark;
  const privacy = body.privacy;
  const errors = [];
  if (!ALLOWED_AVATAR_MARKS.has(avatarMark)) errors.push({ field: 'avatarMark', code: 'INVALID_CHOICE' });
  if (!privacy || typeof privacy !== 'object' || Array.isArray(privacy)) errors.push({ field: 'privacy', code: 'INVALID_OBJECT' });
  else {
    for (const key of Object.keys(privacy)) {
      if (!(key in DEFAULT_PRIVACY) || typeof privacy[key] !== 'boolean') errors.push({ field: `privacy.${key}`, code: 'INVALID_VALUE' });
    }
    for (const key of Object.keys(DEFAULT_PRIVACY)) {
      if (typeof privacy[key] !== 'boolean') errors.push({ field: `privacy.${key}`, code: 'REQUIRED_BOOLEAN' });
    }
  }
  if (errors.length) throw new ValidationError('Profile settings contain invalid values.', errors);
  return { avatarMark, privacy: { ...privacy } };
}

async function ensurePublicHandle(user, session = null) {
  if (typeof user.publicHandle === 'string' && user.publicHandle.length >= 3) return user.publicHandle;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const publicHandle = `member-${randomBytes(8).toString('hex')}`;
    try {
      const result = await User.updateOne({ _id: user._id, $or: [{ publicHandle: { $exists: false } }, { publicHandle: null }] }, { $set: { publicHandle } }, { session });
      if (result.modifiedCount === 1) {
        user.publicHandle = publicHandle;
        return publicHandle;
      }
      const latest = await User.findById(user._id).select('publicHandle').session(session).lean();
      if (latest?.publicHandle) {
        user.publicHandle = latest.publicHandle;
        return latest.publicHandle;
      }
    } catch (error) {
      if (error?.code !== 11000 || attempt === 3) throw error;
    }
  }
  throw new ServiceUnavailableError('A safe public profile reference could not be assigned.');
}

function runKey(userId, runId) { return `${String(userId)}:${String(runId)}`; }

async function loadTaskAndQuestCounts(users, runs, session) {
  const userIds = users.map((user) => user._id);
  const runIds = runs.map((run) => run._id);
  if (!userIds.length || !runIds.length) return new Map();

  const taskDaily = await TaskOccurrence.aggregate([
    { $match: { userId: { $in: userIds }, progressionRunId: { $in: runIds }, status: 'completed' } },
    { $group: { _id: { userId: '$userId', runId: '$progressionRunId', date: '$occurrenceDate' }, count: { $sum: 1 } } },
  ]).session(session);
  const summaries = await MonthlyAnalysisSummary.find({ userId: { $in: userIds }, progressionRunId: { $in: runIds } })
    .select('userId progressionRunId coveredFrom coveredThrough metrics.tasks.completed metrics.daily')
    .session(session).lean();
  const questGroups = await RecoveryQuest.aggregate([
    { $match: { userId: { $in: userIds }, progressionRunId: { $in: runIds } } },
    { $group: { _id: { userId: '$userId', runId: '$progressionRunId' }, count: { $sum: 1 } } },
  ]).session(session);

  const validPairs = new Set(runs.map((run) => runKey(run.userId, run._id)));
  const taskDates = new Map();
  for (const group of taskDaily) {
    const key = runKey(group._id.userId, group._id.runId);
    if (!validPairs.has(key)) continue;
    const dates = taskDates.get(key) || new Map();
    dates.set(group._id.date, validCount(group.count, 'completed Task count'));
    taskDates.set(key, dates);
  }

  const summaryDates = new Map();
  const summaryRanges = new Map();
  for (const summary of summaries) {
    const key = runKey(summary.userId, summary.progressionRunId);
    if (!validPairs.has(key)) continue;
    const dates = summaryDates.get(key) || new Map();
    const daily = Array.isArray(summary.metrics?.daily) ? summary.metrics.daily : [];
    let hasDailyTaskValues = false;
    for (const item of daily) {
      const completed = item?.tasks?.completed;
      if (/^\d{4}-\d{2}-\d{2}$/.test(item?.date || '') && Number.isSafeInteger(completed) && completed >= 0) {
        dates.set(item.date, Math.max(dates.get(item.date) || 0, completed));
        hasDailyTaskValues = true;
      }
    }
    summaryDates.set(key, dates);
    if (!hasDailyTaskValues && Number.isSafeInteger(summary.metrics?.tasks?.completed) && summary.metrics.tasks.completed >= 0) {
      const ranges = summaryRanges.get(key) || [];
      ranges.push({ from: summary.coveredFrom, through: summary.coveredThrough, count: summary.metrics.tasks.completed });
      summaryRanges.set(key, ranges);
    }
  }

  const totals = new Map();
  for (const run of runs) {
    const key = runKey(run.userId, run._id);
    const observed = taskDates.get(key) || new Map();
    const summarized = summaryDates.get(key) || new Map();
    let count = 0;
    const dates = new Set([...observed.keys(), ...summarized.keys()]);
    const fallbackRanges = summaryRanges.get(key) || [];
    for (const date of dates) {
      const coveredByFallback = fallbackRanges.some((range) => date >= range.from && date <= range.through);
      if (coveredByFallback) continue;
      count += Math.max(observed.get(date) || 0, summarized.get(date) || 0);
    }
    count += fallbackRanges.reduce((sum, range) => sum + range.count, 0);
    totals.set(key, { completedOriginalTaskCount: count, totalRecoveryQuestCount: 0 });
  }
  for (const group of questGroups) {
    const key = runKey(group._id.userId, group._id.runId);
    if (!validPairs.has(key)) continue;
    const values = totals.get(key) || { completedOriginalTaskCount: 0, totalRecoveryQuestCount: 0 };
    values.totalRecoveryQuestCount = validCount(group.count, 'Recovery Quest count');
    totals.set(key, values);
  }
  return totals;
}

function personalBestPipeline(positions, dateKey) {
  const normalize = {};
  const set = {};
  for (const category of CATEGORIES) {
    const base = `personalBestRecords.${category}`;
    const categoryExpression = `$${base}`;
    const legacyBest = {
      $cond: [
        { $isNumber: categoryExpression },
        {
          $cond: [
            { $and: [{ $gt: [categoryExpression, 0] }, { $eq: [categoryExpression, { $floor: categoryExpression }] }] },
            categoryExpression,
            null,
          ],
        },
        null,
      ],
    };
    normalize[base] = {
      $cond: [
        { $eq: [{ $type: categoryExpression }, 'object'] },
        { $mergeObjects: [{}, categoryExpression] },
        { currentPosition: null, bestPosition: legacyBest, achievedOn: null },
      ],
    };
    const bestPath = `${base}.bestPosition`;
    const achievedPath = `${base}.achievedOn`;
    const bestExpression = { $ifNull: [`$${bestPath}`, null] };
    const improvement = { $or: [{ $eq: [bestExpression, null] }, { $gt: [`$${bestPath}`, positions[category]] }] };
    set[`${base}.currentPosition`] = positions[category];
    set[bestPath] = { $cond: [improvement, positions[category], bestExpression] };
    set[achievedPath] = { $cond: [improvement, dateKey, { $ifNull: [`$${achievedPath}`, null] }] };
  }
  return [{ $set: normalize }, { $set: set }];
}

function serializeBestRecords(records = {}) {
  return Object.fromEntries(CATEGORIES.map((category) => {
    const record = records[category];
    const legacyBest = Number.isSafeInteger(record) && record > 0 ? record : null;
    return [category, {
      currentPosition: Number.isSafeInteger(record?.currentPosition) && record.currentPosition > 0 ? record.currentPosition : null,
      bestPosition: Number.isSafeInteger(record?.bestPosition) && record.bestPosition > 0 ? record.bestPosition : legacyBest,
      achievedOn: record?.achievedOn || null,
    }];
  }));
}

function safeMemberDto(row, category, personalBestRecords = row.personalBestRecords) {
  const rank = rankBySlug.get(row.currentRankSlug);
  const recordedHighest = rankBySlug.get(row.highestRankAchieved);
  const highestRank = recordedHighest && PROGRESSION_RANKS.indexOf(recordedHighest) >= PROGRESSION_RANKS.indexOf(rank) ? recordedHighest : rank;
  return {
    id: row.publicHandle,
    publicHandle: row.publicHandle,
    username: row.username,
    avatarMark: row.avatarMark || 'initials',
    avatarInitials: row.avatarInitials || row.username.slice(0, 2).toUpperCase(),
    rankId: rank.slug,
    rankName: rank.name,
    rankNumber: rank.number,
    rankColor: rank.color,
    currentRankSlug: rank.slug,
    highestRankId: highestRank.slug,
    highestRankName: highestRank.name,
    highestRankNumber: highestRank.number,
    highestRankAchieved: { rankSlug: highestRank.slug, rankNumber: highestRank.number, rankName: highestRank.name, achievedOn: row.highestRankAchievedOn || null },
    rankBadges: row.rankBadges || [rank.slug],
    level: row.level,
    totalXp: row.totalXp,
    currentDisciplineStreak: row.currentStreak,
    longestDisciplineStreak: row.longestStreak,
    currentStreak: row.currentStreak,
    longestStreak: row.longestStreak,
    lifetimeLongestStreak: row.lifetimeLongestStreak ?? null,
    resetCount: row.resetCount ?? 0,
    disciplinePointBalance: row.disciplinePoints ?? null,
    gracePointBalance: row.gracePoints ?? null,
    competitionRank: row.competitionRank,
    position: row.competitionRank,
    category,
    tieBreak: toSafeTieBreakDto(row),
    personalBestRecords,
    isCurrentMember: Boolean(row.isCurrentMember),
  };
}

function tieRankForCategory(row, category) {
  return row.competitionRank;
}

export async function getLeaderboard({ requesterId, now = new Date() }) {
  if (!mongoose.isValidObjectId(requesterId)) throw new ValidationError('The current member identity is invalid.');
  return withMongoTransaction(async (session) => {
    const users = await User.find({ identityKind: 'account', accountStatus: 'active', username: { $type: 'string' }, currentProgressionRunId: { $ne: null } })
      .select('_id currentProgressionRunId username avatarMark publicHandle privacy personalBestRecords highestRankAchieved lifetimeLongestStreak resetCount')
      .session(session).lean();
    const currentUser = users.find((user) => String(user._id) === String(requesterId)) || null;
    if (currentUser) await ensurePublicHandle(currentUser, session);
    for (const user of users) if (!user.publicHandle) await ensurePublicHandle(user, session);
    const userById = new Map(users.map((user) => [String(user._id), user]));
    const runIds = users.map((user) => user.currentProgressionRunId).filter(Boolean);
    const runs = runIds.length
      ? await ProgressionRun.find({ _id: { $in: runIds }, userId: { $in: users.map((user) => user._id) }, status: 'active' })
        .select('_id userId currentRankSlug level totalXp currentStreak longestStreak disciplinePoints gracePoints')
        .session(session).lean()
      : [];
    const counts = await loadTaskAndQuestCounts(users, runs, session);
    const liveMembers = [];
    for (const run of runs) {
      const user = userById.get(String(run.userId));
      if (!user) continue;
      const { totalXpCents } = validRunMetrics(run);
      const aggregate = counts.get(runKey(run.userId, run._id)) || { completedOriginalTaskCount: 0, totalRecoveryQuestCount: 0 };
      liveMembers.push({
        publicHandle: user.publicHandle,
        username: user.username,
        avatarMark: user.avatarMark || 'initials',
        currentRankSlug: run.currentRankSlug,
        level: run.level,
        totalXp: run.totalXp,
        totalXpCents,
        currentStreak: run.currentStreak,
        longestStreak: run.longestStreak,
        lifetimeLongestStreak: validCount(user.lifetimeLongestStreak, 'lifetime longest streak'),
        resetCount: validCount(user.resetCount, 'reset count'),
        disciplinePoints: run.disciplinePoints,
        gracePoints: run.gracePoints,
        highestRankAchieved: user.highestRankAchieved,
        personalBestRecords: serializeBestRecords(user.personalBestRecords),
        completedOriginalTaskCount: validCount(aggregate.completedOriginalTaskCount, 'completed Task count'),
        totalRecoveryQuestCount: validCount(aggregate.totalRecoveryQuestCount, 'Recovery Quest count'),
        isCurrentMember: String(user._id) === String(requesterId),
        _userId: user._id,
        _runId: run._id,
      });
    }

    const rankedByCategory = Object.fromEntries(CATEGORIES.map((category) => [category, rankLeaderboardRows(liveMembers, category)]));
    const positionsByCategory = Object.fromEntries(CATEGORIES.map((category) => [category,
      new Map(rankedByCategory[category].map((row) => [row.publicHandle, row.competitionRank])),
    ]));
    const categoryPositions = Object.fromEntries(CATEGORIES.map((category) => {
      const row = rankedByCategory[category].find((member) => member.isCurrentMember);
      return [category, row ? tieRankForCategory(row, category) : null];
    }));
    const dateKey = getIstDateKey(now);
    const bulk = liveMembers.map((row) => {
        const positions = {};
        for (const category of CATEGORIES) {
          positions[category] = positionsByCategory[category].get(row.publicHandle) ?? null;
        }
        return {
          updateOne: {
            filter: { _id: row._userId, currentProgressionRunId: row._runId, accountStatus: 'active' },
            update: personalBestPipeline(positions, dateKey),
          },
        };
      });
    if (bulk.length) await User.bulkWrite(bulk, { session, ordered: true });

    const persistedUsers = liveMembers.length
      ? await User.find({ _id: { $in: liveMembers.map((row) => row._userId) } }).select('_id personalBestRecords').session(session).lean()
      : [];
    const savedById = new Map(persistedUsers.map((user) => [String(user._id), serializeBestRecords(user.personalBestRecords)]));
    const resultCategories = Object.fromEntries(CATEGORIES.map((category) => {
      const rows = rankedByCategory[category].map((row) => {
        const positions = Object.fromEntries(CATEGORIES.map((key) => [key, positionsByCategory[key].get(row.publicHandle) ?? null]));
        const stored = savedById.get(String(row._userId)) || {};
        const records = Object.fromEntries(CATEGORIES.map((key) => [key, calculateNextPersonalBest(stored[key], positions[key], dateKey)]));
        return safeMemberDto({ ...row, competitionRank: positions[category] }, category, records);
      });
      return [category, rows];
    }));
    const currentMember = resultCategories.overall.find((row) => row.isCurrentMember) || null;
    return {
      generatedOn: dateKey,
      memberCount: resultCategories.overall.length,
      categories: resultCategories,
      currentPositions: categoryPositions,
      currentMember,
    };
  });
}

function findRank(slug) { return rankBySlug.get(slug) || null; }

export async function getPublicMemberProfile({ requesterId, publicHandle, now = new Date(), isOwnProfile = true }) {
  if (publicHandle === 'me') {
    if (!mongoose.isValidObjectId(requesterId)) throw new ValidationError('The current member identity is invalid.');
    const user = await User.findOne({ _id: requesterId, identityKind: 'account', accountStatus: 'active' })
      .select('_id identityKind currentProgressionRunId memberSince username firstName middleName lastName avatarMark publicHandle privacy personalBestRecords highestRankAchieved lifetimeLongestStreak resetCount appearancePreferences')
      .lean();
    if (!user) throw new NotFoundError('This public profile is not available.');
    if (!user.publicHandle) await ensurePublicHandle(user);
    const privacy = profilePrivacy(user);
    if (!privacy.publicProfile) throw new NotFoundError('This public profile is not available.');
    const run = user.currentProgressionRunId
      ? await ProgressionRun.findOne({ _id: user.currentProgressionRunId, userId: user._id, status: 'active' }).select('_id currentRankSlug level totalXp currentStreak longestStreak disciplinePoints gracePoints').lean()
      : null;
    if (run) validRunMetrics(run);
    const rank = run ? findRank(run.currentRankSlug) : null;
    const highestRank = findRank(user.highestRankAchieved);
    const rankEntrySlugs = run
      ? await RankEntryEvent.distinct('rankSlug', { userId: user._id, progressionRunId: run._id })
      : [];
    const rankBadges = [...new Set([...(rank ? [rank.slug] : []), ...rankEntrySlugs])];
    const highestRankEvent = highestRank && run
      ? await RankEntryEvent.findOne({ userId: user._id, progressionRunId: run?._id, rankSlug: highestRank.slug }).sort({ occurredAt: 1 }).select('businessDate').lean()
      : null;
    let activityMap = null;
    if (privacy.activityMap && run) {
      const today = getIstDateKey(now);
      const from = addIstCalendarDays(today, -364);
      const records = await DailyDisciplineRecord.find({ userId: user._id, progressionRunId: run._id, date: { $gte: from, $lte: today } })
        .select('date scheduledOriginalTaskCount completedOriginalTaskCount qualificationStatus protectedByEmergencyPause finalizedAt')
        .sort({ date: 1 }).lean();
      activityMap = {
        memberSince: user.memberSince,
        records: records.map((record) => ({
          date: record.date,
          scheduledOriginalTaskCount: record.scheduledOriginalTaskCount,
          completedOriginalTaskCount: record.completedOriginalTaskCount,
          qualificationStatus: record.qualificationStatus,
          protectedByEmergencyPause: record.protectedByEmergencyPause,
          finalizedAt: record.finalizedAt,
        })),
      };
    }
    const personalBestRecords = serializeBestRecords(user.personalBestRecords);
    if (highestRank) personalBestRecords.highestRankAchieved = {
      rankSlug: highestRank.slug,
      rankNumber: highestRank.number,
      rankName: highestRank.name,
      achievedOn: highestRankEvent?.businessDate || null,
    };
    return {
      isCurrentMember: isOwnProfile,
      publicHandle: user.publicHandle,
      username: user.username,
      firstName: privacy.fullName ? user.firstName || '' : null,
      middleName: privacy.fullName ? user.middleName || '' : null,
      lastName: privacy.fullName ? user.lastName || '' : null,
      avatarMark: user.avatarMark || 'initials',
      memberSince: user.memberSince,
      currentRank: privacy.currentRank && rank ? { slug: rank.slug, number: rank.number, name: rank.name, color: rank.color } : null,
      level: privacy.level && run ? run.level : null,
      totalXp: privacy.progressionStats && run ? run.totalXp : null,
      currentStreak: privacy.currentStreak && run ? run.currentStreak : null,
      runLongestStreak: privacy.longestStreak && run ? run.longestStreak : null,
      lifetimeLongestStreak: privacy.longestStreak ? user.lifetimeLongestStreak : null,
      disciplinePointBalance: privacy.disciplinePointBalance && run ? run.disciplinePoints : null,
      gracePointBalance: privacy.gracePointBalance && run ? run.gracePoints : null,
      highestRankAchieved: privacy.personalBest && highestRank ? { slug: highestRank.slug, number: highestRank.number, name: highestRank.name, achievedOn: highestRankEvent?.businessDate || null } : null,
      rankBadges: privacy.currentRank ? rankBadges : [],
      resetCount: user.resetCount ?? 0,
      personalBestRecords: privacy.personalBest ? personalBestRecords : null,
      activityMap: privacy.activityMap ? activityMap : null,
      visibility: privacy,
    };
  }

  if (!/^[a-z0-9][a-z0-9-]{2,47}$/.test(publicHandle) || mongoose.isValidObjectId(publicHandle)) {
    throw new ValidationError('The public profile reference is invalid.');
  }
  const user = await User.findOne({ publicHandle, identityKind: 'account', accountStatus: 'active' }).select('_id').lean();
  if (!user) throw new NotFoundError('This public profile is not available.');
  return getPublicMemberProfile({ requesterId: user._id, publicHandle: 'me', now, isOwnProfile: String(user._id) === String(requesterId) });
}

export async function getCurrentPublicProfileSettings(userId) {
  if (!mongoose.isValidObjectId(userId)) throw new ValidationError('The current member identity is invalid.');
  const user = await User.findOne({ _id: userId, identityKind: 'account', accountStatus: 'active' }).select('_id username avatarMark publicHandle privacy publicProfileSettingsInitialized').lean();
  if (!user) throw new NotFoundError('The current member identity was not found.');
  if (!user.publicHandle) await ensurePublicHandle(user);
  return { publicHandle: user.publicHandle, username: user.username || null, avatarMark: user.avatarMark || 'initials', privacy: profilePrivacy(user), initialized: Boolean(user.publicProfileSettingsInitialized) };
}

export async function saveCurrentPublicProfileSettings(userId, body) {
  if (!mongoose.isValidObjectId(userId)) throw new ValidationError('The current member identity is invalid.');
  const settings = normalizeProfileInput(body);
  const updated = await User.findOneAndUpdate({ _id: userId, identityKind: 'account', accountStatus: 'active' }, {
    $set: { avatarMark: settings.avatarMark, privacy: settings.privacy, publicProfileSettingsInitialized: true },
  }, { new: true, runValidators: true }).select('username avatarMark publicHandle privacy publicProfileSettingsInitialized').lean();
  if (!updated) throw new NotFoundError('The current member identity was not found.');
  if (!updated.publicHandle) return getCurrentPublicProfileSettings(userId);
  return { publicHandle: updated.publicHandle, username: updated.username || null, avatarMark: updated.avatarMark, privacy: profilePrivacy(updated), initialized: true };
}

