import { getIstDateKey } from './taskScheduleBuilder.js';

export const PERSONAL_BEST_CATEGORIES = Object.freeze(['overall', 'discipline', 'xp']);

function emptyPositionRecord() {
  return { currentPosition: null, bestPosition: null, achievedOn: null };
}

export function createPersonalBestRecord(memberId, highestRankAchieved = null) {
  return {
    memberId,
    overall: emptyPositionRecord(),
    discipline: emptyPositionRecord(),
    xp: emptyPositionRecord(),
    highestRankAchieved: highestRankAchieved ? {
      rankSlug: highestRankAchieved.rankSlug,
      rankNumber: highestRankAchieved.rankNumber,
      rankName: highestRankAchieved.rankName,
      progressionOrder: highestRankAchieved.progressionOrder,
      achievedOn: highestRankAchieved.achievedOn || highestRankAchieved.lastAchievedOn || null,
    } : null,
  };
}

/** Updates one member's current positions and lifetime bests without changing other member records. */
export function updateMemberPersonalBestRecord(recordsByMember, memberId, {
  positions = {},
  highestRankAchieved = null,
  dateKey = getIstDateKey(),
} = {}) {
  if (!memberId) return recordsByMember || {};

  const source = recordsByMember || {};
  const previous = source[memberId] || createPersonalBestRecord(memberId);
  const next = { ...previous };
  let changed = !source[memberId];

  PERSONAL_BEST_CATEGORIES.forEach((category) => {
    const rawPosition = Number(positions[category]);
    const currentPosition = Number.isInteger(rawPosition) && rawPosition > 0 ? rawPosition : previous[category]?.currentPosition ?? null;
    const previousRecord = previous[category] || emptyPositionRecord();
    let bestPosition = previousRecord.bestPosition;
    let achievedOn = previousRecord.achievedOn || null;

    if (currentPosition !== null && (bestPosition === null || currentPosition < bestPosition)) {
      bestPosition = currentPosition;
      achievedOn = dateKey;
    }

    if (currentPosition !== previousRecord.currentPosition
      || bestPosition !== previousRecord.bestPosition
      || achievedOn !== previousRecord.achievedOn) {
      next[category] = { currentPosition, bestPosition, achievedOn };
      changed = true;
    }
  });

  if (highestRankAchieved?.rankSlug) {
    const previousRank = previous.highestRankAchieved;
    const incomingOrder = Number(highestRankAchieved.progressionOrder) || 0;
    const previousOrder = Number(previousRank?.progressionOrder) || 0;
    if (!previousRank || incomingOrder > previousOrder) {
      next.highestRankAchieved = {
        rankSlug: highestRankAchieved.rankSlug,
        rankNumber: highestRankAchieved.rankNumber,
        rankName: highestRankAchieved.rankName,
        progressionOrder: incomingOrder,
        achievedOn: highestRankAchieved.achievedOn || highestRankAchieved.lastAchievedOn || null,
      };
      changed = true;
    } else if (incomingOrder === previousOrder && !previousRank.achievedOn && (highestRankAchieved.achievedOn || highestRankAchieved.lastAchievedOn)) {
      next.highestRankAchieved = { ...previousRank, achievedOn: highestRankAchieved.achievedOn || highestRankAchieved.lastAchievedOn };
      changed = true;
    }
  }

  return changed ? { ...source, [memberId]: next } : source;
}
