import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import AppIcon from '../../components/app/AppIcon.jsx';
import DisciplineActivityMap from '../../components/app/DisciplineActivityMap.jsx';
import PersonalBestRecords from '../../components/app/PersonalBestRecords.jsx';
import MemberAvatar from '../../components/app/MemberAvatar.jsx';
import { dashboardDemo } from '../../data/dashboardDemo.js';
import { leaderboardDemoMembers } from '../../data/leaderboardDemo.js';
import { DISCIPLINE_POINTS_CAP, getRankDisciplineConfig } from '../../data/disciplineConfig.js';
import { useTaskSchedule } from '../../context/TaskScheduleContext.jsx';
import { useUserPreferences } from '../../context/UserPreferencesContext.jsx';
import useCurrentMemberPersonalBest from '../../hooks/useCurrentMemberPersonalBest.js';
import { getScheduleDaySnapshot } from '../../utils/disciplineActivity.js';
import { createCurrentMemberEntry, mergeLeaderboardMembers } from '../../utils/leaderboard.js';
import { getIstDateKey } from '../../utils/taskScheduleBuilder.js';
import '../../styles/discipline.css';

function formatMemberSince(dateKey) {
  return new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${dateKey}T12:00:00Z`));
}

export default function ProfilePage() {
  const { disciplineState, recoveryState, currentSchedule } = useTaskSchedule();
  const { preferences } = useUserPreferences();
  const rank = getRankDisciplineConfig(disciplineState.currentRankSlug);
  const identity = useMemo(() => ({ ...dashboardDemo.member, ...preferences.profile }), [preferences.profile]);
  const currentMember = useMemo(() => createCurrentMemberEntry(identity, disciplineState), [identity, disciplineState]);
  const leaderboardMembers = useMemo(() => mergeLeaderboardMembers(leaderboardDemoMembers, currentMember), [currentMember]);
  const personalBestRecords = useCurrentMemberPersonalBest(currentMember, leaderboardMembers);
  const todayKey = getIstDateKey();
  const totalCompleted = disciplineState.totalCompletedScheduledTasks + getScheduleDaySnapshot(currentSchedule, todayKey, { todayKey }).completedTaskCount;

  return (
    <div className="profile-page">
      <header className="discipline-page__header profile-page__header">
        <div><p className="app-eyebrow">ACCOUNT · MEMBER PROFILE</p><h1>Member Profile</h1><p>Your identity and Discipline record in one place.</p></div>
        <Link className="profile-page__discipline-link" to="/app/settings">Edit settings <AppIcon name="arrow" /></Link>
      </header>
      <section className="profile-identity app-panel">
        <MemberAvatar name={preferences.profile.displayName} mark={preferences.profile.avatarMark} className="profile-identity__avatar" />
        <div><p className="app-eyebrow">DEMONSTRATION MEMBER</p><h2>{preferences.profile.displayName}</h2><p>{dashboardDemo.member.email}</p></div>
        <div className="profile-identity__since"><small>MEMBER SINCE</small><strong>{formatMemberSince(disciplineState.memberSince)}</strong></div>
      </section>
      <section className="profile-discipline app-panel" aria-labelledby="profile-discipline-title">
        <div className="discipline-section-heading"><div><p className="app-eyebrow">SHARED PROGRESSION RECORD</p><h2 id="profile-discipline-title">Discipline overview</h2></div><span>Current Rank · {rank.number} {rank.name}</span></div>
        <dl className="profile-discipline__metrics">
          <div><dt>Current streak</dt><dd>{disciplineState.currentStreak} days</dd></div>
          <div><dt>Longest streak</dt><dd>{disciplineState.longestStreak} days</dd></div>
          <div><dt>Discipline Points</dt><dd>{disciplineState.dpBalance.toFixed(2)} <small>/ {DISCIPLINE_POINTS_CAP.toFixed(2)}</small></dd></div>
          <div><dt>Grace Points</dt><dd>{recoveryState.gracePoints}</dd></div>
          <div><dt>Completed scheduled tasks</dt><dd>{totalCompleted}</dd></div>
        </dl>
      </section>
      <PersonalBestRecords records={personalBestRecords} isCurrentMember />
      <DisciplineActivityMap compact disciplineState={disciplineState} schedule={currentSchedule} />
      <p className="discipline-disclosure"><AppIcon name="activity" />Profile and Discipline read the same task history and shared browser-session balances. Member Since and Personal Best Records persist through a Progression Reset, but permanent account storage requires backend persistence.</p>
    </div>
  );
}
