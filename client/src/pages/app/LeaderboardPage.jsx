import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardDemo } from '../../data/dashboardDemo.js';
import { leaderboardDemoMembers } from '../../data/leaderboardDemo.js';
import { ranks } from '../../data/ranks.js';
import { useTaskSchedule } from '../../context/TaskScheduleContext.jsx';
import RankBadge from '../../components/ranks/RankBadge.jsx';
import AppIcon from '../../components/app/AppIcon.jsx';
import ProfileAvatar from '../../components/app/MemberAvatar.jsx';
import useCurrentMemberPersonalBest from '../../hooks/useCurrentMemberPersonalBest.js';
import { useUserPreferences } from '../../context/UserPreferencesContext.jsx';
import {
  buildLeaderboardResults,
  createCurrentMemberEntry,
  getLeaderboardCategoryValue,
  getLeaderboardPositionLabel,
  LEADERBOARD_CATEGORIES,
  LEADERBOARD_POSITION_ACCENTS,
  mergeLeaderboardMembers,
} from '../../utils/leaderboard.js';
import '../../styles/public-pages.css';
import '../../styles/leaderboard.css';

const formatNumber = (value) => Number(value || 0).toLocaleString('en-IN');

function MemberAvatar({ member, position, compact = false }) {
  return (
    <ProfileAvatar name={member.displayName} mark={member.isCurrentMember ? member.avatarMark : 'initials'} className={`leaderboard-avatar${compact ? ' leaderboard-avatar--compact' : ''}${position ? ` leaderboard-avatar--place-${position}` : ''}`} />
  );
}

function PositionMark({ position }) {
  return (
    <span className={`leaderboard-position leaderboard-position--${position <= 3 ? position : 'standard'}`} aria-label={getLeaderboardPositionLabel(position)}>
      {String(position).padStart(2, '0')}
    </span>
  );
}

function PodiumParticles({ place }) {
  return (
    <span className={`leaderboard-podium__particles leaderboard-podium__particles--${place}`} aria-hidden="true">
      {Array.from({ length: place === 1 ? 14 : place === 2 ? 9 : 5 }, (_, index) => (
        <i key={index} />
      ))}
    </span>
  );
}

function PodiumCard({ member, position, category }) {
  const place = position;
  const rank = ranks.find((item) => item.slug === member.rankId);
  const accent = place === 1
    ? LEADERBOARD_POSITION_ACCENTS.first
    : place === 2
      ? LEADERBOARD_POSITION_ACCENTS.second
      : LEADERBOARD_POSITION_ACCENTS.third;

  const positionName = place === 1 ? 'Champion' : place === 2 ? 'Elite' : 'Diamond';
  const personalBestPosition = member.personalBestRecords?.[category]?.bestPosition;

  return (
    <div className={`leaderboard-podium-slot leaderboard-podium-slot--place-${place}`} style={{ '--place-accent': accent }}>
      <Link
        className={`leaderboard-podium leaderboard-podium--place-${place}${member.isCurrentMember ? ' is-current-member' : ''}`}
        to={`/app/profile/${encodeURIComponent(member.id)}`}
        aria-label={`${getLeaderboardPositionLabel(place)} ${positionName}: ${member.displayName}, Rank ${member.rankNumber} ${member.rankName}. Select to open public profile.`}
      >
        <PodiumParticles place={place} />
        <div className="leaderboard-podium__topline">
          <PositionMark position={place} />
          <span className="leaderboard-podium__place-name">{place === 1 ? 'CHAMPION' : place === 2 ? 'ELITE' : 'DIAMOND'}</span>
        </div>
        <div className="leaderboard-podium__member">
          <MemberAvatar member={member} position={place} />
          <div><strong className="leaderboard-podium__name">{member.displayName}</strong><span className="leaderboard-podium__rank-label">Rank {member.rankNumber} · {member.rankName}</span>{member.isCurrentMember && <small className="leaderboard-podium__you">YOU</small>}</div>
        </div>
        {rank && <span className="leaderboard-podium__rank-art"><RankBadge rank={rank} size="large" presentation="reference" /></span>}
        <div className="leaderboard-podium__stats">
          <span><small>LEVEL</small><b>{String(member.level).padStart(2, '0')}</b></span>
          <span><small>{category === 'discipline' ? 'DISCIPLINE' : category === 'xp' ? 'TOTAL XP' : 'OVERALL'}</small><b>{getLeaderboardCategoryValue(member, category)}</b></span>
        </div>
        {personalBestPosition && <small className="leaderboard-podium__personal-best">PERSONAL BEST · #{personalBestPosition}</small>}
        <span className="leaderboard-podium__open">View public profile <AppIcon name="arrow" /></span>
      </Link>
    </div>
  );
}

function Podium({ members, category }) {
  const podiumOrder = members.slice(0, 3);
  if (!podiumOrder.length) return null;
  return (
    <section className="leaderboard-section" aria-labelledby="leaderboard-podium-heading">
      <div className="leaderboard-section__heading">
        <div><p className="app-eyebrow">CURRENT STANDINGS</p><h2 id="leaderboard-podium-heading">Top three</h2></div>
        <p>Position treatments follow the selected ranking.</p>
      </div>
      <div className={`leaderboard-podium-grid leaderboard-podium-grid--count-${podiumOrder.length}`}>
        {podiumOrder.map((member, index) => <PodiumCard key={member.id} member={member} position={index + 1} category={category} />)}
      </div>
    </section>
  );
}

function MemberListRow({ member, category, compact = false }) {
  const rank = ranks.find((item) => item.slug === member.rankId);
  const position = member.position;
  const currentLabel = member.isCurrentMember ? ' · You' : '';
  const personalBestPosition = member.personalBestRecords?.[category]?.bestPosition;
  return (
    <Link
      className={`leaderboard-member${compact ? ' leaderboard-member--compact' : ''}${member.isCurrentMember ? ' is-current-member' : ''}`}
      to={`/app/profile/${encodeURIComponent(member.id)}`}
      aria-label={`Position ${position}: ${member.displayName}${currentLabel}, Rank ${member.rankNumber} ${member.rankName}, highest achieved Rank ${member.highestRankNumber} ${member.highestRankName}, Level ${member.level}, ${formatNumber(member.totalXp)} XP. Open public profile.`}
    >
      <span className="leaderboard-member__identity">
        <PositionMark position={position} />
        <MemberAvatar member={member} compact />
        <span className="leaderboard-member__name-wrap">
          <strong className={`leaderboard-member__name${position <= 3 ? ` leaderboard-member__name--place-${position}` : ''}`}>{member.displayName}</strong>
          {member.isCurrentMember && <small className="leaderboard-member__you">CURRENT MEMBER</small>}
        </span>
      </span>
      <span className="leaderboard-member__rank">{rank && <RankBadge rank={rank} size="small" presentation="reference" />}<span className="leaderboard-member__rank-copy"><span>Rank {member.rankNumber} · {member.rankName}</span><small>Highest: {member.highestRankName}</small></span></span>
      <span className="leaderboard-member__metric"><small>LEVEL</small><b>{String(member.level).padStart(2, '0')}</b></span>
      <span className="leaderboard-member__metric"><small>TOTAL XP</small><b>{formatNumber(member.totalXp)}</b></span>
      <span className="leaderboard-member__metric"><small>STREAK</small><b>{member.currentDisciplineStreak} days</b></span>
      <span className="leaderboard-member__relevant"><small>{category === 'overall' ? 'OVERALL' : category === 'discipline' ? 'DISCIPLINE' : 'XP RANK'}</small><b>{getLeaderboardCategoryValue(member, category)}</b>{personalBestPosition && <em>PERSONAL BEST · #{personalBestPosition}</em>}</span>
      <AppIcon className="leaderboard-member__arrow" name="arrow" />
    </Link>
  );
}

function CurrentMemberSummary({ member, overallPosition }) {
  if (!member || !overallPosition) {
    return <section className="leaderboard-current leaderboard-current--unavailable" aria-labelledby="leaderboard-current-title"><div><p className="app-eyebrow">YOUR POSITION</p><h2 id="leaderboard-current-title">Current member position unavailable</h2><p>A shared member identity and progression record are not available in this session.</p></div></section>;
  }
  return (
    <section className="leaderboard-current" aria-labelledby="leaderboard-current-title">
      <div className="leaderboard-current__identity">
        <MemberAvatar member={member} compact />
        <div><p className="app-eyebrow">YOUR POSITION</p><h2 id="leaderboard-current-title">Overall position <span>#{overallPosition}</span></h2><p>{member.displayName} · Rank {member.rankNumber} — {member.rankName}</p></div>
      </div>
      <dl className="leaderboard-current__stats">
        <div><dt>LEVEL</dt><dd>{String(member.level).padStart(2, '0')}</dd></div>
        <div><dt>TOTAL XP</dt><dd>{formatNumber(member.totalXp)}</dd></div>
        <div><dt>CURRENT DISCIPLINE STREAK</dt><dd>{member.currentDisciplineStreak} days</dd></div>
      </dl>
    </section>
  );
}

export default function LeaderboardPage() {
  const { disciplineState } = useTaskSchedule();
  const { preferences } = useUserPreferences();
  const [category, setCategory] = useState('overall');
  const [rankId, setRankId] = useState('all');
  const [query, setQuery] = useState('');
  const identity = useMemo(() => ({ ...dashboardDemo.member, ...preferences.profile }), [preferences.profile]);
  const currentMember = useMemo(() => createCurrentMemberEntry(identity, disciplineState), [identity, disciplineState]);
  const members = useMemo(() => mergeLeaderboardMembers(leaderboardDemoMembers, currentMember), [currentMember]);
  const currentMemberBestRecord = useCurrentMemberPersonalBest(currentMember, members);
  const membersWithRecords = useMemo(() => members.map((member) => member.isCurrentMember
    ? {
      ...member,
      personalBestRecords: currentMemberBestRecord,
      highestRankId: currentMemberBestRecord?.highestRankAchieved?.rankSlug || member.highestRankId,
      highestRankName: currentMemberBestRecord?.highestRankAchieved?.rankName || member.highestRankName,
      highestRankNumber: currentMemberBestRecord?.highestRankAchieved?.rankNumber || member.highestRankNumber,
    }
    : member), [members, currentMemberBestRecord]);
  const visibleMembers = useMemo(() => buildLeaderboardResults(membersWithRecords, { category, rankId, query }), [membersWithRecords, category, rankId, query]);
  const overallResults = useMemo(() => buildLeaderboardResults(membersWithRecords, { category: 'overall' }), [membersWithRecords]);
  const currentOverallPosition = currentMember ? overallResults.find((member) => member.id === currentMember.id)?.position : null;
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
        <span className="leaderboard-header__count"><AppIcon name="leaderboard" />{members.length} visible profiles</span>
      </header>

      <aside className="leaderboard-disclosure" role="note">
        <span className="leaderboard-disclosure__mark" aria-hidden="true">i</span>
        <p><strong>Demonstration data.</strong> The {leaderboardDemoMembers.length} fictional profiles are stable examples, not verified community members. Your entry and Personal Best Records use this browser session’s shared progression state; permanent account storage and live leaderboard synchronization are not connected.</p>
      </aside>

      <CurrentMemberSummary member={currentMember} overallPosition={currentOverallPosition} />

      <section className="leaderboard-controls" aria-label="Leaderboard controls">
        <div className="leaderboard-tabs" role="tablist" aria-label="Leaderboard category">
          {LEADERBOARD_CATEGORIES.map((item, index) => (
            <button key={item.id} type="button" role="tab" id={`leaderboard-tab-${item.id}`} aria-selected={category === item.id} aria-controls="leaderboard-results" tabIndex={category === item.id ? 0 : -1} onClick={() => setCategory(item.id)} onKeyDown={(event) => handleCategoryKeyDown(event, index)}>
              {item.label}
            </button>
          ))}
        </div>
        <div className="leaderboard-filters">
          <label className="leaderboard-search"><span className="leaderboard-filter-label">Search members</span><span className="leaderboard-search__field"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></svg><input type="search" aria-label="Search members by public display name" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name" /></span></label>
          <label className="leaderboard-rank-filter"><span className="leaderboard-filter-label">Filter by Rank</span><select aria-label="Filter members by Rank" value={rankId} onChange={(event) => setRankId(event.target.value)}><option value="all">All Ranks</option>{ranks.map((rank) => <option key={rank.slug} value={rank.slug}>Rank {rank.number} — {rank.name}</option>)}</select></label>
          {(rankId !== 'all' || query) && <button className="leaderboard-reset" type="button" onClick={() => { setRankId('all'); setQuery(''); }}>Reset filters</button>}
        </div>
      </section>

      <div id="leaderboard-results" role="tabpanel" aria-labelledby={`leaderboard-tab-${category}`}>
        <Podium members={visibleMembers} category={category} />
        <section className="leaderboard-section leaderboard-list-section" aria-labelledby="leaderboard-list-heading">
          <div className="leaderboard-section__heading"><div><p className="app-eyebrow">FULL STANDINGS</p><h2 id="leaderboard-list-heading">Ranked members</h2></div><p>{visibleMembers.length} {visibleMembers.length === 1 ? 'member' : 'members'} shown · Positions recalculate with filters</p></div>
          {visibleMembers.length ? (
            <>
              <div className="leaderboard-list leaderboard-list--desktop" role="list" aria-label="Ranked members">
                <div className="leaderboard-list__head" aria-hidden="true"><span>MEMBER</span><span>RANK · HIGHEST</span><span>LEVEL</span><span>TOTAL XP</span><span>STREAK</span><span>SELECTED CATEGORY</span><span /></div>
                {visibleMembers.map((member) => <div role="listitem" key={member.id}><MemberListRow member={member} category={category} /></div>)}
              </div>
              <div className="leaderboard-list leaderboard-list--mobile" role="list" aria-label="Ranked members">
                {visibleMembers.map((member) => <div role="listitem" key={member.id}><MemberListRow member={member} category={category} compact /></div>)}
              </div>
            </>
          ) : (
            <div className="leaderboard-empty"><span aria-hidden="true">⌕</span><h3>No members found</h3><p>Try another display name or reset the Rank filter.</p><button type="button" onClick={() => { setRankId('all'); setQuery(''); }}>Reset filters</button></div>
          )}
        </section>
      </div>

      <p className="leaderboard-footnote">Positions are descriptive only. THE SYSTEM does not award XP, Discipline Points or Rank benefits for leaderboard placement.</p>
    </div>
  );
}
