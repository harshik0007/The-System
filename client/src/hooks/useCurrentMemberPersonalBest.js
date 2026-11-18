import { useEffect, useMemo } from 'react';
import { useTaskSchedule } from '../context/TaskScheduleContext.jsx';
import { buildLeaderboardResults, LEADERBOARD_CATEGORIES } from '../utils/leaderboard.js';
import { createPersonalBestRecord } from '../utils/personalBestRecords.js';

export default function useCurrentMemberPersonalBest(member, members) {
  const { personalBestRecords, updatePersonalBestRecords } = useTaskSchedule();
  const currentPositions = useMemo(() => {
    if (!member?.id || !members?.length) return null;
    return Object.fromEntries(LEADERBOARD_CATEGORIES.map(({ id }) => [
      id,
      buildLeaderboardResults(members, { category: id }).find((entry) => entry.id === member.id)?.position ?? null,
    ]));
  }, [member?.id, members]);

  useEffect(() => {
    if (!member?.isCurrentMember || !currentPositions) return;
    updatePersonalBestRecords(member.id, {
      positions: currentPositions,
      highestRankAchieved: member.highestRankAchieved,
    });
  }, [member?.id, member?.isCurrentMember, member?.highestRankAchieved, currentPositions, updatePersonalBestRecords]);

  return useMemo(() => {
    if (!member?.id) return null;
    const savedRecord = member.isCurrentMember
      ? personalBestRecords?.[member.id]
      : member.personalBestRecords;
    const record = savedRecord || createPersonalBestRecord(member.id, member.highestRankAchieved);
    if (!currentPositions) return record;
    return {
      ...record,
      ...Object.fromEntries(LEADERBOARD_CATEGORIES.map(({ id }) => [
        id,
        { ...(record[id] || {}), currentPosition: currentPositions[id] },
      ])),
    };
  }, [member?.id, member?.isCurrentMember, member?.personalBestRecords, member?.highestRankAchieved, personalBestRecords, currentPositions]);
}
