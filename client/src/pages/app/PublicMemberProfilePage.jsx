import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { dashboardDemo } from '../../data/dashboardDemo.js';
import { leaderboardDemoMembers } from '../../data/leaderboardDemo.js';
import { ranks } from '../../data/ranks.js';
import { useTaskSchedule } from '../../context/TaskScheduleContext.jsx';
import PersonalBestRecords from '../../components/app/PersonalBestRecords.jsx';
import RankBadge from '../../components/ranks/RankBadge.jsx';
import AppIcon from '../../components/app/AppIcon.jsx';
import useCurrentMemberPersonalBest from '../../hooks/useCurrentMemberPersonalBest.js';
import { createCurrentMemberEntry, mergeLeaderboardMembers } from '../../utils/leaderboard.js';
import '../../styles/public-pages.css';
import '../../styles/leaderboard.css';

export default function PublicMemberProfilePage() {
  const { memberId } = useParams();
  const { disciplineState } = useTaskSchedule();
  const isCurrentMember = memberId === dashboardDemo.member.memberId;
  const currentMember = useMemo(() => createCurrentMemberEntry(dashboardDemo.member, disciplineState), [disciplineState]);
  const members = useMemo(() => mergeLeaderboardMembers(leaderboardDemoMembers, currentMember), [currentMember]);
  const member = isCurrentMember ? currentMember : leaderboardDemoMembers.find((item) => item.id === memberId);
  const personalBestRecords = useCurrentMemberPersonalBest(member, members);
  const rank = member && ranks.find((item) => item.slug === member.rankId);

  if (!member || !rank) {
    return (
      <main className="leaderboard-public-profile">
        <Link className="leaderboard-back-link" to="/app/leaderboard"><AppIcon name="arrow" /> Back to Community Leaderboard</Link>
        <section className="leaderboard-profile-unavailable"><p className="app-eyebrow">PUBLIC PROFILE</p><h1>Profile unavailable</h1><p>This public profile is not available in the current demonstration dataset.</p></section>
      </main>
    );
  }

  return (
    <main className="leaderboard-public-profile">
      <Link className="leaderboard-back-link" to="/app/leaderboard"><AppIcon name="arrow" /> Back to Community Leaderboard</Link>
      <article className="leaderboard-profile-card">
        <div className="leaderboard-profile-card__art"><RankBadge rank={rank} size="large" presentation="reference" /></div>
        <div className="leaderboard-profile-card__content">
          <p className="app-eyebrow">{member.isCurrentMember ? 'CURRENT MEMBER · THIS BROWSER SESSION' : 'DEMONSTRATION MEMBER · EXAMPLE PROFILE'}</p>
          <h1>{member.displayName}</h1>
          <p className="leaderboard-profile-card__rank">Rank {rank.number} — {rank.name}</p>
          <p className="leaderboard-profile-card__description">{rank.shortDescription}</p>
          <dl className="leaderboard-profile-card__stats">
            <div><dt>LEVEL</dt><dd>{String(member.level).padStart(2, '0')}</dd></div>
            <div><dt>TOTAL XP</dt><dd>{Number(member.totalXp).toLocaleString('en-IN')}</dd></div>
            <div><dt>CURRENT DISCIPLINE STREAK</dt><dd>{member.currentDisciplineStreak} days</dd></div>
            <div><dt>LONGEST DISCIPLINE STREAK</dt><dd>{member.longestDisciplineStreak} days</dd></div>
          </dl>
          {!member.isCurrentMember && <p className="leaderboard-profile-card__notice">This profile uses fictional, stable demonstration values. It is not a verified community member.</p>}
          {member.isCurrentMember && <p className="leaderboard-profile-card__notice">Progression and Personal Best Records are saved in this browser session. Permanent account records require backend persistence; no live community profile service is connected.</p>}
        </div>
      </article>
      <PersonalBestRecords records={personalBestRecords} isCurrentMember={member.isCurrentMember} isDemonstration={!member.isCurrentMember} />
    </main>
  );
}
