import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PersonalBestRecords from '../../components/app/PersonalBestRecords.jsx';
import DisciplineActivityMap from '../../components/app/DisciplineActivityMap.jsx';
import MemberAvatar from '../../components/app/MemberAvatar.jsx';
import RankBadge from '../../components/ranks/RankBadge.jsx';
import AppIcon from '../../components/app/AppIcon.jsx';
import PageLoadingSkeleton from '../../components/app/PageLoadingSkeleton.jsx';
import { taskApi } from '../../services/taskApi.js';
import '../../styles/public-pages.css';
import '../../styles/leaderboard.css';

function formatMemberSince(dateKey) {
  if (!dateKey) return 'Unavailable';
  return new Intl.DateTimeFormat('en-IN', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${dateKey}T12:00:00Z`));
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function rankName(slug) {
  return ({ origin: 'Origin', ember: 'Ember', surge: 'Surge', vector: 'Vector', apex: 'Apex', zenith: 'Zenith', continuum: 'Continuum' })[slug] || slug;
}

function ProfileUnavailable({ message }) {
  return <main className="leaderboard-public-profile"><Link className="leaderboard-back-link" to="/app/leaderboard"><AppIcon name="arrow" /> Back to Community Leaderboard</Link><section className="leaderboard-profile-unavailable"><p className="app-eyebrow">PUBLIC PROFILE</p><h1>Profile unavailable</h1><p>{message}</p></section></main>;
}

export default function PublicMemberProfilePage() {
  const { memberId: publicHandle } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    taskApi.publicMemberProfile(publicHandle, { signal: controller.signal }).then((result) => setProfile(result.profile || null)).catch((requestError) => {
      if (requestError?.name !== 'AbortError') setError(requestError?.status === 404 ? 'This member has not made a public profile available.' : requestError?.message || 'The profile could not be loaded.');
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [publicHandle]);

  useEffect(() => {
    if (!profile?.isCurrentMember) return undefined;
    let active = true;
    let controller = null;
    const refreshOwnProfile = () => {
      controller?.abort();
      controller = new AbortController();
      taskApi.publicMemberProfile(publicHandle, { signal: controller.signal }).then((result) => {
        if (active) setProfile(result.profile || null);
      }).catch((requestError) => {
        if (active && requestError?.name !== 'AbortError') setError(requestError?.message || 'The profile could not be refreshed.');
      });
    };
    window.addEventListener('system:progression-state-changed', refreshOwnProfile);
    return () => {
      active = false;
      controller?.abort();
      window.removeEventListener('system:progression-state-changed', refreshOwnProfile);
    };
  }, [profile?.isCurrentMember, publicHandle]);

  if (loading) return <main className="leaderboard-public-profile"><Link className="leaderboard-back-link" to="/app/leaderboard"><AppIcon name="arrow" /> Back to Community Leaderboard</Link><PageLoadingSkeleton variant="profile" label="Loading public member profile" /></main>;
  if (error || !profile) return <ProfileUnavailable message={error || 'This public profile is not available.'} />;

  const rank = profile.currentRank;
  const statItems = [
    { key: 'level', label: 'LEVEL', value: profile.level == null ? null : String(profile.level).padStart(2, '0') },
    { key: 'xp', label: 'CURRENT-RUN XP', value: profile.totalXp == null ? null : formatNumber(profile.totalXp) },
    { key: 'current-streak', label: 'CURRENT STREAK', value: profile.currentStreak == null ? null : `${profile.currentStreak} days` },
    { key: 'run-longest', label: 'CURRENT-RUN LONGEST STREAK', value: profile.runLongestStreak == null ? null : `${profile.runLongestStreak} days` },
    { key: 'lifetime-longest', label: 'LIFETIME LONGEST STREAK', value: profile.lifetimeLongestStreak == null ? null : `${profile.lifetimeLongestStreak} days` },
    { key: 'discipline-points', label: 'DISCIPLINE POINT BALANCE', value: profile.disciplinePointBalance == null ? null : `${Number(profile.disciplinePointBalance).toFixed(2)} DP` },
    { key: 'grace-points', label: 'GRACE POINT BALANCE', value: profile.gracePointBalance == null ? null : `${profile.gracePointBalance} GP` },
    { key: 'reset-count', label: 'PROGRESSION RESET COUNT', value: String(profile.resetCount ?? 0) },
  ].filter((item) => item.value !== null);

  return (
    <>
      <main className="leaderboard-public-profile">
        <Link className="leaderboard-back-link" to="/app/leaderboard"><AppIcon name="arrow" /> Back to Community Leaderboard</Link>
        <article className="leaderboard-profile-card">
          <div className="leaderboard-profile-card__art">{rank ? <RankBadge rank={rank} size="large" presentation="reference" /> : <MemberAvatar name={profile.username} mark={profile.avatarMark} className="leaderboard-profile-card__avatar" />}</div>
          <div className="leaderboard-profile-card__content">
            <p className="app-eyebrow">{profile.isCurrentMember ? 'YOUR PUBLIC PROFILE' : 'PUBLIC MEMBER PROFILE'}</p>
            <h1>{profile.username}</h1>
            {profile.firstName !== null && profile.firstName !== undefined && <p className="leaderboard-profile-card__personal-name">{[profile.firstName, profile.middleName, profile.lastName].filter(Boolean).join(' ')}</p>}
            {rank ? <><p className="leaderboard-profile-card__rank">Rank {rank.number} — {rank.name}</p><p className="leaderboard-profile-card__description">Current progression uses this member’s active ProgressionRun.</p></> : <p className="leaderboard-profile-card__rank">Current Rank hidden by member preference</p>}
            {profile.highestRankAchieved && <p className="leaderboard-profile-card__rank">Highest Rank Achieved · Rank {profile.highestRankAchieved.number} — {profile.highestRankAchieved.name}</p>}
            <p className="leaderboard-profile-card__description">Member since {formatMemberSince(profile.memberSince)}</p>
            {statItems.length > 0 && <dl className="leaderboard-profile-card__stats">{statItems.map((item) => <div key={item.key}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>}
            {profile.rankBadges?.length > 0 && <section className="leaderboard-profile-rank-badges" aria-label="Rank badges earned"><p className="app-eyebrow">RANK BADGES EARNED</p><div>{profile.rankBadges.map((slug) => <span key={slug}>{rankName(slug)}</span>)}</div></section>}
            <p className="leaderboard-profile-card__notice">Reset Count remains visible as a permanent account progression total. Other fields follow the member’s saved visibility choices.</p>
          </div>
        </article>
        {profile.personalBestRecords && <PersonalBestRecords records={profile.personalBestRecords} isCurrentMember={profile.isCurrentMember} />}
        {profile.activityMap && <DisciplineActivityMap compact disciplineState={{ memberSince: profile.memberSince }} schedule={null} serverRecords={profile.activityMap.records} memberSince={profile.activityMap.memberSince} />}
      </main>
    </>
  );
}
