import { ranks } from '../data/ranks.js';
import { getHighestRankAchieved, getLevelFromTotalXp } from './disciplineManager.js';

export const LEADERBOARD_CATEGORIES = Object.freeze([
  { id: 'overall', label: 'Overall Ranking' },
  { id: 'discipline', label: 'Discipline Ranking' },
  { id: 'xp', label: 'XP Ranking' },
]);

export const LEADERBOARD_POSITION_ACCENTS = Object.freeze({
  first: '#F0443E',
  second: '#F2C96B',
  third: ranks.find((rank) => rank.slug === 'apex')?.color || '#A38BFF',
});

function compareStableId(left, right) {
  if (left.id === right.id) return 0;
  return left.id < right.id ? -1 : 1;
}

export function compareLeaderboardMembers(left, right, category = 'overall') {
  if (category === 'discipline') {
    return Number(right.currentDisciplineStreak) - Number(left.currentDisciplineStreak)
      || Number(right.longestDisciplineStreak) - Number(left.longestDisciplineStreak)
      || compareStableId(left, right);
  }
  if (category === 'xp') {
    return Number(right.totalXp) - Number(left.totalXp) || compareStableId(left, right);
  }
  return Number(left.rankNumber) - Number(right.rankNumber)
    || Number(right.level) - Number(left.level)
    || Number(right.totalXp) - Number(left.totalXp)
    || compareStableId(left, right);
}

export function sortLeaderboardMembers(members, category = 'overall') {
  return [...(members || [])].sort((left, right) => compareLeaderboardMembers(left, right, category));
}

export function filterLeaderboardMembers(members, { rankId = 'all', query = '' } = {}) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return (members || []).filter((member) => (rankId === 'all' || member.rankId === rankId)
    && (!normalizedQuery || member.displayName.toLocaleLowerCase().includes(normalizedQuery)));
}

export function buildLeaderboardResults(members, { category = 'overall', rankId = 'all', query = '' } = {}) {
  return sortLeaderboardMembers(filterLeaderboardMembers(members, { rankId, query }), category)
    .map((member, index) => ({ ...member, position: index + 1 }));
}

export function createCurrentMemberEntry(identity, disciplineState) {
  const rank = ranks.find((item) => item.slug === disciplineState?.currentRankSlug);
  const highestRank = getHighestRankAchieved(disciplineState) || rank;
  const totalXp = Number(disciplineState?.totalXp);
  if (!identity?.memberId || !identity?.displayName || !rank || !highestRank || !Number.isFinite(totalXp)) return null;
  const initials = identity.displayName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return {
    id: identity.memberId,
    displayName: identity.displayName,
    avatarInitials: initials || identity.displayName.slice(0, 1).toUpperCase(),
    rankId: rank.slug,
    rankName: rank.name,
    rankNumber: rank.number,
    rankColor: rank.color,
    highestRankId: highestRank.rankSlug,
    highestRankName: highestRank.rankName,
    highestRankNumber: highestRank.rankNumber,
    highestRankAchieved: highestRank,
    level: getLevelFromTotalXp(totalXp),
    totalXp,
    currentDisciplineStreak: Number(disciplineState.currentStreak) || 0,
    longestDisciplineStreak: Number(disciplineState.longestStreak) || 0,
    demonstrationIdentifier: 'CURRENT-SESSION',
    isDemonstration: false,
    isCurrentMember: true,
  };
}

export function mergeLeaderboardMembers(demoMembers, currentMember) {
  const dedupedDemos = [...(demoMembers || [])].filter((member) => member.id !== currentMember?.id);
  return currentMember ? [...dedupedDemos, currentMember] : dedupedDemos;
}

export function getLeaderboardPositionLabel(position) {
  if (position === 1) return '1st Place';
  if (position === 2) return '2nd Place';
  if (position === 3) return '3rd Place';
  return `Position ${position}`;
}

export function getLeaderboardCategoryValue(member, category) {
  if (category === 'discipline') {
    return `${member.currentDisciplineStreak} day current streak · ${member.longestDisciplineStreak} day longest`;
  }
  if (category === 'xp') return `${Number(member.totalXp).toLocaleString('en-IN')} total XP`;
  return `Rank ${member.rankNumber} · Level ${member.level}`;
}
