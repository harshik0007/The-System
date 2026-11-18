import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { dashboardDemo } from '../../data/dashboardDemo.js';
import { leaderboardDemoMembers } from '../../data/leaderboardDemo.js';
import { ranks } from '../../data/ranks.js';
import { useTaskSchedule } from '../../context/TaskScheduleContext.jsx';
import { useUserPreferences } from '../../context/UserPreferencesContext.jsx';
import PersonalBestRecords from '../../components/app/PersonalBestRecords.jsx';
import DisciplineActivityMap from '../../components/app/DisciplineActivityMap.jsx';
import MemberAvatar from '../../components/app/MemberAvatar.jsx';
import RankBadge from '../../components/ranks/RankBadge.jsx';
import AppIcon from '../../components/app/AppIcon.jsx';
import useCurrentMemberPersonalBest from '../../hooks/useCurrentMemberPersonalBest.js';
import { createCurrentMemberEntry, mergeLeaderboardMembers } from '../../utils/leaderboard.js';
import '../../styles/public-pages.css';
import '../../styles/leaderboard.css';

export default function PublicMemberProfilePage() {
  const { memberId } = useParams();
  const { disciplineState, recoveryState, currentSchedule } = useTaskSchedule();
  const { preferences } = useUserPreferences();
  const isCurrentMember = memberId === dashboardDemo.member.memberId;
  const identity = useMemo(() => ({ ...dashboardDemo.member, ...preferences.profile }), [preferences.profile]);
  const currentMember = useMemo(() => createCurrentMemberEntry(identity, disciplineState), [identity, disciplineState]);
  const members = useMemo(() => mergeLeaderboardMembers(leaderboardDemoMembers, currentMember), [currentMember]);
  const member = isCurrentMember ? currentMember : leaderboardDemoMembers.find((item) => item.id === memberId);
  const personalBestRecords = useCurrentMemberPersonalBest(member, members);
  const rank = member && ranks.find((item) => item.slug === member.rankId);
  const privacy = preferences.privacy;

  if (!member || !rank || (isCurrentMember && !privacy.publicProfile)) {
    return (
      <main className="leaderboard-public-profile">
        <Link className="leaderboard-back-link" to="/app/leaderboard"><AppIcon name="arrow" /> Back to Community Leaderboard</Link>
        <section className="leaderboard-profile-unavailable"><p className="app-eyebrow">PUBLIC PROFILE</p><h1>Profile unavailable</h1><p>{isCurrentMember ? 'This member has disabled public profile visibility.' : 'This public profile is not available in the current demonstration dataset.'}</p></section>
      </main>
    );
  }

  const statItems = isCurrentMember
    ? [
      { key: 'level', label: 'LEVEL', value: String(member.level).padStart(2, '0'), visible: privacy.level },
      { key: 'total-xp', label: 'TOTAL XP', value: Number(member.totalXp).toLocaleString('en-IN'), visible: privacy.progressionStats },
      { key: 'current-streak', label: 'CURRENT DISCIPLINE STREAK', value: `${member.currentDisciplineStreak} days`, visible: privacy.currentStreak },
      { key: 'longest-streak', label: 'LONGEST DISCIPLINE STREAK', value: `${member.longestDisciplineStreak} days`, visible: privacy.longestStreak },
      { key: 'discipline-points', label: 'DISCIPLINE POINT BALANCE', value: `${disciplineState.dpBalance.toFixed(2)} DP`, visible: privacy.disciplinePointBalance },
      { key: 'grace-points', label: 'GRACE POINT BALANCE', value: `${recoveryState.gracePoints} GP`, visible: privacy.gracePointBalance },
    ].filter((item) => item.visible)
    : [
      { key: 'level', label: 'LEVEL', value: String(member.level).padStart(2, '0'), visible: true },
      { key: 'total-xp', label: 'TOTAL XP', value: Number(member.totalXp).toLocaleString('en-IN'), visible: true },
      { key: 'current-streak', label: 'CURRENT DISCIPLINE STREAK', value: `${member.currentDisciplineStreak} days`, visible: true },
      { key: 'longest-streak', label: 'LONGEST DISCIPLINE STREAK', value: `${member.longestDisciplineStreak} days`, visible: true },
    ];

  return (
    <main className="leaderboard-public-profile">
      <Link className="leaderboard-back-link" to="/app/leaderboard"><AppIcon name="arrow" /> Back to Community Leaderboard</Link>
      <article className="leaderboard-profile-card">
        <div className="leaderboard-profile-card__art">{(!isCurrentMember || privacy.currentRank) ? <RankBadge rank={rank} size="large" presentation="reference" /> : <MemberAvatar name={member.displayName} mark={member.avatarMark} className="leaderboard-profile-card__avatar" />}</div>
        <div className="leaderboard-profile-card__content">
          <p className="app-eyebrow">{member.isCurrentMember ? 'CURRENT MEMBER · THIS BROWSER SESSION' : 'DEMONSTRATION MEMBER · EXAMPLE PROFILE'}</p>
          <h1>{member.displayName}</h1>
          {(!isCurrentMember || privacy.currentRank) ? <><p className="leaderboard-profile-card__rank">Rank {rank.number} — {rank.name}</p><p className="leaderboard-profile-card__description">{rank.shortDescription}</p></> : <p className="leaderboard-profile-card__rank">Current Rank hidden by member preference</p>}
          {statItems.length > 0 && <dl className="leaderboard-profile-card__stats">{statItems.map((item) => <div key={item.key}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>}
          {!member.isCurrentMember && <p className="leaderboard-profile-card__notice">This profile uses fictional, stable demonstration values. It is not a verified community member.</p>}
          {member.isCurrentMember && <p className="leaderboard-profile-card__notice">Progression and Personal Best Records are saved in this browser session. Permanent account records require backend persistence; no live community profile service is connected.</p>}
        </div>
      </article>
      {(!isCurrentMember || privacy.personalBest) && <PersonalBestRecords records={personalBestRecords} isCurrentMember={member.isCurrentMember} isDemonstration={!member.isCurrentMember} />}
      {isCurrentMember && privacy.activityMap && <DisciplineActivityMap compact disciplineState={disciplineState} schedule={currentSchedule} />}
    </main>
  );
}
