import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppIcon from '../../components/app/AppIcon.jsx';
import { SkeletonLine } from '../../components/app/PageLoadingSkeleton.jsx';
import DisciplineActivityMap from '../../components/app/DisciplineActivityMap.jsx';
import MemberAvatar from '../../components/app/MemberAvatar.jsx';
import PersonalBestRecords from '../../components/app/PersonalBestRecords.jsx';
import RankBadge from '../../components/ranks/RankBadge.jsx';
import { ranks } from '../../data/ranks.js';
import { getRankDisciplineConfig } from '../../data/disciplineConfig.js';
import { useTaskBackend } from '../../context/TaskBackendContext.jsx';
import { useUserPreferences } from '../../context/UserPreferencesContext.jsx';
import { useAccountActions } from '../../context/AccountActionsContext.jsx';
import { taskApi } from '../../services/taskApi.js';
import '../../styles/discipline.css';

function formatMemberSince(dateKey) {
  if (!dateKey) return 'Not on file';
  return new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${dateKey}T12:00:00Z`));
}

export default function ProfilePage() {
  const {
    disciplineSummary: summary,
    disciplineCalendar,
    disciplineError,
    progression,
    recoveryLoading,
    refreshRecovery,
  } = useTaskBackend();
  const { preferences } = useUserPreferences();
  const { requestLogout } = useAccountActions();
  const [accountSettings, setAccountSettings] = useState(null);
  const [accountLoading, setAccountLoading] = useState(true);
  const [accountError, setAccountError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    taskApi.accountSettings({ signal: controller.signal }).then(({ settings }) => {
      setAccountSettings(settings);
      setAccountError('');
    }).catch((error) => {
      if (error?.name !== 'AbortError') setAccountError(error?.message || 'Account information could not be loaded.');
    }).finally(() => {
      if (!controller.signal.aborted) setAccountLoading(false);
    });
    return () => controller.abort();
  }, []);
  const run = progression?.progression || null;
  const currentRankData = summary?.currentRank || run?.xpSummary?.currentRank || null;
  const currentRankPresentation = getRankDisciplineConfig(currentRankData?.slug || run?.currentRankSlug || 'origin');
  const currentRank = { ...currentRankPresentation, ...(currentRankData || {}) };
  const lifetimeRank = ranks.find((item) => item.slug === progression?.highestRankAchieved) || null;
  const memberSince = accountSettings?.account?.memberSince || summary?.memberSince || progression?.memberSince;
  const lifetimeStreak = accountSettings?.account?.lifetimeLongestStreak ?? summary?.lifetimeLongestStreak ?? progression?.lifetimeLongestStreak;
  const username = accountSettings?.profile?.username || '';
  const personalName = [accountSettings?.profile?.firstName, accountSettings?.profile?.middleName, accountSettings?.profile?.lastName].filter(Boolean).join(' ');
  const avatarMark = accountSettings?.profile?.avatarMark || preferences.profile.avatarMark;
  const rankBadges = accountSettings?.achievements?.rankBadges || [];
  const walletCap = summary?.disciplinePointWalletCap;

  return (
    <div className="profile-page">
      <header className="discipline-page__header profile-page__header">
        <div><p className="app-eyebrow">ACCOUNT · MEMBER PROFILE</p><h1>Member Profile</h1><p>Your identity and lifetime Discipline record in one place.</p></div>
        <Link className="profile-page__discipline-link" to="/app/settings">Edit settings <AppIcon name="arrow" /></Link>
      </header>

      {disciplineError && <p className="discipline-feedback" role="alert"><AppIcon name="activity" />{disciplineError}</p>}
      {accountError && <p className="discipline-feedback" role="alert"><AppIcon name="profile" />{accountError}</p>}

      <section className="profile-identity app-panel">
        <MemberAvatar name={username} mark={avatarMark} className="profile-identity__avatar" />
        <div><p className="app-eyebrow">MEMBER PROFILE</p><h2>{accountLoading ? <SkeletonLine width="short" label="Loading username" /> : username || 'Member profile'}</h2><p className="profile-identity__name">{accountLoading ? <SkeletonLine width="medium" label="Loading profile name" /> : personalName || 'Name not added'}</p><p>Member since {accountLoading && !memberSince ? <SkeletonLine width="medium" label="Loading member date" /> : formatMemberSince(memberSince)}</p></div>
        <div className="profile-identity__since"><small>ACCOUNT STATUS</small><strong>{accountLoading ? <SkeletonLine width="short" label="Loading account status" /> : accountSettings?.account?.status || '—'}</strong><button className="profile-identity__logout account-logout-action" type="button" onClick={requestLogout}>Log out</button></div>
      </section>

      <section className="profile-account app-panel" aria-labelledby="profile-account-title">
        <div className="discipline-section-heading"><div><p className="app-eyebrow">PERMANENT ACCOUNT RECORD</p><h2 id="profile-account-title">Account information</h2></div></div>
        <dl className="profile-discipline__metrics">
          <div><dt>Account created</dt><dd>{accountLoading && !accountSettings?.account?.createdAt ? <SkeletonLine width="medium" label="Loading account creation date" /> : formatMemberSince(accountSettings?.account?.createdAt?.slice(0, 10))}</dd></div>
          <div><dt>Member Since</dt><dd>{accountLoading && !memberSince ? <SkeletonLine width="medium" label="Loading member date" /> : formatMemberSince(memberSince)}</dd></div>
          <div><dt>Reset Count</dt><dd>{accountSettings?.account?.resetCount ?? progression?.resetCount ?? '—'}</dd><small>Manual restart does not change this count.</small></div>
          <div><dt>Lifetime Longest Streak</dt><dd>{lifetimeStreak == null ? '—' : `${lifetimeStreak} days`}</dd><small>Permanent account record</small></div>
        </dl>
      </section>

      <section className="profile-discipline app-panel" aria-labelledby="profile-discipline-title">
        <div className="discipline-section-heading"><div><p className="app-eyebrow">ACTIVE PROGRESSION RUN</p><h2 id="profile-discipline-title">Discipline overview</h2></div><span>Current Rank · {currentRankData ? `${currentRank.number} ${currentRank.name}` : recoveryLoading ? <SkeletonLine width="medium" label="Loading current Rank" /> : '—'}</span></div>
        <dl className="profile-discipline__metrics">
          <div><dt>Current Level</dt><dd>{accountSettings?.progression?.level == null ? '—' : String(accountSettings.progression.level).padStart(2, '0')}</dd></div>
          <div><dt>Current-run XP</dt><dd>{accountSettings?.progression?.totalXp == null ? '—' : Number(accountSettings.progression.totalXp).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</dd></div>
          <div><dt>Current streak</dt><dd>{summary ? `${summary.currentStreak} days` : '—'}</dd></div>
          <div><dt>Run longest streak</dt><dd>{summary ? `${summary.runLongestStreak} days` : '—'}</dd></div>
          <div className="profile-discipline__metric--lifetime"><dt>Lifetime Longest Streak</dt><dd>{lifetimeStreak == null ? '—' : `${lifetimeStreak} days`}</dd><small>Permanent account record</small></div>
          <div><dt>Discipline Points</dt><dd>{summary ? Number(summary.dpBalance).toFixed(2) : '—'} <small>/ {walletCap ? Number(walletCap).toFixed(2) : '—'}</small></dd></div>
          <div><dt>Grace Points</dt><dd>{summary?.gracePointBalance ?? '—'}</dd></div>
          <div><dt>Completed scheduled Tasks</dt><dd>{summary?.totalCompletedScheduledTasks ?? '—'}</dd></div>
          <div><dt>Total qualifying days</dt><dd>{summary?.totalQualifyingDays ?? '—'}</dd></div>
        </dl>
      </section>

      <section className="profile-lifetime app-panel" aria-labelledby="profile-lifetime-title">
        <div className="profile-lifetime__copy"><p className="app-eyebrow">LIFETIME ACHIEVEMENT</p><h2 id="profile-lifetime-title">Highest Rank achieved</h2><p>This record is kept separately from your current Rank and remains through progression resets.</p></div>
        {lifetimeRank
          ? <RankBadge rank={lifetimeRank} size="small" presentation="reference" className="profile-lifetime__badge" />
          : progression ? <p className="profile-lifetime__pending">No Rank achievement has been recorded yet.</p> : <SkeletonLine width="medium" label="Loading lifetime records" />}
      </section>

      <section className="profile-rank-badges app-panel" aria-labelledby="profile-rank-badges-title">
        <div className="discipline-section-heading"><div><p className="app-eyebrow">CURRENT RUN</p><h2 id="profile-rank-badges-title">Rank badges</h2></div></div>
        {rankBadges.length
          ? <div className="profile-rank-badges__list">{rankBadges.map((slug) => {
            const rank = ranks.find((item) => item.slug === slug);
            return rank ? <RankBadge key={slug} rank={rank} size="small" presentation="reference" className="profile-lifetime__badge" /> : null;
          })}</div>
          : accountSettings ? <p className="profile-lifetime__pending">No Rank badges have been recorded in this run yet.</p> : <SkeletonLine width="medium" label="Loading Rank badges" />}
      </section>

      <PersonalBestRecords records={accountSettings?.achievements?.personalBestRecords} isCurrentMember />

      <DisciplineActivityMap
        compact
        disciplineState={{ memberSince, dailyRecords: {}, emergencyPauseDates: [] }}
        schedule={null}
        serverRecords={disciplineCalendar?.records || []}
        serverToday={summary?.today || null}
        memberSince={disciplineCalendar?.memberSince || memberSince}
        activityLoading={!disciplineCalendar && !disciplineError}
        activityError={disciplineCalendar ? '' : disciplineError}
        onRetryActivity={refreshRecovery}
      />
      {recoveryLoading && !summary && <SkeletonLine width="long" label="Loading Member progression records" className="profile-progression-skeleton" />}
    </div>
  );
}
