import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getActivityQualificationLabel, getRollingActivityDates, getVisibleActivityRecord, shouldShowHistoricalResetWarning } from '../../utils/disciplineActivity.js';
import { getIstDateKey } from '../../utils/taskScheduleBuilder.js';
import AppIcon from './AppIcon.jsx';
import PageLoadingSkeleton from './PageLoadingSkeleton.jsx';
import { Link } from 'react-router-dom';

function monthLabel(dateKey) {
  return new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(`${dateKey}T12:00:00Z`));
}

function weekdayOffset(dateKey) {
  const weekday = new Intl.DateTimeFormat('en', { weekday: 'long', timeZone: 'Asia/Kolkata' }).format(new Date(`${dateKey}T12:00:00Z`));
  return (['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].indexOf(weekday));
}

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function getIntensity(record) {
  if (!record?.completedTaskCount) return 0;
  if (record.completedTaskCount <= 2) return 1;
  if (record.completedTaskCount === 3) return 2;
  if (record.completedTaskCount === 4) return 3;
  return 4;
}

function formatLongDate(dateKey) {
  return new Intl.DateTimeFormat('en', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })
    .format(new Date(`${dateKey}T12:00:00Z`));
}

function overlapArea(first, second) {
  if (!first || !second) return 0;
  const width = Math.max(0, Math.min(first.right, second.right) - Math.max(first.left, second.left));
  const height = Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top));
  return width * height;
}

function placeTooltip(anchor, tooltip) {
  if (!anchor || !tooltip) return null;
  const anchorRect = anchor.getBoundingClientRect();
  const monthRect = anchor.closest('.discipline-activity__month')?.getBoundingClientRect() || anchorRect;
  const mapRect = anchor.closest('.discipline-activity__map')?.getBoundingClientRect() || monthRect;
  const tipRect = tooltip.getBoundingClientRect();
  const margin = 12;
  const gap = 12;
  const centeredTop = anchorRect.top + anchorRect.height / 2 - tipRect.height / 2;
  const centeredLeft = anchorRect.left + anchorRect.width / 2 - tipRect.width / 2;
  const options = [
    { left: monthRect.right + gap, top: centeredTop },
    { left: monthRect.left - tipRect.width - gap, top: centeredTop },
    { left: centeredLeft, top: monthRect.top - tipRect.height - gap },
    { left: centeredLeft, top: monthRect.bottom + gap },
  ];
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const score = (point) => {
    const right = point.left + tipRect.width;
    const bottom = point.top + tipRect.height;
    const overflow = Math.max(0, margin - point.left) + Math.max(0, right - viewportWidth + margin)
      + Math.max(0, margin - point.top) + Math.max(0, bottom - viewportHeight + margin);
    const box = { left: point.left, right, top: point.top, bottom };
    return overflow * 10000 + overlapArea(box, monthRect) * 5 + overlapArea(box, mapRect);
  };
  const chosen = options.reduce((best, option) => score(option) < score(best) ? option : best, options[0]);
  return {
    left: Math.min(Math.max(margin, chosen.left), Math.max(margin, viewportWidth - tipRect.width - margin)),
    top: Math.min(Math.max(margin, chosen.top), Math.max(margin, viewportHeight - tipRect.height - margin)),
  };
}

function ActivityTooltip({ dateKey, record, todayKey, position, tooltipRef, qualificationLabel }) {
  if (!record) return null;
  const qualification = qualificationLabel || getActivityQualificationLabel(record, dateKey, todayKey);
  const hasReset = record.hasDailyResetRecord !== false;
  const xpDetailsKnown = typeof record.xpDrained === 'number' || typeof record.dailyRankXpAwarded === 'number';
  const xpChanges = [];
  if (record.xpDrained > 0) xpChanges.push(`−${record.xpDrained.toFixed(2)} XP drained`);
  if (record.dailyRankXpAwarded > 0) xpChanges.push(`+${record.dailyRankXpAwarded} Rank XP`);

  return createPortal(
    <aside
      ref={tooltipRef}
      id="discipline-activity-tooltip"
      className="discipline-activity-tooltip"
      role="tooltip"
      data-status={qualification.toLowerCase().replaceAll(' ', '-')}
      style={position ? { left: `${position.left}px`, top: `${position.top}px` } : undefined}
      aria-hidden={!position}
    >
      <div className="discipline-activity-tooltip__header">
        <time>{formatLongDate(dateKey)}</time>
        <strong>{qualification}</strong>
      </div>
      <div className="discipline-activity-tooltip__metrics">
        <span><strong>{record.scheduledTaskCount}</strong> scheduled</span>
        <span><strong>{record.completedTaskCount}</strong> completed</span>
        <span><strong>{record.completionPercent}%</strong> complete</span>
      </div>
      <div className="discipline-activity-tooltip__rows">
        <p><span>Discipline</span><strong>{qualification}</strong></p>
        <p><span>Emergency Pause</span><strong>{record.emergencyPause ? 'Protected' : 'Not active'}</strong></p>
        <p><span>XP</span><strong>{xpChanges.length ? xpChanges.join(' · ') : !hasReset ? 'Reset processing pending' : xpDetailsKnown ? 'No XP change recorded' : 'XP details unavailable'}</strong></p>
      </div>
    </aside>,
    document.body,
  );
}

export default function DisciplineActivityMap({ disciplineState, schedule, emergencyPauseState, compact = false, serverRecords = null, serverToday = null, memberSince: memberSinceProp, activityLoading = false, activityError = '', onRetryActivity }) {
  const todayKey = getIstDateKey();
  const dateKeys = useMemo(() => getRollingActivityDates(todayKey, 365), [todayKey]);
  const groupedMonths = useMemo(() => {
    const groups = [];
    dateKeys.forEach((dateKey) => {
      const label = monthLabel(dateKey);
      let group = groups.at(-1);
      if (!group || group.label !== label) {
        group = { label, dates: [] };
        groups.push(group);
      }
      group.dates.push(dateKey);
    });
    return groups;
  }, [dateKeys]);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [tooltipDate, setTooltipDate] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState(null);
  const tooltipRef = useRef(null);
  const tooltipAnchorRef = useRef(null);
  const serverMode = Array.isArray(serverRecords);
  const memberSince = memberSinceProp || disciplineState.memberSince || todayKey;
  const serverRecordByDate = useMemo(() => new Map((serverRecords || []).map((record) => [record.date, record])), [serverRecords]);
  const getRecord = (dateKey) => {
    if (!serverMode) return getVisibleActivityRecord({ dateKey, disciplineState, schedule, todayKey, emergencyPauseDates: disciplineState.emergencyPauseDates || [], emergencyPauseState });
    if (dateKey < memberSince || dateKey > todayKey) return null;
    const row = serverRecordByDate.get(dateKey);
    if (row) return {
      ...row,
      scheduledTaskCount: row.scheduledTaskCount ?? row.scheduledOriginalTaskCount ?? 0,
      completedTaskCount: row.completedTaskCount ?? row.completedOriginalTaskCount ?? 0,
      completionPercent: row.completionPercent ?? 0,
      emergencyPause: Boolean(row.emergencyPause ?? row.protectedByEmergencyPause),
      hasDailyResetRecord: true,
      xpDrained: row.xpDrained ?? null,
      dailyRankXpAwarded: row.dailyRankXpAwarded ?? null,
      dpRewardAwarded: row.dpRewardAwarded ?? null,
    };
    if (dateKey === todayKey && serverToday) return {
      date: dateKey,
      scheduledTaskCount: serverToday.scheduledTaskCount ?? serverToday.scheduledOriginalTaskCount ?? 0,
      completedTaskCount: serverToday.completedTaskCount ?? serverToday.completedOriginalTaskCount ?? 0,
      completionPercent: serverToday.scheduledTaskCount
        ? Math.round((serverToday.completedTaskCount / serverToday.scheduledTaskCount) * 100)
        : serverToday.scheduledOriginalTaskCount
          ? Math.round((serverToday.completedOriginalTaskCount / serverToday.scheduledOriginalTaskCount) * 100)
          : 0,
      qualificationStatus: serverToday.qualificationStatus || serverToday.status || 'in-progress',
      emergencyPause: Boolean(serverToday.emergencyPause ?? serverToday.emergencyPauseProtected),
      qualifies: serverToday.qualificationStatus === 'qualified' || serverToday.status === 'qualified',
      hasDailyResetRecord: Boolean(serverToday.finalizedAt),
      xpDrained: null,
      dailyRankXpAwarded: null,
      dpRewardAwarded: null,
    };
    return { date: dateKey, scheduledTaskCount: 0, completedTaskCount: 0, completionPercent: 0, qualificationStatus: 'unrecorded', emergencyPause: false, hasDailyResetRecord: false, xpDrained: null, dailyRankXpAwarded: null, dpRewardAwarded: null };
  };
  const qualificationFor = (record, dateKey) => {
    if (dateKey < memberSince) return 'Before Member Since';
    if (record?.emergencyPause || record?.qualificationStatus === 'emergency-pause-protected') return 'Protected';
    if (record?.qualificationStatus === 'qualified' || record?.qualifies) return 'Qualified';
    if (record?.qualificationStatus === 'not-qualified') return 'Not qualified';
    if (dateKey === todayKey && (record?.qualificationStatus === 'in-progress' || record?.qualificationStatus === 'emergency-pause-protected')) return record?.emergencyPause ? 'Protected' : 'In Progress';
    return serverMode ? 'No finalized record' : getActivityQualificationLabel(record, dateKey, todayKey);
  };
  const selectedRecord = getRecord(selectedDate);
  const tooltipRecord = tooltipDate ? getRecord(tooltipDate) : null;
  const selectedQualification = qualificationFor(selectedRecord, selectedDate);
  const activityDays = serverMode
    ? (serverRecords || []).filter((record) => (record.completedTaskCount ?? record.completedOriginalTaskCount ?? 0) > 0).length
    : Object.values(disciplineState.dailyRecords).filter((record) => record.completedTaskCount > 0).length;
  const hasActivityData = serverMode
    ? Boolean(serverRecords?.length || serverToday)
    : Object.keys(disciplineState.dailyRecords || {}).length > 0;

  const updateTooltipPosition = () => {
    const next = placeTooltip(tooltipAnchorRef.current, tooltipRef.current);
    if (next) setTooltipPosition(next);
  };

  useLayoutEffect(() => {
    if (!tooltipDate) {
      setTooltipPosition(null);
      return;
    }
    updateTooltipPosition();
  }, [tooltipDate]);

  useEffect(() => {
    if (!tooltipDate) return undefined;
    let frame = 0;
    const handleViewportChange = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(updateTooltipPosition);
    };
    window.addEventListener('resize', handleViewportChange);
    document.addEventListener('scroll', handleViewportChange, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', handleViewportChange);
      document.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [tooltipDate]);

  useEffect(() => {
    if (tooltipDate && !dateKeys.includes(tooltipDate)) setTooltipDate(null);
  }, [dateKeys, tooltipDate]);

  const showTooltip = (dateKey, anchor) => {
    tooltipAnchorRef.current = anchor;
    setTooltipDate(dateKey);
  };

  const hideTooltip = (dateKey) => {
    setTooltipDate((current) => current === dateKey ? null : current);
  };

  return <>
    <section className={`discipline-activity app-panel${compact ? ' discipline-activity--compact' : ''}`} aria-labelledby={compact ? undefined : 'discipline-activity-title'}>
      <div className="discipline-activity__header">
        <div><p className="app-eyebrow">365-DAY ACTIVITY RECORD</p><h2 id={compact ? undefined : 'discipline-activity-title'}>Discipline map</h2></div>
        {!compact && <span className="discipline-activity__summary">{activityDays} recorded days with completed tasks</span>}
      </div>
      <p className="discipline-activity__intro">Each square represents one IST calendar day. Select a day to inspect scheduled work, completion and rewards.</p>
      {activityLoading ? <PageLoadingSkeleton variant="rows" compact label="Loading your activity record" />
        : activityError ? <div className="discipline-activity__state" role="alert"><AppIcon name="activity" /><div><strong>Your activity record could not be loaded.</strong><p>{activityError}</p></div>{onRetryActivity && <button className="button button--secondary" type="button" onClick={onRetryActivity}>Retry</button>}</div>
          : !hasActivityData ? <div className="discipline-activity__state"><AppIcon name="activity" /><div><strong>No activity yet</strong><p>Complete a Task today to start your 365-day record.</p></div><Link className="button button--secondary" to="/app/tasks">Open today’s Tasks</Link></div>
            : <>
      <div className="discipline-activity__map" role="group" aria-label="Last 365 calendar days of scheduled task activity">
        {groupedMonths.map((month) => (
          <div className="discipline-activity__month" key={`${month.label}-${month.dates[0]}`}>
            <h3>{month.label}</h3>
            <div className="discipline-activity__weekdays" aria-hidden="true">
              {WEEKDAY_LABELS.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}
            </div>
            <div className="discipline-activity__cells">
              {Array.from({ length: weekdayOffset(month.dates[0]) }, (_, index) => <span className="discipline-activity__empty-cell" key={`offset-${index}`} aria-hidden="true" />)}
              {month.dates.map((dateKey) => {
                const record = getRecord(dateKey);
                const intensity = getIntensity(record);
                const isSelected = selectedDate === dateKey;
                const qualification = qualificationFor(record, dateKey);
                const accessibleDescription = record
                  ? `${formatLongDate(dateKey)}: ${record.completedTaskCount} of ${record.scheduledTaskCount} scheduled tasks completed, ${record.completionPercent} percent. ${qualification}. ${record.emergencyPause ? 'Emergency Pause protected.' : 'Emergency Pause not active.'}`
                  : `${formatLongDate(dateKey)}: before Member Since. No activity record is available.`;
                return <button
                  key={dateKey}
                  className={`discipline-activity__cell${isSelected ? ' is-selected' : ''}${dateKey < memberSince ? ' is-before-member' : ''}`}
                  type="button"
                  data-level={intensity}
                  aria-label={accessibleDescription}
                  aria-describedby={tooltipDate === dateKey ? 'discipline-activity-tooltip' : undefined}
                  aria-pressed={isSelected}
                  disabled={dateKey < memberSince}
                  onClick={() => setSelectedDate(dateKey)}
                  onPointerEnter={(event) => { if (event.pointerType !== 'touch') showTooltip(dateKey, event.currentTarget); }}
                  onPointerLeave={() => hideTooltip(dateKey)}
                  onFocus={(event) => showTooltip(dateKey, event.currentTarget)}
                  onBlur={() => hideTooltip(dateKey)}
                />;
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="discipline-activity__legend" role="img" aria-label="Activity intensity: 0, 1 to 2, 3, 4, and 5 or more completed tasks. Hatched cells are before Member Since.">
        {['0', '1–2', '3', '4', '5+'].map((label, level) => <span className="discipline-activity__legend-item" key={label}><i data-level={level} aria-hidden="true" />{label}</span>)}
        <span className="discipline-activity__legend-item discipline-activity__legend-item--before"><i aria-hidden="true" />Before Member Since</span>
      </div>
      <aside className="discipline-activity__detail" aria-live="polite">
        <div className="discipline-activity__detail-date"><AppIcon name="clock" /><strong>{formatLongDate(selectedDate)}</strong></div>
        {selectedRecord ? <>
          <div className="discipline-activity__detail-metrics">
            <span><strong>{selectedRecord.scheduledTaskCount}</strong> scheduled</span>
            <span><strong>{selectedRecord.completedTaskCount}</strong> completed</span>
            <span><strong>{selectedRecord.completionPercent}%</strong> completion</span>
            <span><strong>{selectedQualification}</strong> Discipline day</span>
          </div>
          <div className="discipline-activity__detail-meta">
            <span>{selectedRecord.emergencyPause ? 'Emergency Pause protected' : 'No Emergency Pause record'}</span>
            {selectedRecord.xpDrained > 0 && <span>−{selectedRecord.xpDrained.toFixed(2)} XP drained</span>}
            {selectedRecord.dailyRankXpAwarded > 0 && <span>+{selectedRecord.dailyRankXpAwarded} Rank XP</span>}
            {selectedRecord.dpRewardAwarded > 0 && <span>+{selectedRecord.dpRewardAwarded.toFixed(2)} DP</span>}
            {shouldShowHistoricalResetWarning(selectedRecord, selectedDate, todayKey) && <span>No finalized Discipline record</span>}
            {selectedRecord.hasDailyResetRecord !== false && typeof selectedRecord.xpDrained === 'number' && selectedRecord.xpDrained === 0 && typeof selectedRecord.dailyRankXpAwarded === 'number' && selectedRecord.dailyRankXpAwarded === 0 && <span>No XP change recorded</span>}
            {selectedRecord.hasDailyResetRecord !== false && typeof selectedRecord.xpDrained !== 'number' && typeof selectedRecord.dailyRankXpAwarded !== 'number' && <span>XP details unavailable</span>}
          </div>
        </> : <p className="discipline-activity__before-member">This day is before the permanent Member Since date.</p>}
      </aside>
            </>}
    </section>
    {tooltipDate && tooltipRecord && <ActivityTooltip dateKey={tooltipDate} record={tooltipRecord} todayKey={todayKey} position={tooltipPosition} tooltipRef={tooltipRef} qualificationLabel={qualificationFor(tooltipRecord, tooltipDate)} />}
  </>;
}
