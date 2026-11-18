import { ranks } from './ranks.js';
import { getLevelFromTotalXp } from '../utils/disciplineManager.js';

const rankBySlug = new Map(ranks.map((rank) => [rank.slug, rank]));

function demoPersonalBest({ positions, highestRankId, highestRankAchievedOn }) {
  const highest = rankBySlug.get(highestRankId);
  const position = (currentPosition, bestPosition, achievedOn) => ({ currentPosition, bestPosition, achievedOn });
  return Object.freeze({
    overall: position(...positions.overall),
    discipline: position(...positions.discipline),
    xp: position(...positions.xp),
    highestRankAchieved: highest ? {
      rankSlug: highest.slug,
      rankNumber: highest.number,
      rankName: highest.name,
      progressionOrder: highest.progressionOrder,
      achievedOn: highestRankAchievedOn,
    } : null,
  });
}

function createDemoMember({ id, displayName, initials, rankId, totalXp, currentDisciplineStreak, longestDisciplineStreak, demonstrationIdentifier, personalBestRecords }) {
  const rank = rankBySlug.get(rankId);
  if (!rank) throw new Error(`Unknown leaderboard demo Rank: ${rankId}`);
  return Object.freeze({
    id,
    displayName,
    avatarInitials: initials,
    rankId: rank.slug,
    rankName: rank.name,
    rankNumber: rank.number,
    rankColor: rank.color,
    highestRankId: personalBestRecords.highestRankAchieved.rankSlug,
    highestRankName: personalBestRecords.highestRankAchieved.rankName,
    highestRankNumber: personalBestRecords.highestRankAchieved.rankNumber,
    highestRankAchieved: personalBestRecords.highestRankAchieved,
    personalBestRecords,
    level: getLevelFromTotalXp(totalXp),
    totalXp,
    currentDisciplineStreak,
    longestDisciplineStreak,
    demonstrationIdentifier,
    isDemonstration: true,
    isCurrentMember: false,
  });
}

// Fictional, stable UI fixtures. These values do not represent real community members.
export const leaderboardDemoMembers = Object.freeze([
  createDemoMember({ id: 'demo-origin-sana', displayName: 'Sana Mir', initials: 'SM', rankId: 'origin', totalXp: 3200, currentDisciplineStreak: 84, longestDisciplineStreak: 120, demonstrationIdentifier: 'LEADERBOARD-DEMO-01', personalBestRecords: demoPersonalBest({ positions: { overall: [10, 6, '2026-09-12'], discipline: [2, 1, '2026-10-22'], xp: [9, 7, '2026-10-01'] }, highestRankId: 'vector', highestRankAchievedOn: '2026-10-12' }) }),
  createDemoMember({ id: 'demo-origin-tavi', displayName: 'Tavi Noor', initials: 'TN', rankId: 'origin', totalXp: 2950, currentDisciplineStreak: 73, longestDisciplineStreak: 104, demonstrationIdentifier: 'LEADERBOARD-DEMO-02', personalBestRecords: demoPersonalBest({ positions: { overall: [11, 8, '2026-09-16'], discipline: [3, 2, '2026-10-23'], xp: [10, 8, '2026-10-04'] }, highestRankId: 'surge', highestRankAchievedOn: '2026-10-17' }) }),
  createDemoMember({ id: 'demo-ember-ivo', displayName: 'Ivo Kade', initials: 'IK', rankId: 'ember', totalXp: 4800, currentDisciplineStreak: 84, longestDisciplineStreak: 140, demonstrationIdentifier: 'LEADERBOARD-DEMO-03', personalBestRecords: demoPersonalBest({ positions: { overall: [8, 6, '2026-09-22'], discipline: [1, 1, '2026-10-01'], xp: [7, 5, '2026-10-08'] }, highestRankId: 'zenith', highestRankAchievedOn: '2026-10-20' }) }),
  createDemoMember({ id: 'demo-ember-rhea', displayName: 'Rhea Moss', initials: 'RM', rankId: 'ember', totalXp: 4500, currentDisciplineStreak: 62, longestDisciplineStreak: 132, demonstrationIdentifier: 'LEADERBOARD-DEMO-04', personalBestRecords: demoPersonalBest({ positions: { overall: [9, 7, '2026-09-21'], discipline: [4, 2, '2026-10-02'], xp: [8, 6, '2026-10-09'] }, highestRankId: 'surge', highestRankAchievedOn: '2026-10-10' }) }),
  createDemoMember({ id: 'demo-surge-mina', displayName: 'Mina Rook', initials: 'MR', rankId: 'surge', totalXp: 5900, currentDisciplineStreak: 59, longestDisciplineStreak: 99, demonstrationIdentifier: 'LEADERBOARD-DEMO-05', personalBestRecords: demoPersonalBest({ positions: { overall: [6, 4, '2026-09-25'], discipline: [5, 3, '2026-10-04'], xp: [5, 2, '2026-10-11'] }, highestRankId: 'vector', highestRankAchievedOn: '2026-10-15' }) }),
  createDemoMember({ id: 'demo-surge-tarin', displayName: 'Tarin Wells', initials: 'TW', rankId: 'surge', totalXp: 5700, currentDisciplineStreak: 59, longestDisciplineStreak: 99, demonstrationIdentifier: 'LEADERBOARD-DEMO-06', personalBestRecords: demoPersonalBest({ positions: { overall: [7, 6, '2026-09-26'], discipline: [6, 4, '2026-10-05'], xp: [6, 4, '2026-10-12'] }, highestRankId: 'surge', highestRankAchievedOn: '2026-10-06' }) }),
  createDemoMember({ id: 'demo-vector-kian', displayName: 'Kian Sol', initials: 'KS', rankId: 'vector', totalXp: 6600, currentDisciplineStreak: 55, longestDisciplineStreak: 98, demonstrationIdentifier: 'LEADERBOARD-DEMO-07', personalBestRecords: demoPersonalBest({ positions: { overall: [5, 3, '2026-09-27'], discipline: [7, 5, '2026-10-06'], xp: [4, 2, '2026-10-13'] }, highestRankId: 'apex', highestRankAchievedOn: '2026-10-16' }) }),
  createDemoMember({ id: 'demo-apex-asha', displayName: 'Asha Venn', initials: 'AV', rankId: 'apex', totalXp: 7550, currentDisciplineStreak: 48, longestDisciplineStreak: 84, demonstrationIdentifier: 'LEADERBOARD-DEMO-08', personalBestRecords: demoPersonalBest({ positions: { overall: [4, 2, '2026-09-28'], discipline: [8, 4, '2026-10-07'], xp: [3, 1, '2026-10-14'] }, highestRankId: 'zenith', highestRankAchievedOn: '2026-10-18' }) }),
  createDemoMember({ id: 'demo-zenith-theo', displayName: 'Theo Ren', initials: 'TR', rankId: 'zenith', totalXp: 9600, currentDisciplineStreak: 31, longestDisciplineStreak: 72, demonstrationIdentifier: 'LEADERBOARD-DEMO-09', personalBestRecords: demoPersonalBest({ positions: { overall: [3, 2, '2026-09-29'], discipline: [9, 5, '2026-10-08'], xp: [1, 1, '2026-10-15'] }, highestRankId: 'continuum', highestRankAchievedOn: '2026-10-19' }) }),
  createDemoMember({ id: 'demo-continuum-mira', displayName: 'Mira Vale', initials: 'MV', rankId: 'continuum', totalXp: 8800, currentDisciplineStreak: 22, longestDisciplineStreak: 52, demonstrationIdentifier: 'LEADERBOARD-DEMO-10', personalBestRecords: demoPersonalBest({ positions: { overall: [1, 1, '2026-09-30'], discipline: [10, 6, '2026-10-09'], xp: [2, 1, '2026-10-16'] }, highestRankId: 'continuum', highestRankAchievedOn: '2026-10-20' }) }),
]);
