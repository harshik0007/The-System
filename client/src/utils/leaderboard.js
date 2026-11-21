import { ranks } from '../data/ranks.js';

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

export function filterLeaderboardMembers(members, { rankId = 'all', query = '' } = {}) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return (members || []).filter((member) => (rankId === 'all' || member.rankId === rankId)
    && (!normalizedQuery || String(member.username || '').toLocaleLowerCase().includes(normalizedQuery)));
}

// The server assigns competitionRank. Client filters must preserve that rank;
// they must never recalculate authoritative positions from a filtered list.
export function buildLeaderboardResults(members, { rankId = 'all', query = '' } = {}) {
  return filterLeaderboardMembers(members, { rankId, query })
    .map((member) => ({ ...member, position: member.competitionRank ?? member.position ?? null }));
}

export function getLeaderboardPositionLabel(position) {
  return Number.isInteger(position) && position > 0 ? `Rank ${position}` : 'Ranking unavailable';
}

export function getLeaderboardCategoryValue(member, category) {
  if (category === 'discipline') {
    return `${member.currentDisciplineStreak ?? member.currentStreak ?? 0} day current streak · ${member.longestDisciplineStreak ?? member.longestStreak ?? 0} day run longest`;
  }
  if (category === 'xp') return `${Number(member.totalXp || 0).toLocaleString('en-IN')} current-run XP`;
  return `Rank ${member.rankNumber} · Level ${member.level}`;
}
