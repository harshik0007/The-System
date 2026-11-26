import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ranks } from '../../data/ranks.js';
import RankBadge from '../../components/ranks/RankBadge.jsx';
import AppIcon from '../../components/app/AppIcon.jsx';
import PageLoadingSkeleton, { SkeletonLine } from '../../components/app/PageLoadingSkeleton.jsx';
import ProfileAvatar from '../../components/app/MemberAvatar.jsx';
import { taskApi } from '../../services/taskApi.js';
import { updateFirstRunProgress } from '../../utils/firstRunProgress.js';
import {
  buildLeaderboardResults,
  getLeaderboardCategoryValue,
  getLeaderboardPositionLabel,
  LEADERBOARD_CATEGORIES,
  LEADERBOARD_POSITION_ACCENTS,
} from '../../utils/leaderboard.js';
import '../../styles/public-pages.css';
import '../../styles/leaderboard.css';

const formatNumber = (value) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

function MemberAvatar({ member, position, compact = false }) {
  return <ProfileAvatar name={member.username} mark={member.avatarMark || 'initials'} className={`leaderboard-avatar${compact ? ' leaderboard-avatar--compact' : ''}${position ? ` leaderboard-avatar--place-${position}` : ''}`} />;
}

function PositionMark({ position }) {
  return <span className={`leaderboard-position leaderboard-position--${position >= 1 && position <= 3 ? position : 'standard'}`} aria-label={getLeaderboardPositionLabel(position)}>{position ? String(position).padStart(2, '0') : '—'}</span>;
}

function PodiumParticles({ place }) {
  return <span className={`leaderboard-podium__particles leaderboard-podium__particles--${place}`} aria-hidden="true">{Array.from({ length: place === 1 ? 14 : place === 2 ? 9 : 5 }, (_, index) => <i key={index} />)}</span>;
}

function PodiumCard({ member, slot, category, tied = false }) {
  const competitionRank = member.competitionRank;
  const visualPlace = tied && Number.isInteger(competitionRank) ? Math.min(competitionRank, 3) : slot;
  const rank = ranks.find((item) => item.slug === member.rankId);
  const accent = visualPlace === 1 ? LEADERBOARD_POSITION_ACCENTS.first
    : visualPlace === 2 ? LEADERBOARD_POSITION_ACCENTS.second
      : visualPlace === 3 ? LEADERBOARD_POSITION_ACCENTS.third : '#55CFFF';
  const placeName = tied ? `SHARED · RANK ${competitionRank}`
    : competitionRank === 1 ? 'CHAMPION' : competitionRank === 2 ? 'ELITE' : competitionRank === 3 ? 'DIAMOND' : `RANK ${competitionRank}`;

  return (
    <div className={`leaderboard-podium-slot leaderboard-podium-slot--place-${slot}`} style={{ '--place-accent': accent }}>
      <Link
        className={`leaderboard-podium leaderboard-podium--place-${visualPlace}${member.isCurrentMember ? ' is-current-member' : ''}`}
        to={`/app/profile/${encodeURIComponent(member.publicHandle || member.id)}`}
        aria-label={`${getLeaderboardPositionLabel(competitionRank)}${member.isCurrentMember ? ' current member' : ''}: ${member.username}, Rank ${member.rankNumber} ${member.rankName}. Open public profile.`}
      >
        <PodiumParticles place={competitionRank >= 1 && competitionRank <= 3 ? competitionRank : visualPlace} />
        <div className="leaderboard-podium__topline"><PositionMark position={competitionRank} /><span className="leaderboard-podium__place-name">{placeName}</span></div>
        <div className="leaderboard-podium__member"><MemberAvatar member={member} position={visualPlace} /><div><strong className="leaderboard-podium__name">{member.username}</strong><span className="leaderboard-podium__rank-label">Rank {member.rankNumber} · {member.rankName}</span>{member.isCurrentMember && <small className="leaderboard-podium__you">YOU</small>}</div></div>
        {rank && <span className="leaderboard-podium__rank-art"><RankBadge rank={rank} size="large" presentation="reference" /></span>}
        <div className="leaderboard-podium__stats"><span><small>LEVEL</small><b>{String(member.level).padStart(2, '0')}</b></span><span><small>{category === 'discipline' ? 'DISCIPLINE' : category === 'xp' ? 'TOTAL XP' : 'OVERALL'}</small><b>{getLeaderboardCategoryValue(member, category)}</b></span></div>
        <span className="leaderboard-podium__open">View public profile <AppIcon name="arrow" /></span>
      </Link>
    </div>
  );
}

function Podium({ members, category }) {
  const podiumOrder = members.slice(0, 3);
  if (!podiumOrder.length) return null;
  const hasTie = new Set(podiumOrder.map((member) => member.competitionRank)).size < podiumOrder.length;
  const heading = podiumOrder.length === 1 ? 'Top member' : podiumOrder.length === 2 ? 'Top two' : 'Top three';
  return (
    <section className="leaderboard-section" aria-labelledby="leaderboard-podium-heading">
      <div className="leaderboard-section__heading"><div><p className="app-eyebrow">CURRENT STANDINGS</p><h2 id="leaderboard-podium-heading">{heading}</h2></div><p>{hasTie ? 'Shared competition ranks are shown equally.' : 'Position treatments follow the selected ranking.'}</p></div>
      <div className={`leaderboard-podium-grid leaderboard-podium-grid--count-${podiumOrder.length}${hasTie ? ' leaderboard-podium-grid--tied' : ''}`}>
        {podiumOrder.map((member, index) => <PodiumCard key={member.publicHandle || member.id} member={member} slot={index + 1} category={category} tied={hasTie} />)}
      </div>
    </section>
  );
}

function MemberListRow({ member, category, compact = false }) {
  const rank = ranks.find((item) => item.slug === member.rankId);
  const position = member.competitionRank;
  const personalBestPosition = member.personalBestRecords?.[category]?.bestPosition;
  return (
    <Link
      className={`leaderboard-member${compact ? ' leaderboard-member--compact' : ''}${member.isCurrentMember ? ' is-current-member' : ''}`}
      to={`/app/profile/${encodeURIComponent(member.publicHandle || member.id)}`}
      aria-label={`${getLeaderboardPositionLabel(position)}: ${member.username}${member.isCurrentMember ? ', current member' : ''}, Rank ${member.rankNumber} ${member.rankName}, Level ${member.level}, ${formatNumber(member.totalXp)} XP. Open public profile.`}
    >
      <span className="leaderboard-member__identity"><PositionMark position={position} /><MemberAvatar member={member} compact /><span className="leaderboard-member__name-wrap"><strong className={`leaderboard-member__name${position <= 3 ? ` leaderboard-member__name--place-${position}` : ''}`}>{member.username}</strong>{member.isCurrentMember && <small className="leaderboard-member__you">YOU</small>}</span></span>
      <span className="leaderboard-member__rank">{rank && <RankBadge rank={rank} size="small" presentation="reference" />}<span className="leaderboard-member__rank-copy"><span>Rank {member.rankNumber} · {member.rankName}</span><small>Highest: {member.highestRankName}</small></span></span>
      <span className="leaderboard-member__metric"><small>LEVEL</small><b>{String(member.level).padStart(2, '0')}</b></span>
      <span className="leaderboard-member__metric"><small>TOTAL XP</small><b>{formatNumber(member.totalXp)}</b></span>
      <span className="leaderboard-member__metric"><small>STREAK</small><b>{member.currentDisciplineStreak} days</b></span>
      <span className="leaderboard-member__relevant"><small>{category === 'overall' ? 'OVERALL' : category === 'discipline' ? 'DISCIPLINE' : 'XP RANK'}</small><b>{getLeaderboardCategoryValue(member, category)}</b>{personalBestPosition && <em>PERSONAL BEST · #{personalBestPosition}</em>}</span>
      <AppIcon className="leaderboard-member__arrow" name="arrow" />
    </Link>
  );
}

function CurrentMemberSummary({ member, position, category, loading }) {
  if (loading) return <section className="leaderboard-current" aria-label="Loading your leaderboard position" aria-busy="true"><SkeletonLine width="long" label="Loading your position" /></section>;
  if (!member || !position) return null;
  const categoryLabel = LEADERBOARD_CATEGORIES.find((item) => item.id === category)?.label || 'Leaderboard';
  return (
    <section className="leaderboard-current" aria-labelledby="leaderboard-current-title">
      <div className="leaderboard-current__identity"><MemberAvatar member={member} compact /><div><p className="app-eyebrow">YOUR POSITION · {categoryLabel.toUpperCase()}</p><h2 id="leaderboard-current-title">Current position <span>#{position}</span></h2><p>{member.username} · Rank {member.rankNumber} — {member.rankName}</p></div></div>
      <dl className="leaderboard-current__stats"><div><dt>LEVEL</dt><dd>{String(member.level).padStart(2, '0')}</dd></div><div><dt>TOTAL XP</dt><dd>{formatNumber(member.totalXp)}</dd></div><div><dt>CURRENT DISCIPLINE STREAK</dt><dd>{member.currentDisciplineStreak} days</dd></div></dl>
    </section>
  );
}

export default function LeaderboardPage() {
  const [category, setCategory] = useState('overall');
  const [rankId, setRankId] = useState('all');
  const [query, setQuery] = useState('');
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    taskApi.leaderboard({ signal: controller.signal }).then((data) => {
      setSnapshot(data);
      updateFirstRunProgress({ leaderboardVisited: true });
    }).catch((requestError) => {
      if (requestError?.name !== 'AbortError') setError(requestError?.message || 'The leaderboard could not be loaded.');
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [refreshKey]);

  const members = snapshot?.categories?.[category] || [];
  const topMembers = buildLeaderboardResults(members).slice(0, 3);
  const visibleMembers = buildLeaderboardResults(members, { rankId, query });
  const currentPosition = snapshot?.currentPositions?.[category] ?? null;
  const handleCategoryKeyDown = (event, index) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const targetIndex = event.key === 'Home' ? 0 : event.key === 'End' ? LEADERBOARD_CATEGORIES.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + LEADERBOARD_CATEGORIES.length) % LEADERBOARD_CATEGORIES.length;
    const targetCategory = LEADERBOARD_CATEGORIES[targetIndex];
    setCategory(targetCategory.id);
    document.getElementById(`leaderboard-tab-${targetCategory.id}`)?.focus();
  };

  return (
    <div className="leaderboard-page">
      <header className="leaderboard-header">
        <div><p className="app-eyebrow">COMMUNITY · PROGRESSION</p><h1>Community Leaderboard</h1><p>Measure your progress. Recognize consistency. Rise through the ranks.</p></div>
        <span className="leaderboard-header__count"><AppIcon name="leaderboard" />{snapshot ? `${snapshot.memberCount} visible profiles` : loading ? <SkeletonLine width="short" label="Loading profiles" /> : 'Profiles unavailable'}</span>
      </header>

      <CurrentMemberSummary member={snapshot?.currentMember} position={currentPosition} category={category} loading={loading} />

      <section className="leaderboard-controls" aria-label="Leaderboard controls">
        <div className="leaderboard-tabs" role="tablist" aria-label="Leaderboard category">{LEADERBOARD_CATEGORIES.map((item, index) => <button key={item.id} type="button" role="tab" id={`leaderboard-tab-${item.id}`} aria-selected={category === item.id} aria-controls="leaderboard-results" tabIndex={category === item.id ? 0 : -1} onClick={() => setCategory(item.id)} onKeyDown={(event) => handleCategoryKeyDown(event, index)}>{item.label}</button>)}</div>
        <div className="leaderboard-filters">
          <label className="leaderboard-search"><span className="leaderboard-filter-label">Search members</span><span className="leaderboard-search__field"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></svg><input type="search" aria-label="Search members by username" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search usernames" /></span></label>
          <label className="leaderboard-rank-filter"><span className="leaderboard-filter-label">Filter by Rank</span><select aria-label="Filter members by Rank" value={rankId} onChange={(event) => setRankId(event.target.value)}><option value="all">All Ranks</option>{ranks.map((rank) => <option key={rank.slug} value={rank.slug}>Rank {rank.number} — {rank.name}</option>)}</select></label>
          {(rankId !== 'all' || query) && <button className="leaderboard-reset" type="button" onClick={() => { setRankId('all'); setQuery(''); }}>Reset filters</button>}
        </div>
      </section>

      <div id="leaderboard-results" role="tabpanel" aria-labelledby={`leaderboard-tab-${category}`}>
        {loading && <PageLoadingSkeleton variant="table" compact label="Loading leaderboard standings" />}
        {!loading && error && <div className="leaderboard-empty leaderboard-empty--error" role="alert"><h3>Leaderboard unavailable</h3><p>{error}</p><button type="button" onClick={() => setRefreshKey((value) => value + 1)}>Retry</button></div>}
        {!loading && !error && snapshot && <>
          <Podium members={topMembers} category={category} />
          <section className="leaderboard-section leaderboard-list-section" aria-labelledby="leaderboard-list-heading">
            <div className="leaderboard-section__heading"><div><p className="app-eyebrow">FULL STANDINGS</p><h2 id="leaderboard-list-heading">Ranked members</h2></div><p>{visibleMembers.length} {visibleMembers.length === 1 ? 'member' : 'members'} shown · Competition ranks retain the full category standings</p></div>
            {!members.length ? <div className="leaderboard-empty"><span aria-hidden="true">⌕</span><h3>No standings yet</h3><p>Community standings will appear here as members make progress.</p><button type="button" onClick={() => setRefreshKey((value) => value + 1)}>Refresh standings</button></div> : visibleMembers.length ? <>
              <div className="leaderboard-list leaderboard-list--desktop" role="list" aria-label="Ranked members"><div className="leaderboard-list__head" aria-hidden="true"><span>MEMBER</span><span>RANK · HIGHEST</span><span>LEVEL</span><span>TOTAL XP</span><span>STREAK</span><span>SELECTED CATEGORY</span><span /></div>{visibleMembers.map((member) => <div role="listitem" key={member.publicHandle}><MemberListRow member={member} category={category} /></div>)}</div>
              <div className="leaderboard-list leaderboard-list--mobile" role="list" aria-label="Ranked members">{visibleMembers.map((member) => <div role="listitem" key={member.publicHandle}><MemberListRow member={member} category={category} compact /></div>)}</div>
            </> : <div className="leaderboard-empty"><span aria-hidden="true">⌕</span><h3>No members found</h3><p>Try another username or reset the Rank filter.</p><button type="button" onClick={() => { setRankId('all'); setQuery(''); }}>Reset filters</button></div>}
          </section>
        </>}
      </div>

      <div className="leaderboard-page__footer-actions"><p className="leaderboard-footnote">Positions are descriptive only. THE SYSTEM does not award XP, Discipline Points or Rank benefits for leaderboard placement.</p>{!loading && !error && <button type="button" className="leaderboard-reset" onClick={() => setRefreshKey((value) => value + 1)}>Refresh standings</button>}</div>
    </div>
  );
}
