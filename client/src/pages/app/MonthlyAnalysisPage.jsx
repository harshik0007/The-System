import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../../components/app/AppIcon.jsx';
import { dashboardDemo } from '../../data/dashboardDemo.js';
import { useTaskSchedule } from '../../context/TaskScheduleContext.jsx';
import { RANK_DISCIPLINE_CONFIG } from '../../data/disciplineConfig.js';
import { getIstDateKey } from '../../utils/taskScheduleBuilder.js';
import { buildEmergencyPauseMonthlyStats, formatDateKey, formatMonthLabel, getEmergencyPauseRecordKey, getIstMonthKey } from '../../utils/monthlyAnalysis.js';
import { getEmergencyPauseDatesForRecord, getUniqueEmergencyPauseRecords } from '../../utils/emergencyPauseManager.js';
import { RECOVERY_STATUS } from '../../utils/recoveryQuestManager.js';
import '../../styles/monthly-analysis.css';

const valueOrUnavailable = (value, suffix = '') => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? 'Data unavailable' : `${Number(value).toLocaleString('en-IN')}${suffix}`;
const decimal = (value) => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? 'Data unavailable' : Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const signed = (value) => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? 'Data unavailable' : `${Number(value) > 0 ? '+' : ''}${decimal(value)}`;
const chartNumber = (value) => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
const statusName = (status) => ({ [RECOVERY_STATUS.ACTIVE]: 'Active', [RECOVERY_STATUS.COMPLETED]: 'Completed', [RECOVERY_STATUS.EXPIRED]: 'Individually expired', [RECOVERY_STATUS.THRESHOLD_CLEARED]: 'Threshold-cleared' }[status] || 'Status unavailable');
const currencyDate = (value) => value ? formatDateKey(value) : 'Data unavailable';
const pluralCount = (count, singular, plural = `${singular}s`) => `${count} ${Number(count) === 1 ? singular : plural}`;
const rowsForIds = (items, ids) => {
  const wanted = new Set(ids || []);
  return (items || []).filter((item) => wanted.has(item.id));
};
const istDateTime = (value) => {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp)) : 'Data unavailable';
};
const dayDistance = (from, to) => Math.max(0, Math.floor((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000));

function emergencyPauseRows(state, ids) {
  const wanted = new Set(ids || []);
  return getUniqueEmergencyPauseRecords(state).filter((pause) => wanted.has(getEmergencyPauseRecordKey(pause)))
    .sort((a, b) => Date.parse(a.startAt || 0) - Date.parse(b.startAt || 0));
}

function pauseElapsedDuration(pause, now = Date.now()) {
  const start = Date.parse(pause?.startAt);
  if (!Number.isFinite(start)) return 'Data unavailable';
  let end = Date.parse(pause?.actualResumeAt);
  if (!Number.isFinite(end)) {
    const scheduledEnd = Date.parse(pause?.scheduledResumeAt);
    if (pause?.status !== 'active' || !Number.isFinite(scheduledEnd) || now >= scheduledEnd) return 'Data unavailable';
    end = now;
  }
  if (end < start) return 'Data unavailable';
  const minutes = Math.floor((end - start) / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const remainder = minutes % 60;
  return [days ? `${days}d` : null, hours ? `${hours}h` : null, `${remainder}m`].filter(Boolean).join(' ');
}

function pauseProtectedDateAttribution(pause, rangeStart, rangeEnd) {
  const allDates = getEmergencyPauseDatesForRecord(pause);
  const dates = allDates.filter((date) => (!rangeStart || date >= rangeStart) && (!rangeEnd || date <= rangeEnd));
  if (!dates.length) return allDates.length ? 'No protected IST dates in this period' : 'Data unavailable';
  const months = new Map();
  dates.forEach((date) => months.set(date.slice(0, 7), [...(months.get(date.slice(0, 7)) || []), formatDateKey(date)]));
  return [...months].map(([month, monthDates]) => `${formatMonthLabel(month)}: ${monthDates.join(', ')}`).join(' · ');
}

function pauseResumeLabel(pause) {
  if (pause?.resumeReason === 'manual' || pause?.status === 'resumed-early') return 'Early';
  if (pause?.resumeReason === 'automatic' || pause?.status === 'automatically-resumed') return 'Automatic';
  if (pause?.status === 'active') return 'Active';
  return 'Data unavailable';
}

function pauseSelectedDuration(pause) {
  const days = Number(pause?.durationDays);
  return pause?.durationDays !== null && pause?.durationDays !== undefined && Number.isInteger(days) && days > 0
    ? `${days} day${days === 1 ? '' : 's'}`
    : 'Data unavailable';
}

function recurringRewardRows(summary, disciplineState) {
  return rowsForIds(disciplineState?.dpEvents, summary.disciplineStats.recurringEventIds).map((event) => {
    const match = event.title?.match(/Rank\s+(\d+)/i);
    const rank = Object.values(RANK_DISCIPLINE_CONFIG).find((item) => item.number === match?.[1]);
    return { ...event, rankName: rank?.name || event.title || 'Rank configuration unavailable', requiredDays: rank?.cycleDays ?? null };
  });
}

function rankDaysInPeriod(summary, rankEvents) {
  const startRank = summary.rankStats.startingRank;
  if (!startRank) return null;
  const transitions = [...rankEvents].sort((a, b) => a.date.localeCompare(b.date));
  const spans = [];
  let current = startRank;
  let cursor = summary.rangeStart;
  for (const event of transitions) {
    if (!event.rankSlug || event.date < cursor) continue;
    if (event.date > cursor) spans.push({ rank: current, days: dayDistance(cursor, event.date) });
    current = RANK_DISCIPLINE_CONFIG[event.rankSlug] || { id: event.rankSlug, number: event.rankNumber, name: event.rankName };
    cursor = event.date;
  }
  spans.push({ rank: current, days: dayDistance(cursor, summary.rangeEnd) + 1 });
  return spans.reduce((result, span) => {
    const key = span.rank.id || `${span.rank.number}-${span.rank.name}`;
    const existing = result.find((item) => item.id === key);
    if (existing) existing.days += span.days;
    else result.push({ id: key, label: `${span.rank.number} · ${span.rank.name}`, value: span.days });
    return result;
  }, []);
}

function Panel({ id, eyebrow, title, action, children, className = '' }) {
  return <section className={`monthly-panel ${className}`} id={id} aria-labelledby={`${id}-title`}>
    <div className="monthly-panel__heading"><div><p className="app-eyebrow">{eyebrow}</p><h2 id={`${id}-title`}>{title}</h2></div>{action}</div>
    {children}
  </section>;
}

function Metric({ label, value, note, tone = '' }) {
  return <article className={`monthly-metric${tone ? ` monthly-metric--${tone}` : ''}`}>
    <span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}
  </article>;
}

function Table({ columns, rows, empty = 'No recorded events in this period.' }) {
  if (!rows?.length) return <p className="monthly-empty">{empty}</p>;
  return <div className="monthly-table-wrap"><table className="monthly-table"><thead><tr>{columns.map((column) => <th key={column.key} scope="col">{column.label}</th>)}</tr></thead><tbody>
    {rows.map((row, index) => <tr key={row.id || `${row.date || 'row'}-${index}`}>{columns.map((column) => <td key={column.key}>{column.render ? column.render(row) : row[column.key] ?? 'Data unavailable'}</td>)}</tr>)}
  </tbody></table></div>;
}

function BarList({ items, labelKey = 'label', valueKey = 'value', empty = 'No finalized daily records are available yet.', tone = 'cyan' }) {
  const max = Math.max(1, ...items.map((item) => Number(item[valueKey]) || 0));
  if (!items.length) return <p className="monthly-empty">{empty}</p>;
  return <div className="monthly-bar-list" role="list">
    {items.map((item, index) => {
      const value = Number(item[valueKey]) || 0;
      const width = value ? Math.max(2, value / max * 100) : 0;
      return <div className="monthly-bar-row" role="listitem" key={item.id || item[labelKey] || index}>
        <span className="monthly-bar-row__label">{item[labelKey]}</span>
        <span className={`monthly-bar-row__track monthly-bar-row__track--${tone}`}><i style={{ width: `${width}%` }} /></span>
        <strong>{item[valueKey] ?? 0}</strong>
      </div>;
    })}
  </div>;
}

function DailyBars({ days, mode = 'tasks' }) {
  const [activeDate, setActiveDate] = useState(days.at(-1)?.date || null);
  const values = days.flatMap((day) => mode === 'xp' ? [chartNumber(day.xp?.earned), chartNumber(day.xp?.drained)] : mode === 'drain' ? [chartNumber(day.xp?.drained)] : [chartNumber(day.task?.completed), chartNumber(day.task?.missed)]).filter((value) => value !== null);
  const maximum = Math.max(1, ...values);
  if (!days.length) return <p className="monthly-empty">No daily records are available for this period.</p>;
  const active = days.find((day) => day.date === activeDate) || days.at(-1);
  const axis = mode === 'tasks' ? 'scheduled Tasks' : 'XP';
  return <div className="monthly-chart-frame">
    <div className="monthly-chart-tooltip" aria-live="polite">
      <strong>{formatDateKey(active.date)}</strong>
      {mode === 'tasks' ? <span>{valueOrUnavailable(active.task?.completed)} completed · {valueOrUnavailable(active.task?.missed)} missed · {valueOrUnavailable(active.task?.scheduled)} scheduled · {valueOrUnavailable(active.task?.completionPercent, '%')} complete</span>
        : <><span className="monthly-chart-tooltip__xp-gained">XP gained · {decimal(active.xp?.earned)}</span><span className="monthly-chart-tooltip__xp-drained">XP drained · {decimal(active.xp?.drained)}</span><span className={`monthly-chart-tooltip__xp-net${chartNumber(active.xp?.net) < 0 ? ' is-negative' : ' is-positive'}`}>Net XP · {signed(active.xp?.net)}</span><span className="monthly-chart-tooltip__xp-rank-bonus">Daily Rank bonus · {decimal(active.xp?.dailyRankBonus)}</span><span className="monthly-chart-tooltip__xp-quest-drain">Recovery Quest drain · {decimal(active.xp?.recoveryQuestDrain)}</span></>}
      {active.discipline?.protected && <span className="monthly-chart-tooltip__protected">Emergency Pause protected</span>}
    </div>
    <div className={`monthly-daily-chart-scroll${days.length === 1 ? ' monthly-daily-chart-scroll--single' : ''}`} role="region" aria-label={mode === 'xp' ? 'Daily XP gain, drain and net chart' : mode === 'drain' ? 'Daily Recovery Quest XP drain chart' : 'Daily completed and missed scheduled tasks chart'} tabIndex="0">
      <div className="monthly-chart-plot">
        <div className="monthly-chart-y-axis" aria-hidden="true"><span>{maximum} {axis}</span><span>{Math.round(maximum / 2)}</span><span>0</span></div>
        <div className={`monthly-daily-chart monthly-daily-chart--${mode}${days.length === 1 ? ' monthly-daily-chart--single' : ''}`} role="list">
          {days.map((day) => {
            const dayDone = mode === 'xp' ? chartNumber(day.xp?.earned) : mode === 'drain' ? null : chartNumber(day.task?.completed);
            const dayLoss = mode === 'xp' || mode === 'drain' ? chartNumber(day.xp?.drained) : chartNumber(day.task?.missed);
            const net = chartNumber(day.xp?.net);
            const doneHeight = dayDone === null ? null : Math.max(dayDone ? 3 : 0, dayDone / maximum * 100);
            const lossHeight = dayLoss === null ? null : Math.max(dayLoss ? 3 : 0, dayLoss / maximum * 100);
            const netHeight = net === null ? null : Math.max(net ? 3 : 0, Math.abs(net) / maximum * 100);
            return <button type="button" className={`monthly-daily-chart__day${day.discipline?.protected ? ' is-protected' : ''}${active.date === day.date ? ' is-selected' : ''}`} role="listitem" key={day.date} aria-label={`${formatDateKey(day.date)}: ${mode === 'tasks' ? `${day.task?.completed ?? 'unavailable'} completed, ${day.task?.missed ?? 'unavailable'} missed` : `${decimal(day.xp?.earned)} XP gained, ${decimal(day.xp?.drained)} XP drained, net ${signed(day.xp?.net)}`}${day.discipline?.protected ? ', Emergency Pause protected' : ''}`} onMouseEnter={() => setActiveDate(day.date)} onFocus={() => setActiveDate(day.date)}>
              <div className="monthly-daily-chart__bars">{mode !== 'drain' && doneHeight !== null && <i className="monthly-daily-chart__positive" style={{ height: `${doneHeight}%` }} />}{lossHeight !== null && <i className="monthly-daily-chart__negative" style={{ height: `${lossHeight}%` }} />}{mode === 'xp' && netHeight !== null && <i className={`monthly-daily-chart__net${net < 0 ? ' is-negative' : ' is-positive'}`} style={{ height: `${netHeight}%` }} />}</div>
              <small>{Number(day.date.slice(-2))}</small>
            </button>;
          })}
        </div>
      </div>
      <div className="monthly-chart-legend">{mode !== 'drain' && <span><i className="is-positive" />{mode === 'xp' ? 'XP gained' : 'Completed Tasks'}</span>}<span><i className="is-negative" />{mode === 'xp' ? 'XP drained' : mode === 'drain' ? 'Recovery Quest XP drain' : 'Missed Tasks'}</span>{mode === 'xp' && <span className="monthly-chart-legend__net"><i className="is-net" />Net XP <small>(positive / negative)</small></span>}<span><i className="is-protected" />Emergency Pause protected</span></div>
    </div>
  </div>;
}

function DisciplineStatusChart({ days }) {
  const [activeDate, setActiveDate] = useState(days.at(-1)?.date || null);
  if (!days.length) return <p className="monthly-empty">No daily Discipline records are available.</p>;
  const active = days.find((day) => day.date === activeDate) || days.at(-1);
  const counts = days.reduce((result, day) => { result[day.discipline.status] = (result[day.discipline.status] || 0) + 1; return result; }, {});
  return <div className="monthly-discipline-chart">
    <div className="monthly-chart-tooltip" aria-live="polite"><strong>{formatDateKey(active.date)}</strong><span>{active.discipline.protected ? 'Protected by Emergency Pause' : active.discipline.status === 'qualified' ? 'Qualified Discipline day' : active.discipline.status === 'not-qualified' ? 'Finalized · not qualified' : active.discipline.status === 'in-progress' ? 'Current day · in progress' : 'Discipline status unavailable'}</span>{active.task && <span>{active.task.completed}/{active.task.scheduled} scheduled Tasks completed</span>}</div>
    <div className="monthly-discipline-strip" role="list" aria-label="Daily Discipline qualification timeline">
      {days.map((day) => <button type="button" key={day.date} role="listitem" aria-label={`${formatDateKey(day.date)} · ${day.discipline.status}`} className={`monthly-discipline-day monthly-discipline-day--${day.discipline.status}${day.date === active.date ? ' is-selected' : ''}`} onMouseEnter={() => setActiveDate(day.date)} onFocus={() => setActiveDate(day.date)}><span>{day.date.slice(-2)}</span></button>)}
    </div>
    <div className="monthly-chart-legend"><span><i className="is-qualified" />Qualified · {counts.qualified || 0}</span><span><i className="is-not-qualified" />Not qualified · {counts['not-qualified'] || 0}</span><span><i className="is-protected" />Protected · {counts.protected || 0}</span><span><i className="is-in-progress" />In progress · {counts['in-progress'] || 0}</span>{Boolean(counts.unavailable) && <span><i className="is-unavailable" />Unavailable · {counts.unavailable}</span>}</div>
  </div>;
}

function RecoveryOutcomeChart({ stats }) {
  const items = [
    { key: 'completed', label: 'Completed', value: stats.completed, tone: 'completed' },
    { key: 'expired', label: 'Individually expired', value: stats.individuallyExpired, tone: 'expired' },
    { key: 'threshold', label: 'Cleared by six-Quest threshold', value: stats.thresholdCleared, tone: 'threshold' },
    { key: 'active', label: 'Active at period end', value: stats.activeAtEnd, tone: 'active' },
  ];
  const max = Math.max(1, ...items.map((item) => Number(item.value) || 0));
  return <div className="monthly-outcome-chart" role="list" aria-label="Recovery Quest outcomes">
    {items.map((item) => <div className="monthly-outcome-row" role="listitem" key={item.key}><span>{item.label}</span><div className="monthly-outcome-track"><i className={`is-${item.tone}`} style={{ width: `${Number(item.value) ? Math.max(2, Number(item.value) / max * 100) : 0}%` }} /></div><strong>{item.value}</strong></div>)}
  </div>;
}

function ComparisonChart({ summaries }) {
  const metrics = [
    { label: 'Task completion', value: (item) => item.taskStats.completionRate, format: (value) => value === null ? 'Unavailable' : `${value}%`, max: 100 },
    { label: 'XP earned', value: (item) => item.xpStats.earned, format: (value) => decimal(value) },
    { label: 'XP drained', value: (item) => item.xpStats.drained, format: (value) => decimal(value) },
    { label: 'Qualified Discipline days', value: (item) => item.disciplineStats.qualifyingDays, format: (value) => valueOrUnavailable(value) },
    { label: 'Recovery Quests completed', value: (item) => item.recoveryStats.completed, format: (value) => valueOrUnavailable(value) },
  ];
  return <div className="monthly-comparison-chart-scroll" tabIndex="0" role="region" aria-label="Visual comparison across selected months"><div className="monthly-comparison-chart" style={{ '--comparison-month-count': Math.max(1, summaries.length) }}>
    <div className="monthly-comparison-chart__legend"><span>Metric</span>{summaries.map((summary, index) => <span key={summary.id}><i className={`is-month-${index % 5}`} />{formatMonthLabel(summary.monthKey)}{summary.status === 'partial' ? ' · Partial' : ''}</span>)}</div>
    {metrics.map((metric) => {
      const values = summaries.map((summary) => metric.value(summary));
      const max = metric.max || Math.max(1, ...values.map((value) => Number(value) || 0));
      return <div className="monthly-comparison-chart__metric" key={metric.label}><strong>{metric.label}</strong>{summaries.map((summary, index) => { const value = values[index]; const width = value === null || value === undefined ? 0 : Number(value) ? Math.max(2, Number(value) / max * 100) : 0; return <span className="monthly-comparison-chart__value" key={summary.id}><i className={`is-month-${index % 5}`} style={{ width: `${width}%` }} /><b>{metric.format(value)}</b></span>; })}</div>;
    })}
  </div></div>;
}

function HistoryDisclosure({ title, count, children, className = '' }) {
  return <details className={`monthly-history-disclosure ${className}`}><summary><span>{title}</span><small>{count}</small><AppIcon name="chevron" /></summary><div className="monthly-history-disclosure__body">{children}</div></details>;
}

function DailyPercentBars({ days }) {
  const [activeDate, setActiveDate] = useState(null);
  const eligible = days.filter((day) => day.task?.finalized && !day.discipline.protected && day.task.scheduled > 0);
  if (!eligible.length) return <p className="monthly-empty">No finalized non-protected daily completion percentages are available.</p>;
  const active = eligible.find((day) => day.date === activeDate) || eligible.at(-1);
  return <div className={`monthly-percent-chart-wrap${eligible.length === 1 ? ' monthly-percent-chart-wrap--single' : ''}`}>
    <div className="monthly-chart-tooltip" aria-live="polite"><strong>{formatDateKey(active.date)}</strong><span>{active.task.completed}/{active.task.scheduled} Tasks · {active.task.completionPercent}% complete</span></div>
    <div className={`monthly-percent-chart${eligible.length === 1 ? ' monthly-percent-chart--single' : ''}`} role="list" aria-label="Daily task completion percentage chart">
      {eligible.map((day) => <button type="button" className={`monthly-percent-chart__day${day.date === active.date ? ' is-selected' : ''}`} role="listitem" key={day.date} aria-label={`${formatDateKey(day.date)} · ${day.task.completed} of ${day.task.scheduled} completed · ${day.task.completionPercent}%`} onMouseEnter={() => setActiveDate(day.date)} onFocus={() => setActiveDate(day.date)}>
        <div className="monthly-percent-chart__track"><i style={{ height: `${day.task.completionPercent}%` }} /></div><small>{day.date.slice(-2)}</small><b>{day.task.completionPercent}%</b>
      </button>)}
    </div>
  </div>;
}

function missedTaskRows(summary, schedule, recoveryState, todayKey, runBaseline, isCurrentRun) {
  if (!summary?.availability?.detailedTaskHistory) return null;
  const entries = [];
  const excluded = new Set(isCurrentRun ? runBaseline?.excluded?.occurrenceKeys || [] : []);
  Object.entries(schedule?.occurrences || {}).forEach(([key, occurrence]) => {
    const date = key.split(':').at(-1);
    if (date < summary.rangeStart || date > summary.rangeEnd || occurrence?.status !== 'missed') return;
    if (occurrence.progressionRunId !== summary.progressionRunId && (occurrence.progressionRunId || excluded.has(key) || date < summary.runStartDate)) return;
    const [taskId, cycleDay] = key.split(':');
    const historyVersions = (schedule.taskHistory || []).filter((item) => item.id === taskId && item.changedAt > `${date}T23:59:59`).sort((a, b) => a.changedAt.localeCompare(b.changedAt));
    const definition = historyVersions[0] || schedule.tasks?.find((item) => item.id === taskId) || {};
    const quest = (recoveryState?.quests || []).find((item) => item.occurrenceKey === key && item.progressionRunId === summary.progressionRunId);
    entries.push({ id: key, date, taskName: occurrence?.snapshot?.name || definition.name || 'Task detail unavailable', taskId, cycleDay: Number(cycleDay) || '—', actionTitle: occurrence?.snapshot?.actionTitle || definition.actionTitle || definition.accountabilityAction || 'Not recorded', questStatus: quest ? statusName(quest.status) : 'No Recovery Quest recorded', questStatusRaw: quest?.status || 'none' });
  });
  return entries.sort((a, b) => b.date.localeCompare(a.date) || a.taskName.localeCompare(b.taskName));
}

function getQuestRows(summary, recoveryState) {
  return rowsForIds(recoveryState?.quests, summary.recoveryStats.questIds).map((quest) => ({
    ...quest,
    statusLabel: statusName(quest.status),
    statusDate: quest.completedDate || quest.expiryDate || quest.clearedDate || quest.activationDate,
    gracePointEvent: (recoveryState?.gracePointEvents || []).find((event) => event.id === quest.gracePointEventId) || null,
  })).sort((a, b) => b.statusDate.localeCompare(a.statusDate));
}

function PrintReport({ summaries, member, memberSince, generatedAt, disciplineState, recoveryState, emergencyPauseState, currentSchedule, todayKey, analysisRunBaseline }) {
  const compareFields = [
    ['Completed / scheduled Tasks', (item) => `${valueOrUnavailable(item.taskStats.completed)} / ${valueOrUnavailable(item.taskStats.scheduled)}`],
    ['Missed Tasks / completion rate', (item) => `${valueOrUnavailable(item.taskStats.missed)} / ${valueOrUnavailable(item.taskStats.completionRate, '%')}`],
    ['Qualified / protected days', (item) => `${item.disciplineStats.qualifyingDays} / ${item.disciplineStats.protectedDays}`],
    ['Recovery Quests · completed / expired / threshold-cleared', (item) => `${item.recoveryStats.completed} / ${item.recoveryStats.individuallyExpired} / ${item.recoveryStats.thresholdCleared}`],
    ['XP earned / drained / net', (item) => `${decimal(item.xpStats.earned)} / ${decimal(item.xpStats.drained)} / ${signed(item.xpStats.net)}`],
    ['DP ending / Grace Points ending', (item) => `${valueOrUnavailable(item.dpStats.endingBalance)} / ${valueOrUnavailable(item.graceStats.endingBalance)}`],
    ['Rank-ups / Emergency Pauses', (item) => `${item.rankStats.rankUps} / ${item.pauseStats.used}`],
  ];
  return <div className="monthly-report-print" aria-label="Monthly analysis PDF report">
    <header className="monthly-report-print__header"><div className="monthly-report-print__brand"><svg className="monthly-report-print__mark" viewBox="0 0 40 40" aria-hidden="true"><path d="M20 2.8 35 11.4v17.2L20 37.2 5 28.6V11.4L20 2.8Z" /><path d="M20 8.5 30 14.2v11.6L20 31.5 10 25.8V14.2L20 8.5Z" /><path d="M20 13v14M13 20h14m-11.8-4.8 9.6 9.6m0-9.6-9.6 9.6" /></svg><span>THE <b>SYSTEM</b></span></div><p>MONTHLY PERFORMANCE REPORT</p><small>Generated {new Intl.DateTimeFormat('en-IN', { dateStyle: 'long', timeZone: 'Asia/Kolkata' }).format(new Date(generatedAt))} · IST</small></header>
    <div className="monthly-report-print__member"><strong>{member.displayName}</strong><span>{member.email}</span><span>Member Since · {memberSince ? formatDateKey(memberSince) : 'Data unavailable'}</span><span>Session preview</span></div>
    {summaries.length > 1 && <section className="monthly-report-print__comparison"><h1>Selected Month Comparison</h1><p>All compared periods belong to progression run {summaries[0].progressionRunId}.</p><table><thead><tr><th>Metric</th>{summaries.map((item) => <th key={item.id}>{formatMonthLabel(item.monthKey)}{item.status === 'partial' ? ' · Partial' : ''}</th>)}</tr></thead><tbody>{compareFields.map(([label, render]) => <tr key={label}><th>{label}</th>{summaries.map((item) => <td key={item.id}>{render(item)}</td>)}</tr>)}</tbody></table></section>}
    {summaries.map((summary) => {
      const xpEvents = rowsForIds(disciplineState?.xpHistory, summary.sourceIds?.xpEventIds).sort((a, b) => a.date.localeCompare(b.date));
      const questRows = rowsForIds(recoveryState?.quests, summary.recoveryStats.questIds);
      const pauses = emergencyPauseRows(emergencyPauseState, summary.sourceIds?.emergencyPauseHistoryIds ?? summary.sourceIds?.emergencyPauseIds);
      const rankUps = rowsForIds(disciplineState?.rankEntryEvents, summary.rankStats.eventIds);
      const missedRows = missedTaskRows(summary, currentSchedule, recoveryState, todayKey, analysisRunBaseline, summary.progressionRunId === disciplineState?.progressionRunId);
      const redemptions = rowsForIds(disciplineState?.redemptionEvents, summary.sourceIds?.redemptionEventIds);
      const graceEvents = [...rowsForIds(recoveryState?.gracePointEvents, summary.sourceIds?.gracePointEventIds), ...redemptions.map((event) => ({ ...event, id: `grace-${event.id}`, kind: 'redemption', appliedAmount: event.gracePointsAdded, balanceAfter: event.gracePointsAfter }))];
      const dpEvents = [...rowsForIds(disciplineState?.dpEvents, summary.sourceIds?.disciplinePointEventIds), ...redemptions.map((event) => ({ ...event, kind: 'redemption', amount: -Number(event.dpSpent || 0), balanceAfter: event.dpBalanceAfter }))];
      return <article className="monthly-report-print__month" key={summary.id}>
        <h1>{formatMonthLabel(summary.monthKey)} {summaries.length > 1 ? 'Report' : 'Report'}</h1>
        <p>{formatDateKey(summary.rangeStart)} — {formatDateKey(summary.rangeEnd)} · {summary.status === 'partial' ? 'Partial month' : summary.availability.detailedTaskHistory ? 'Finalized month' : 'Aggregate historical report'} · Progression run {summary.progressionRunId}</p>
        <h2>Monthly Overview</h2>
        <table><tbody>
          <tr><th>Tasks completed / scheduled</th><td>{valueOrUnavailable(summary.taskStats.completed)} / {valueOrUnavailable(summary.taskStats.scheduled)}</td><th>Task completion rate</th><td>{valueOrUnavailable(summary.taskStats.completionRate, '%')}</td></tr>
          <tr><th>Missed tasks / pending today</th><td>{valueOrUnavailable(summary.taskStats.missed)} / {valueOrUnavailable(summary.taskStats.pending)}</td><th>Average completed / missed per eligible day</th><td>{decimal(summary.taskStats.averageCompletedPerEligibleDay)} / {decimal(summary.taskStats.averageMissedPerEligibleDay)}</td></tr>
          <tr><th>Qualified / non-qualified / protected days</th><td>{summary.disciplineStats.qualifyingDays} / {summary.disciplineStats.nonQualifyingDays} / {summary.disciplineStats.protectedDays}</td><th>Starting / ending streak</th><td>{valueOrUnavailable(summary.disciplineStats.startingStreak)} / {valueOrUnavailable(summary.disciplineStats.endingStreak)}</td></tr>
          <tr><th>Quests completed / expired / threshold-cleared</th><td>{summary.recoveryStats.completed} / {summary.recoveryStats.individuallyExpired} / {summary.recoveryStats.thresholdCleared}</td><th>Quest outcome rate</th><td>{summary.recoveryStats.resolvedCompletionRate === null ? 'No resolved Recovery Quests' : `${summary.recoveryStats.resolvedCompletionRate}%`}</td></tr>
          <tr><th>XP starting / ending</th><td>{valueOrUnavailable(summary.xpStats.startingXp)} / {valueOrUnavailable(summary.xpStats.endingXp)}</td><th>XP earned / drained / net</th><td>{decimal(summary.xpStats.earned)} / {decimal(summary.xpStats.drained)} / {signed(summary.xpStats.net)}</td></tr>
          <tr><th>Level starting / ending · lost / gained</th><td>{valueOrUnavailable(summary.xpStats.startingLevel)} / {valueOrUnavailable(summary.xpStats.endingLevel)} · {summary.xpStats.levelsLost} / Data unavailable</td><th>Rank start / end · Rank-ups</th><td>{summary.rankStats.startingRank?.name || 'Data unavailable'} / {summary.rankStats.endingRank?.name || 'Data unavailable'} · {summary.rankStats.rankUps}</td></tr>
          <tr><th>Emergency Pause activations / protected days</th><td>{summary.pauseStats.used} / {summary.pauseStats.totalPauseDays}</td><th>Early / automatic resumes · Active</th><td>{summary.pauseStats.earlyResumeCount} / {summary.pauseStats.automaticResumeCount} · {summary.pauseStats.activeCount}</td></tr>
          <tr><th>DP start / end · Grace Points start / end</th><td>{valueOrUnavailable(summary.dpStats.startingBalance)} / {valueOrUnavailable(summary.dpStats.endingBalance)} · {valueOrUnavailable(summary.graceStats.startingBalance)} / {valueOrUnavailable(summary.graceStats.endingBalance)}</td><th>Emergency Pause history detail</th><td>{summary.pauseStats.unavailableHistoryCount ? `${summary.pauseStats.unavailableHistoryCount} record(s) contain unavailable fields` : 'Available for recorded events'}</td></tr>
        </tbody></table>
        <h2>Task Performance</h2><p>Daily completion distribution: {Object.entries(summary.taskStats.distribution).map(([key, count]) => `${key === 'moreThanSeven' ? '>7' : key} completed: ${count}`).join(' · ')}</p>
        {summary.availability.detailedTaskHistory && <Table columns={[{ key: 'date', label: 'Date', render: (row) => formatDateKey(row.date) }, { key: 'taskName', label: 'Missed Task' }, { key: 'taskId', label: 'Task ID' }, { key: 'cycleDay', label: 'Cycle day' }, { key: 'actionTitle', label: 'Accountability Action' }]} rows={missedRows || []} empty="No retained missed-task details." />}
        <h2>Recovery Quest Outcome Details</h2><p>Active at start / end: {summary.recoveryStats.activeAtStart} / {summary.recoveryStats.activeAtEnd} · Individual expiry deductions: {summary.recoveryStats.graceExpiryDeductions} GP · Six-quest threshold deductions: {summary.recoveryStats.graceThresholdDeductions} GP. Threshold-cleared Quests are not counted as individual failures.</p>
        <Table columns={[{ key: 'originalTaskName', label: 'Original Task' }, { key: 'originalTaskId', label: 'Task ID' }, { key: 'accountabilityActionTitle', label: 'Accountability Action' }, { key: 'activationDate', label: 'Activated', render: (row) => formatDateKey(row.activationDate) }, { key: 'status', label: 'Status' }, { key: 'completedDate', label: 'Completed', render: (row) => currencyDate(row.completedDate) }, { key: 'expiryDate', label: 'Expired', render: (row) => currencyDate(row.expiryDate) }, { key: 'clearedDate', label: 'Threshold-cleared', render: (row) => currencyDate(row.clearedDate) }]} rows={questRows} empty="No Recovery Quest records were stored for this month." />
        <h2>XP and Level Event History</h2><p>Daily Rank XP: {decimal(summary.xpStats.dailyRankBonus)} · Recovery Quest XP drain: {decimal(summary.xpStats.recoveryQuestDrain)} · Levels lost: {summary.xpStats.levelsLost} · Levels gained: Data unavailable because Level-up events are not stored.</p>
        <Table columns={[{ key: 'date', label: 'Date', render: (row) => formatDateKey(row.date) }, { key: 'kind', label: 'Event' }, { key: 'amount', label: 'XP change', render: (row) => signed(row.amount) }, { key: 'totalAfter', label: 'Total XP after', render: (row) => valueOrUnavailable(row.totalAfter) }]} rows={xpEvents} empty="No detailed XP events are available." />
        <h2>Grace Point History</h2><Table columns={[{ key: 'date', label: 'Date', render: (row) => formatDateKey(row.date) }, { key: 'kind', label: 'Event' }, { key: 'appliedAmount', label: 'Applied', render: (row) => row.kind === 'redemption' ? `+${decimal(row.gracePointsAdded)} GP` : `−${decimal(row.appliedAmount)} GP` }, { key: 'balanceAfter', label: 'Balance after' }, { key: 'questId', label: 'Quest / redemption ID' }]} rows={graceEvents} />
        <h2>Discipline Point History</h2><Table columns={[{ key: 'date', label: 'Date', render: (row) => formatDateKey(row.date) }, { key: 'title', label: 'Event' }, { key: 'amount', label: 'DP change', render: (row) => signed(row.amount) }, { key: 'balanceAfter', label: 'Balance after' }]} rows={dpEvents} />
        <h2>Rank Progression and Emergency Pause</h2><p>Recurring DP awarded: {decimal(summary.dpStats.recurringAwarded)} · Rank-entry DP awarded: {decimal(summary.dpStats.rankEntryAwarded)} · Rank-ups: {summary.rankStats.rankUps} · DP redeemed: {decimal(summary.dpStats.redeemed)}</p>
        <Table columns={[{ key: 'date', label: 'Rank-up date', render: (row) => formatDateKey(row.date) }, { key: 'rankNumber', label: 'Rank reached', render: (row) => `${row.rankNumber} · ${row.rankName}` }, { key: 'dpAwarded', label: 'Entry DP', render: (row) => decimal(row.dpAwarded) }]} rows={rankUps} />
        <Table columns={[{ key: 'id', label: 'Pause ID', render: (row) => row.id || row.activationEventId || 'Data unavailable' }, { key: 'startAt', label: 'Activated · IST', render: (row) => istDateTime(row.startAt) }, { key: 'durationDays', label: 'Selected duration', render: (row) => pauseSelectedDuration(row) }, { key: 'scheduledResumeAt', label: 'Scheduled resume · IST', render: (row) => istDateTime(row.scheduledResumeAt) }, { key: 'actualResumeAt', label: 'Actual resume · IST', render: (row) => row.actualResumeAt ? istDateTime(row.actualResumeAt) : row.status === 'active' ? 'Active' : 'Data unavailable' }, { key: 'resumeReason', label: 'Resume type', render: (row) => pauseResumeLabel(row) }, { key: 'elapsed', label: 'Actual elapsed', render: (row) => pauseElapsedDuration(row, Date.parse(generatedAt)) }, { key: 'protectedDates', label: 'Protected IST dates · month attribution', render: (row) => pauseProtectedDateAttribution(row, summary.rangeStart, summary.rangeEnd) }]} rows={pauses} empty="No Emergency Pause records overlap this month." />
        <h2>Daily Performance Timeline</h2>
        {summary.timeline.length ? <table className="monthly-report-print__timeline"><thead><tr><th>Date</th><th>Tasks</th><th>Discipline</th><th>Quest events</th><th>XP earned / drained / net</th></tr></thead><tbody>{summary.timeline.map((day) => <tr key={day.date}><td>{formatDateKey(day.date)}</td><td>{day.task ? `${day.task.completed}/${day.task.scheduled} complete${day.task.finalized ? ` · ${day.task.missed} missed` : ` · ${day.task.pending} pending`}` : day.discipline.protected ? 'Protected' : 'Data unavailable'}</td><td>{day.discipline.status}</td><td>+{day.quests.generated} / ✓{day.quests.completed} / −{day.quests.expired} / cleared {day.quests.thresholdCleared}</td><td>{day.xp ? `${decimal(day.xp.earned)} / ${decimal(day.xp.drained)} / ${signed(day.xp.net)}` : 'Data unavailable'}</td></tr>)}</tbody></table> : <p>No daily records are available.</p>}
        {!summary.availability.detailedTaskHistory && <p className="monthly-report-print__notice">Aggregate historical report only. Detailed task-level records have expired; aggregate monthly statistics remain available.</p>}
      </article>;
    })}
    <footer>THE SYSTEM · Progress is built, not given. · Frontend session preview; this report was generated locally and was not uploaded or emailed.</footer>
  </div>;
}

export default function MonthlyAnalysisPage() {
  const { disciplineState, currentSchedule, recoveryState, emergencyPauseState, monthlySummaries, historyExpiryReminders, analysisRunBaseline } = useTaskSchedule();
  const todayKey = getIstDateKey();
  const currentMonth = getIstMonthKey(todayKey);
  const currentRunId = disciplineState.progressionRunId;
  const runs = useMemo(() => [...new Set((monthlySummaries || []).map((summary) => summary.progressionRunId))], [monthlySummaries]);
  const [activeRunId, setActiveRunId] = useState(currentRunId);
  const [monthKey, setMonthKey] = useState(currentMonth);
  const [comparisonMonths, setComparisonMonths] = useState([currentMonth]);
  const [missedQuery, setMissedQuery] = useState('');
  const [missedFromDate, setMissedFromDate] = useState('');
  const [missedToDate, setMissedToDate] = useState('');
  const [missedCycleDay, setMissedCycleDay] = useState('all');
  const [missedQuestFilter, setMissedQuestFilter] = useState('all');
  const [timelineFromDate, setTimelineFromDate] = useState('');
  const [timelineToDate, setTimelineToDate] = useState('');
  const [timelineStatus, setTimelineStatus] = useState('all');
  const [printing, setPrinting] = useState(false);
  const [progressTab, setProgressTab] = useState('recovery');

  useEffect(() => {
    setActiveRunId(currentRunId);
    setMonthKey(currentMonth);
    setComparisonMonths((current) => current.includes(currentMonth) ? current : [...current, currentMonth]);
  }, [currentRunId]);

  const activeRunSummaries = useMemo(() => (monthlySummaries || [])
    .filter((summary) => summary.progressionRunId === activeRunId)
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .map((summary) => {
      const pauseStats = buildEmergencyPauseMonthlyStats(emergencyPauseState, {
        rangeStart: summary.rangeStart,
        rangeEnd: summary.rangeEnd,
        now: new Date(),
      });
      return {
        ...summary,
        pauseStats,
        availability: { ...summary.availability, hasData: Boolean(summary.availability?.hasData || pauseStats.used || pauseStats.totalPauseDays || pauseStats.activeCount) },
        sourceIds: { ...summary.sourceIds, emergencyPauseIds: pauseStats.pauseEventIds, emergencyPauseHistoryIds: pauseStats.historyRecordIds },
      };
    }), [monthlySummaries, activeRunId, emergencyPauseState]);
  const availableMonths = activeRunSummaries.filter((summary) => summary.availability?.hasData || summary.monthKey === currentMonth);
  const selected = activeRunSummaries.find((summary) => summary.monthKey === monthKey) || availableMonths.at(-1) || null;
  const isCurrentRun = activeRunId === currentRunId;
  const missedRows = useMemo(() => selected ? missedTaskRows(selected, currentSchedule, recoveryState, todayKey, analysisRunBaseline, isCurrentRun) : null, [selected, currentSchedule, recoveryState, todayKey, analysisRunBaseline, isCurrentRun]);
  const filteredMissedRows = (missedRows || []).filter((row) => {
    const matchesText = `${row.date} ${row.taskName} ${row.taskId} ${row.actionTitle}`.toLowerCase().includes(missedQuery.toLowerCase());
    const matchesFrom = !missedFromDate || row.date >= missedFromDate;
    const matchesTo = !missedToDate || row.date <= missedToDate;
    const matchesCycle = missedCycleDay === 'all' || String(row.cycleDay) === missedCycleDay;
    const matchesQuest = missedQuestFilter === 'all' || row.questStatusRaw === missedQuestFilter;
    return matchesText && matchesFrom && matchesTo && matchesCycle && matchesQuest;
  });
  const selectedQuests = selected ? getQuestRows(selected, recoveryState) : [];
  const selectedComparisons = activeRunSummaries.filter((summary) => comparisonMonths.includes(summary.monthKey));
  const reportSummaries = selected ? [...new Map([selected, ...selectedComparisons].map((summary) => [summary.id, summary])).values()].sort((a, b) => a.monthKey.localeCompare(b.monthKey)) : [];

  useEffect(() => {
    if (!printing) return undefined;
    const cleanup = () => { document.body.classList.remove('monthly-analysis-printing'); setPrinting(false); };
    document.body.classList.add('monthly-analysis-printing');
    const timer = window.setTimeout(() => window.print(), 180);
    window.addEventListener('afterprint', cleanup, { once: true });
    return () => { window.clearTimeout(timer); window.removeEventListener('afterprint', cleanup); document.body.classList.remove('monthly-analysis-printing'); };
  }, [printing]);

  if (!selected) return <div className="monthly-analysis-page"><header className="monthly-analysis-header"><p className="app-eyebrow">MY PROGRESS · HISTORICAL REVIEW</p><h1>Monthly Analysis</h1><p>Measure your consistency. Understand your progress. Identify where you can improve.</p></header><section className="monthly-panel monthly-empty-state"><AppIcon name="analysis" /><h2>Monthly records are being prepared</h2><p>Once the shared schedule and Discipline records contain activity, the month summary will appear here. No history is invented for this preview.</p></section></div>;

  const task = selected.taskStats;
  const discipline = selected.disciplineStats;
  const recovery = selected.recoveryStats;
  const xp = selected.xpStats;
  const completionDistribution = Object.entries(task.distribution)
    .filter(([, value]) => Number(value) > 0)
    .map(([label, value]) => ({ label: label === 'moreThanSeven' ? '> 7' : label, value }));
  const finalizedTaskDays = selected.timeline.filter((day) => day.task?.finalized && !day.discipline.protected && day.task.scheduled > 0);
  const compareToggle = (month) => setComparisonMonths((current) => current.includes(month) ? current.filter((item) => item !== month) : [...current, month]);
  const sourceIds = selected.sourceIds || {};
  const xpEventRows = rowsForIds(disciplineState.xpHistory, sourceIds.xpEventIds).sort((a, b) => a.date.localeCompare(b.date));
  const xpDrainRows = rowsForIds(disciplineState.xpDrainEvents, sourceIds.xpDrainEventIds).sort((a, b) => a.date.localeCompare(b.date));
  const dailyRankRows = rowsForIds(disciplineState.dailyRankXpEvents, selected.rankStats.dailyRankEventIds);
  const dailyRankById = new Map(dailyRankRows.map((event) => [event.id, event]));
  const rankRows = rowsForIds(disciplineState.rankEntryEvents, selected.rankStats.eventIds).sort((a, b) => a.date.localeCompare(b.date));
  const recurringRows = recurringRewardRows(selected, disciplineState);
  const redemptionRows = rowsForIds(disciplineState.redemptionEvents, sourceIds.redemptionEventIds);
  const graceRows = [
    ...rowsForIds(recoveryState.gracePointEvents, sourceIds.gracePointEventIds),
    ...redemptionRows.map((event) => ({ ...event, id: `grace-${event.id}`, kind: 'redemption', amount: event.gracePointsAdded, appliedAmount: event.gracePointsAdded, balanceAfter: event.gracePointsAfter })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const dpRows = [
    ...rowsForIds(disciplineState.dpEvents, sourceIds.disciplinePointEventIds),
    ...redemptionRows.map((event) => ({ ...event, kind: 'redemption', title: 'Grace Point redemption', amount: -Number(event.dpSpent || 0), balanceAfter: event.dpBalanceAfter })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const pauseRows = emergencyPauseRows(emergencyPauseState, sourceIds.emergencyPauseHistoryIds ?? sourceIds.emergencyPauseIds);
  const rankDays = rankDaysInPeriod(selected, rankRows);
  const levelDownRows = rowsForIds(disciplineState.levelDownEvents, xp.levelEventIds).sort((a, b) => a.date.localeCompare(b.date));
  const redemptionCooldownHours = 72;
  const lastRedemption = disciplineState.lastRedemptionAt;
  const cooldownRemainingHours = lastRedemption ? Math.max(0, Math.ceil((Date.parse(lastRedemption) + redemptionCooldownHours * 3_600_000 - Date.now()) / 3_600_000)) : 0;
  const filteredTimeline = selected.timeline.filter((day) => (!timelineFromDate || day.date >= timelineFromDate)
    && (!timelineToDate || day.date <= timelineToDate)
    && (timelineStatus === 'all' || day.discipline.status === timelineStatus));

  const totalDpEarned = selected.dpStats.recurringAwarded + selected.dpStats.rankEntryAwarded;
  const totalGraceDeducted = selected.graceStats.expiryDeductions + selected.graceStats.thresholdDeductions;
  const questTotal = recovery.generated;
  const reminderList = historyExpiryReminders.filter((item) => item.createdDate === todayKey && item.expiryDate > todayKey).reverse();

  return <div className="monthly-analysis-page">
    <header className="monthly-analysis-header">
      <div><p className="app-eyebrow">MY PROGRESS · PERFORMANCE HISTORY</p><h1>Monthly Analysis</h1><p>Measure your consistency. Understand your progress. Identify where you can improve.</p></div>
      <span className="app-demo-label"><i aria-hidden="true" />SESSION PREVIEW</span>
    </header>

    <section className="monthly-controls" aria-label="Monthly analysis controls">
      <label><span>PROGRESSION RUN</span><select value={activeRunId} onChange={(event) => { const nextRunId = event.target.value; const nextRun = (monthlySummaries || []).filter((summary) => summary.progressionRunId === nextRunId).sort((a, b) => a.monthKey.localeCompare(b.monthKey)); setActiveRunId(nextRunId); setMonthKey(nextRun.at(-1)?.monthKey || currentMonth); setComparisonMonths((current) => current.filter((month) => nextRun.some((summary) => summary.monthKey === month))); }}>
        {runs.map((runId) => <option key={runId} value={runId}>{runId === currentRunId ? `Current run · ${runId}` : `Archive · ${runId}`}</option>)}
      </select></label>
      <label><span>MONTH</span><select value={selected.monthKey} onChange={(event) => setMonthKey(event.target.value)}>
        {availableMonths.map((summary) => <option key={summary.id} value={summary.monthKey}>{formatMonthLabel(summary.monthKey)}{summary.status === 'partial' ? ' · Partial' : ''}</option>)}
      </select></label>
      <div className="monthly-controls__range"><span>PERIOD</span><strong>{formatDateKey(selected.rangeStart)} — {formatDateKey(selected.rangeEnd)}</strong><small>{selected.status === 'partial' ? 'Ongoing · unfinished activity is not counted as failure' : 'Finalized period'} · {selected.availability.detailedTaskHistory ? 'Detailed history available' : 'Aggregate history only'}</small></div>
      <button className="button button--secondary monthly-export-button" type="button" onClick={() => setPrinting(true)}><AppIcon name="analysis" />Print / Save PDF</button>
    </section>
    <p className="monthly-run-note">{isCurrentRun ? 'Current progression run' : 'Archived progression run'} · {selected.progressionRunId} · Comparisons are isolated to this run.</p>

    <nav className="monthly-section-nav" aria-label="Monthly analysis sections">
      {[['overview', 'Overview'], ['performance', 'Performance Trends'], ['recovery-progression', 'Recovery & Progression'], ['history', 'Detailed History']].map(([id, label]) => <a key={id} href={`#monthly-${id}`} onClick={(event) => {
        const section = document.getElementById(`monthly-${id}`);
        if (!section) return;
        event.preventDefault();
        const nav = event.currentTarget.closest('.monthly-section-nav');
        const topbar = document.querySelector('.app-topbar');
        const topbarBottom = topbar?.getBoundingClientRect().bottom || 0;
        const stickyTop = Number.parseFloat(window.getComputedStyle(nav).top) || topbarBottom;
        const safeTop = Math.max(topbarBottom, stickyTop) + nav.getBoundingClientRect().height + 14;
        const heading = section.querySelector('.monthly-major-heading') || section;
        const top = Math.max(0, window.scrollY + heading.getBoundingClientRect().top - safeTop);
        if (window.location.hash !== `#monthly-${id}`) window.history.pushState(null, '', `#monthly-${id}`);
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
      }}>{label}</a>)}
    </nav>

    <section className="monthly-major-section" id="monthly-overview" aria-labelledby="monthly-overview-title">
      <div className="monthly-major-heading"><div><p className="app-eyebrow">SECTION A · PERIOD SNAPSHOT</p><h2 id="monthly-overview-title">Monthly Overview</h2><p>Eight key signals for {formatMonthLabel(selected.monthKey)}.</p></div><span className={`monthly-period-status${selected.status === 'partial' ? ' is-partial' : ''}`}>{selected.status === 'partial' ? 'PARTIAL MONTH' : selected.availability.detailedTaskHistory ? 'FINALIZED' : 'AGGREGATE HISTORY'}</span></div>
      <div className="monthly-overview-grid">
        <Metric label="Task completion rate" value={valueOrUnavailable(task.completionRate, '%')} note={`${valueOrUnavailable(task.finalizedCompleted)} of ${valueOrUnavailable(task.finalizedScheduled)} finalized`} tone="cyan" />
        <Metric label="Completed Tasks" value={valueOrUnavailable(task.completed)} note="Includes completed work today" />
        <Metric label="Missed Tasks" value={valueOrUnavailable(task.missed)} note="Finalized scheduled dates only" tone="warning" />
        <Metric label="Qualifying Discipline days" value={valueOrUnavailable(discipline.qualifyingDays)} note={`${valueOrUnavailable(discipline.nonQualifyingDays)} non-qualifying · ${valueOrUnavailable(discipline.protectedDays)} protected`} />
        <Metric label="Net XP change" value={signed(xp.net)} note={`${decimal(xp.earned)} earned · ${decimal(xp.drained)} drained`} tone={Number(xp.net) < 0 ? 'warning' : 'cyan'} />
        <Metric label="Recovery Quests generated" value={valueOrUnavailable(questTotal)} note={`${recovery.completed} complete · ${recovery.individuallyExpired} expired · ${recovery.thresholdCleared} threshold-cleared`} />
        <Metric label="Discipline Points earned" value={`+${decimal(totalDpEarned)}`} note={`${decimal(selected.dpStats.redeemed)} redeemed`} tone="cyan" />
        <Metric label="Grace Point change" value={signed(selected.graceStats.added - totalGraceDeducted)} note={`+${decimal(selected.graceStats.added)} added · −${decimal(totalGraceDeducted)} deducted`} tone="violet" />
      </div>
      {!selected.availability.hasData && <p className="monthly-inline-note">No source records are available for this period. Missing values remain unavailable rather than being shown as zero.</p>}
      {!selected.availability.detailedTaskHistory && <p className="monthly-retention-banner"><AppIcon name="clock" /><span><strong>Aggregate-only history.</strong> Task-level details have expired under the two-calendar-month retention rule. Monthly totals remain available.</span></p>}
      <HistoryDisclosure title="Compare months" count={`${comparisonMonths.length} selected`} className="monthly-comparison-disclosure">
        <p className="monthly-inline-note">Choose any available months from this progression run. Archived runs remain separate.</p>
        <div className="monthly-comparison-selectors" role="group" aria-label="Months to compare">{availableMonths.map((summary) => <label key={summary.id} className="monthly-comparison-toggle"><input type="checkbox" checked={comparisonMonths.includes(summary.monthKey)} onChange={() => compareToggle(summary.monthKey)} /><span>{formatMonthLabel(summary.monthKey)}{summary.status === 'partial' ? ' · Partial' : ''}<small>{summary.availability.detailedTaskHistory ? 'Detailed' : 'Aggregate only'}</small></span></label>)}</div>
        {selectedComparisons.length < 2 ? <p className="monthly-empty">Select two or more months to see a comparison. Non-consecutive months and three or more months are supported.</p> : <>
          <ComparisonChart summaries={selectedComparisons} />
          <HistoryDisclosure title="All comparison metrics" count="16 measures"><div className="monthly-table-wrap monthly-comparison-table-wrap"><table className="monthly-table monthly-comparison-table"><thead><tr><th scope="col">Metric</th>{selectedComparisons.map((summary) => <th key={summary.id} scope="col">{formatMonthLabel(summary.monthKey)}{summary.status === 'partial' ? ' · Partial' : ''}</th>)}</tr></thead><tbody>
            {[
              ['Scheduled Tasks', (summary) => valueOrUnavailable(summary.taskStats.scheduled)], ['Completed Tasks', (summary) => valueOrUnavailable(summary.taskStats.completed)], ['Missed Tasks', (summary) => valueOrUnavailable(summary.taskStats.missed)], ['Completion rate', (summary) => valueOrUnavailable(summary.taskStats.completionRate, '%')], ['Average completed / eligible day', (summary) => decimal(summary.taskStats.averageCompletedPerEligibleDay)], ['Days with 5+ completed', (summary) => summary.taskStats.exactlyFiveDays + summary.taskStats.exactlySixDays + summary.taskStats.exactlySevenDays + summary.taskStats.moreThanSevenDays], ['Qualifying / non-qualifying days', (summary) => `${summary.disciplineStats.qualifyingDays} / ${summary.disciplineStats.nonQualifyingDays}`], ['Protected days / streak breaks', (summary) => `${summary.disciplineStats.protectedDays} / ${summary.disciplineStats.streakBreaks}`], ['Quest outcomes · complete / expired / cleared', (summary) => `${summary.recoveryStats.completed} / ${summary.recoveryStats.individuallyExpired} / ${summary.recoveryStats.thresholdCleared}`], ['Quest outcome completion rate', (summary) => summary.recoveryStats.resolvedCompletionRate === null ? 'No resolved Recovery Quests' : `${summary.recoveryStats.resolvedCompletionRate}%`], ['XP earned / drained / net', (summary) => `${decimal(summary.xpStats.earned)} / ${decimal(summary.xpStats.drained)} / ${signed(summary.xpStats.net)}`], ['Starting / ending Level', (summary) => `${valueOrUnavailable(summary.xpStats.startingLevel)} / ${valueOrUnavailable(summary.xpStats.endingLevel)}`], ['DP earned / redeemed', (summary) => `${decimal(summary.dpStats.recurringAwarded + summary.dpStats.rankEntryAwarded)} / ${decimal(summary.dpStats.redeemed)}`], ['Grace Point added / deducted', (summary) => `${decimal(summary.graceStats.added)} / ${decimal(summary.graceStats.expiryDeductions + summary.graceStats.thresholdDeductions)}`], ['Rank start → end / Rank-ups', (summary) => `${summary.rankStats.startingRank?.name || 'Unavailable'} → ${summary.rankStats.endingRank?.name || 'Unavailable'} / ${summary.rankStats.rankUps}`], ['Emergency Pauses / protected days', (summary) => `${summary.pauseStats.used} / ${summary.pauseStats.totalPauseDays}`],
            ].map(([label, render]) => <tr key={label}><th scope="row">{label}</th>{selectedComparisons.map((summary) => <td key={summary.id}>{render(summary)}</td>)}</tr>)}
          </tbody></table></div></HistoryDisclosure>
        </>}
      </HistoryDisclosure>
    </section>

    <section className="monthly-major-section" id="monthly-performance" aria-labelledby="monthly-performance-title">
      <div className="monthly-major-heading"><div><p className="app-eyebrow">SECTION B · DAILY SIGNALS</p><h2 id="monthly-performance-title">Performance Trends</h2><p>Task completion, Discipline consistency and recorded XP change by date.</p></div></div>
      <Panel id="monthly-tasks" eyebrow="SCHEDULED ACTIVITY" title="Daily Task Performance">
        {finalizedTaskDays.length ? <>
          <div className="monthly-chart-block monthly-chart-block--feature"><div className="monthly-chart-block__heading"><h3>Completed vs missed by day</h3><p>Finalized non-protected dates · focus or hover a date for exact values.</p></div><DailyBars days={finalizedTaskDays} /></div>
          <div className="monthly-secondary-charts">
            <div className="monthly-chart-block"><div className="monthly-chart-block__heading"><h3>Daily completion distribution</h3><p>Finalized, eligible dates · 5+ meets the Discipline task minimum. Empty groups are omitted.</p></div><BarList items={completionDistribution} empty="No finalized eligible dates yet." /></div>
            <div className="monthly-chart-block"><div className="monthly-chart-block__heading"><h3>Daily completion rate</h3><p>Protected dates and unfinished today are omitted.</p></div><DailyPercentBars days={selected.timeline} /></div>
          </div>
        </> : <div className="monthly-chart-empty" role="status"><AppIcon name="analysis" /><div><strong>No finalized eligible Task dates yet</strong><p>Daily comparisons and completion distribution will appear after an eligible date is finalized. In-progress and protected dates are not included.</p></div></div>}
        <div className="monthly-task-insights" aria-label="Additional task performance measures"><span>Total scheduled <strong>{valueOrUnavailable(task.scheduled)}</strong><small>{task.scheduledDays} eligible dates</small></span><span>Pending today <strong>{valueOrUnavailable(task.pending)}</strong></span><span>Average completed / eligible date <strong>{decimal(task.averageCompletedPerEligibleDay)}</strong></span><span>Average missed / eligible date <strong>{decimal(task.averageMissedPerEligibleDay)}</strong></span><span>Best finalized date <strong>{task.bestDay ? `${task.bestDay.completed}/${task.bestDay.scheduled}` : 'Data unavailable'}</strong><small>{task.bestDay ? formatDateKey(task.bestDay.date) : 'No eligible date'}</small></span><span>Lowest finalized date <strong>{task.lowestDay ? `${task.lowestDay.completed}/${task.lowestDay.scheduled}` : 'Data unavailable'}</strong><small>{task.lowestDay ? formatDateKey(task.lowestDay.date) : 'No eligible date'}</small></span></div>
        {finalizedTaskDays.length > 0 && <div className="monthly-task-count-summary">
          <div><h3>Daily completion groups</h3><p>Number of finalized, non-protected days for each completed-Task total.</p></div>
          <div className="monthly-task-count-strip" aria-label="Count of days by completed Task total">
            <span><b>Exactly 5 completed Tasks</b><strong>{task.exactlyFiveDays} days</strong></span>
            <span><b>Exactly 6 completed Tasks</b><strong>{task.exactlySixDays} days</strong></span>
            <span><b>Exactly 7 completed Tasks</b><strong>{task.exactlySevenDays} days</strong></span>
            <span><b>8 or more completed Tasks</b><strong>{task.moreThanSevenDays} days</strong></span>
          </div>
        </div>}
      </Panel>

      <Panel id="monthly-discipline" eyebrow="CONSISTENCY & STREAKS" title="Discipline Consistency">
        <div className="monthly-chart-block monthly-chart-block--feature"><div className="monthly-chart-block__heading"><h3>Daily qualification history</h3><p>Protected days have their own status and are never marked as failures.</p></div><DisciplineStatusChart days={selected.timeline} /></div>
        <div className="monthly-discipline-summary"><span>Qualifying / non-qualifying / protected <strong>{valueOrUnavailable(discipline.qualifyingDays)} / {valueOrUnavailable(discipline.nonQualifyingDays)} / {valueOrUnavailable(discipline.protectedDays)}</strong></span><span>Qualification rate <strong>{valueOrUnavailable(discipline.qualificationRate, '%')}</strong></span><span>Streak start / end · longest <strong>{valueOrUnavailable(discipline.startingStreak)} / {valueOrUnavailable(discipline.endingStreak)} · {valueOrUnavailable(discipline.longestStreak)}</strong></span><span>Streak breaks <strong>{valueOrUnavailable(discipline.streakBreaks)}</strong></span></div>
      </Panel>

      <Panel id="monthly-xp-level" eyebrow="RECORDED PROGRESSION EVENTS" title="XP Performance">
        <div className="monthly-chart-block monthly-chart-block--feature"><div className="monthly-chart-block__heading"><h3>Daily XP gain and drain</h3><p>Positive and negative amounts are separated. Focus or hover a date for net and event detail.</p></div><DailyBars days={selected.timeline.filter((day) => day.xp && (day.xp.earned || day.xp.drained))} mode="xp" /></div>
        <div className="monthly-xp-categories"><span>Starting / ending XP <strong>{valueOrUnavailable(xp.startingXp)} → {valueOrUnavailable(xp.endingXp)}</strong></span><span>Daily Rank XP <strong>+{decimal(xp.dailyRankBonus)}</strong></span><span>Recovery Quest drain <strong>−{decimal(xp.recoveryQuestDrain)}</strong></span><span>Level changes <strong>{valueOrUnavailable(xp.startingLevel)} → {valueOrUnavailable(xp.endingLevel)}</strong></span><span>Levels lost <strong>{valueOrUnavailable(xp.levelsLost)}</strong></span><span>Scheduled Task XP <strong>Unavailable</strong></span></div>
      </Panel>
    </section>

    <section className="monthly-major-section" id="monthly-recovery-progression" aria-labelledby="monthly-recovery-progression-title">
      <div className="monthly-major-heading"><div><p className="app-eyebrow">SECTION C · OUTCOMES & BALANCES</p><h2 id="monthly-recovery-progression-title">Recovery and Progression</h2><p>Review Quest outcomes, point balances and Rank progression.</p></div></div>
      <div className="monthly-progress-tabs" role="tablist" aria-label="Recovery and progression summaries">
        {[['recovery', 'Recovery Quests'], ['points', 'Points'], ['rank', 'Rank & Level']].map(([id, label]) => <button type="button" role="tab" id={`monthly-tab-${id}`} aria-selected={progressTab === id} aria-controls={`monthly-tabpanel-${id}`} key={id} onClick={() => setProgressTab(id)}>{label}</button>)}
      </div>
      <section hidden={progressTab !== 'recovery'} className="monthly-progress-content" id="monthly-tabpanel-recovery" role="tabpanel" aria-labelledby="monthly-tab-recovery" tabIndex="0">
        <div className="monthly-key-stat-grid monthly-key-stat-grid--four">
          <Metric label="Generated" value={valueOrUnavailable(recovery.generated)} />
          <Metric label="Completed" value={valueOrUnavailable(recovery.completed)} tone="cyan" />
          <Metric label="Individually expired" value={valueOrUnavailable(recovery.individuallyExpired)} tone="warning" />
          <Metric label="Threshold-cleared" value={valueOrUnavailable(recovery.thresholdCleared)} tone="violet" />
          <Metric label={recovery.frozenAtEnd ? 'Active · frozen' : 'Active at period end'} value={valueOrUnavailable(recovery.activeAtEnd)} note="Emergency Pause preserves active windows." />
          <Metric label="Resolved completion rate" value={recovery.resolvedCompletionRate === null ? 'No resolved Quests' : `${recovery.resolvedCompletionRate}%`} note="Completed ÷ all resolved outcomes" tone="cyan" />
        </div>
        <p className="monthly-inline-note">Active at period start: {valueOrUnavailable(recovery.activeAtStart)} · Average completion time: {recovery.averageCompletionDays === null ? 'Unavailable' : `${decimal(recovery.averageCompletionDays)} days`}.</p>
        <div className="monthly-chart-block monthly-chart-block--feature"><div className="monthly-chart-block__heading"><h3>Recovery Quest outcomes</h3><p>Individual expiry and six-Quest threshold clearing are separate outcomes.</p></div><RecoveryOutcomeChart stats={recovery} /></div>
        <div className="monthly-outcome-note"><span><b>Individual expiry</b> applies to a single Recovery Window. <b>Threshold-cleared</b> records the sixth active Quest rule clearing the group; it is not an individual expiry.</span></div>
      </section>
      <section hidden={progressTab !== 'points'} className="monthly-progress-content monthly-point-panels" id="monthly-tabpanel-points" role="tabpanel" aria-labelledby="monthly-tab-points" tabIndex="0">
        <div className="monthly-balance-card"><p className="app-eyebrow">GRACE POINTS · NO MAXIMUM</p><h3>Grace Point change</h3><div className="monthly-balance-values"><span>Starting <strong>{valueOrUnavailable(selected.graceStats.startingBalance)}</strong></span><span>Added <strong className="is-positive">+{decimal(selected.graceStats.added)}</strong></span><span>Deducted <strong className="is-negative">−{decimal(totalGraceDeducted)}</strong></span><span>Ending <strong>{valueOrUnavailable(selected.graceStats.endingBalance)}</strong></span></div><p>Individual expiry: −{decimal(selected.graceStats.expiryDeductions)} GP · six-Quest threshold: −{decimal(selected.graceStats.thresholdDeductions)} GP</p></div>
        <div className="monthly-balance-card"><p className="app-eyebrow">DISCIPLINE POINTS · 4.00 MAXIMUM</p><h3>Discipline Point change</h3><div className="monthly-balance-values"><span>Starting <strong>{valueOrUnavailable(selected.dpStats.startingBalance)}</strong></span><span>Earned <strong className="is-positive">+{decimal(totalDpEarned)}</strong></span><span>Redeemed <strong className="is-negative">−{decimal(selected.dpStats.redeemed)}</strong></span><span>Ending <strong>{valueOrUnavailable(selected.dpStats.endingBalance)}</strong></span></div><p>Recurring rewards {decimal(selected.dpStats.recurringAwarded)} DP · Rank-entry rewards {decimal(selected.dpStats.rankEntryAwarded)} DP</p></div>
        <p className="monthly-inline-note">Point histories remain separate and are available below under Detailed History.</p>
      </section>
      <section hidden={progressTab !== 'rank'} className="monthly-progress-content" id="monthly-tabpanel-rank" role="tabpanel" aria-labelledby="monthly-tab-rank" tabIndex="0">
        <div className="monthly-rank-level-summary"><div><p className="app-eyebrow">RANK PROGRESSION</p><strong>{selected.rankStats.startingRank ? `${selected.rankStats.startingRank.number} · ${selected.rankStats.startingRank.name}` : 'Data unavailable'} <span aria-hidden="true">→</span> {selected.rankStats.endingRank ? `${selected.rankStats.endingRank.number} · ${selected.rankStats.endingRank.name}` : 'Data unavailable'}</strong><small>{selected.rankStats.rankUps} recorded Rank-ups this period</small></div><div><p className="app-eyebrow">LEVEL PROGRESSION</p><strong>{valueOrUnavailable(xp.startingLevel)} <span aria-hidden="true">→</span> {valueOrUnavailable(xp.endingLevel)}</strong><small>{valueOrUnavailable(xp.levelsLost)} recorded Levels lost · Level gains unavailable</small></div></div>
        <div className="monthly-rank-benefit-strip"><span>Daily Rank XP <strong>+{decimal(xp.dailyRankBonus)}</strong> · {xp.dailyRankBonusEvents} recorded events</span><span>Emergency Pauses <strong>{pluralCount(selected.pauseStats.used, 'activation event')} · {pluralCount(selected.pauseStats.totalPauseDays, 'protected day')}</strong></span></div>
        <p className="monthly-inline-note">Scheduled Task XP and Level-up event history are not recorded by the current frontend source systems.</p>
      </section>
    </section>

    <section className="monthly-major-section" id="monthly-history" aria-labelledby="monthly-history-title">
      <div className="monthly-major-heading"><div><p className="app-eyebrow">SECTION D · SOURCE RECORDS</p><h2 id="monthly-history-title">Detailed History</h2><p>Open only the records you need. Filters and source events stay available without filling the overview.</p></div></div>

      <HistoryDisclosure title="Daily Performance Timeline" count={`${selected.timeline.length} dates`}>
        <p className="monthly-inline-note">Task-level names are available during the current and immediately preceding calendar months.</p>
        <div className="monthly-filters monthly-timeline-filters">
          <label><span className="visually-hidden">Timeline date from</span><input type="date" value={timelineFromDate} onChange={(event) => setTimelineFromDate(event.target.value)} aria-label="Timeline date from" /></label>
          <label><span className="visually-hidden">Timeline date to</span><input type="date" value={timelineToDate} onChange={(event) => setTimelineToDate(event.target.value)} aria-label="Timeline date to" /></label>
          <label><span className="visually-hidden">Filter timeline by Discipline status</span><select value={timelineStatus} onChange={(event) => setTimelineStatus(event.target.value)}><option value="all">All Discipline statuses</option><option value="qualified">Qualified</option><option value="not-qualified">Not qualified</option><option value="protected">Protected</option><option value="in-progress">In Progress</option><option value="unavailable">Unavailable</option></select></label>
        </div>
        <div className="monthly-timeline-list">{filteredTimeline.length ? filteredTimeline.map((day) => {
          const dayDp = rowsForIds(disciplineState.dpEvents, day.balances.dpEventIds);
          const dayRedemptions = rowsForIds(disciplineState.redemptionEvents, day.balances.redemptionEventIds);
          const dayGrace = [...rowsForIds(recoveryState.gracePointEvents, day.balances.graceEventIds), ...dayRedemptions.map((event) => ({ ...event, kind: 'redemption', amount: event.gracePointsAdded, balanceAfter: event.gracePointsAfter }))];
          const dpSummary = [...dayDp.map((event) => `${event.title || event.kind} ${signed(event.amount)} DP`), ...dayRedemptions.map((event) => `Grace Point redemption ${signed(-Number(event.dpSpent || 0))} DP`)];
          const graceSummary = dayGrace.map((event) => `${event.kind === 'redemption' ? 'Redemption' : event.kind === 'expiry' ? 'Individual expiry' : 'Six-Quest threshold'} ${event.kind === 'redemption' ? `+${decimal(event.gracePointsAdded)} GP` : `−${decimal(event.appliedAmount)} GP`}`);
          return <details className="monthly-timeline-day" key={day.date}>
            <summary><span>{formatDateKey(day.date)}</span><span>{day.task ? `${day.task.completed}/${day.task.scheduled} Tasks` : 'Task data unavailable'}</span><span className={`monthly-status monthly-status--${day.discipline.status}`}>{day.discipline.status}</span><span>{day.xp ? `${signed(day.xp.net)} XP` : 'XP unavailable'}</span><AppIcon name="chevron" /></summary>
            <div className="monthly-timeline-day__details">
              <div><small>Tasks</small><strong>{day.task ? `${day.task.completed} completed · ${day.task.finalized ? `${day.task.missed} missed` : `${day.task.pending} pending`}` : 'Data unavailable'}</strong><span>{day.task ? `${day.task.scheduled} scheduled · ${day.task.completionPercent}% complete` : ''}</span></div>
              <div><small>Discipline</small><strong>{day.discipline.protected ? 'Emergency Pause protected' : day.discipline.status}</strong><span>{day.discipline.streakBreak ? 'Streak break recorded' : 'No streak break recorded'}</span></div>
              <div><small>Recovery Quests</small><strong>{day.quests.generated} generated · {day.quests.completed} completed</strong><span>{day.quests.expired} individually expired · {day.quests.thresholdCleared} threshold-cleared · {day.quests.activeAtEnd} active</span></div>
              <div><small>XP</small><strong>{day.xp ? `${decimal(day.xp.earned)} earned · ${decimal(day.xp.drained)} drained · net ${signed(day.xp.net)}` : 'Data unavailable'}</strong><span>{day.xp ? `Daily Rank bonus ${decimal(day.xp.dailyRankBonus)} · Scheduled Task XP unavailable · ending Level ${valueOrUnavailable(day.xp.levelAfterReset)}` : 'No XP event detail for this date'}</span></div>
              <div><small>Discipline Point events</small><strong>{dayDp.length} awards · {dayRedemptions.length} redemptions</strong><span>{dpSummary.length ? dpSummary.join(' · ') : 'No DP balance changes recorded.'}</span></div>
              <div><small>Grace Point events</small><strong>{dayGrace.length} recorded changes</strong><span>{graceSummary.length ? graceSummary.join(' · ') : 'No Grace Point balance changes recorded.'}</span></div>
            </div>
          </details>;
        }) : <p className="monthly-empty">No dated source records match these filters.</p>}</div>
      </HistoryDisclosure>

      <HistoryDisclosure title="Individual Missed Task History" count={selected.availability.detailedTaskHistory ? `${filteredMissedRows.length} matching` : 'Aggregate only'}>
        {!selected.availability.detailedTaskHistory ? <p className="monthly-empty">Task-level history expired. Aggregate monthly missed totals remain available.</p> : <>
          <div className="monthly-filters">
            <label><span className="visually-hidden">Search date, Task name or ID</span><input value={missedQuery} onChange={(event) => setMissedQuery(event.target.value)} placeholder="Search date, Task name or ID" /></label>
            <label><span className="visually-hidden">Missed date from</span><input type="date" value={missedFromDate} onChange={(event) => setMissedFromDate(event.target.value)} aria-label="Missed date from" /></label>
            <label><span className="visually-hidden">Missed date to</span><input type="date" value={missedToDate} onChange={(event) => setMissedToDate(event.target.value)} aria-label="Missed date to" /></label>
            <label><span className="visually-hidden">Filter by cycle day</span><select value={missedCycleDay} onChange={(event) => setMissedCycleDay(event.target.value)}><option value="all">All cycle days</option>{Array.from({ length: currentSchedule.cycleLength || 7 }, (_, index) => <option key={index + 1} value={String(index + 1)}>Cycle day {index + 1}</option>)}</select></label>
            <label><span className="visually-hidden">Filter by Recovery Quest status</span><select value={missedQuestFilter} onChange={(event) => setMissedQuestFilter(event.target.value)}><option value="all">All Recovery Quest statuses</option><option value="none">No Recovery Quest recorded</option><option value={RECOVERY_STATUS.ACTIVE}>Active</option><option value={RECOVERY_STATUS.COMPLETED}>Completed</option><option value={RECOVERY_STATUS.EXPIRED}>Individually expired</option><option value={RECOVERY_STATUS.THRESHOLD_CLEARED}>Threshold-cleared</option></select></label>
          </div>
          <Table columns={[{ key: 'date', label: 'Missed date', render: (row) => formatDateKey(row.date) }, { key: 'taskName', label: 'Original Task' }, { key: 'taskId', label: 'Task ID' }, { key: 'cycleDay', label: 'Cycle day', render: (row) => row.cycleDay }, { key: 'actionTitle', label: 'Accountability Action' }, { key: 'questStatus', label: 'Recovery Quest' }]} rows={filteredMissedRows} empty="No missed scheduled Tasks match these filters." />
        </>}
      </HistoryDisclosure>

      <HistoryDisclosure title="Recurring Discipline Reward History" count={`${recurringRows.length} awards`}>
        <div className="monthly-history-summary-line"><span>Reward cycles completed <strong>{discipline.recurringRewardCount}</strong></span><span>DP awarded <strong>+{decimal(discipline.recurringDpAwarded)}</strong></span><span>Cycle start / end progress <strong>{valueOrUnavailable(discipline.rewardCycleStartProgress)} / {valueOrUnavailable(discipline.rewardCycleEndProgress)}</strong></span></div>
        <Table columns={[{ key: 'date', label: 'Reward date', render: (row) => formatDateKey(row.date) }, { key: 'rankName', label: 'Rank held for cycle', render: (row) => `Rank ${row.title?.match(/Rank\s+(\d+)/i)?.[1] || '—'} · ${row.rankName}` }, { key: 'requiredDays', label: 'Qualifying days', render: (row) => row.requiredDays === null ? 'Data unavailable' : `${row.requiredDays} required` }, { key: 'configuredAmount', label: 'Configured reward', render: (row) => `+${decimal(row.configuredAmount)} DP` }, { key: 'amount', label: 'Actually awarded', render: (row) => `+${decimal(row.amount)} DP` }]} rows={recurringRows} />
        <p className="monthly-inline-note">The Rank configuration recorded on each award is used; later Rank changes do not rewrite completed cycles.</p>
      </HistoryDisclosure>

      <HistoryDisclosure title="Recovery Quest Records and XP Drain" count={`${selectedQuests.length} Quest records · ${xpDrainRows.length} drain events`}>
        <div className="monthly-history-summary-line"><span>Expired individually <strong>{recovery.individuallyExpired}</strong></span><span>Threshold-cleared <strong>{recovery.thresholdCleared}</strong></span><span>Recovery Quest XP drain <strong>−{decimal(recovery.xpDrained)} XP</strong></span></div>
        <Table columns={[{ key: 'originalTaskName', label: 'Original Task' }, { key: 'originalTaskId', label: 'Task ID' }, { key: 'accountabilityActionTitle', label: 'Accountability Action' }, { key: 'accountabilityActionDescription', label: 'Action details', render: (row) => row.accountabilityActionDescription || 'Not recorded' }, { key: 'activationDate', label: 'Activated', render: (row) => formatDateKey(row.activationDate) }, { key: 'recoveryWindowDays', label: 'Window', render: (row) => row.recoveryWindowDays ? `${row.recoveryWindowDays} days` : 'Data unavailable' }, { key: 'statusLabel', label: 'Outcome' }, { key: 'statusDate', label: 'Outcome date', render: (row) => formatDateKey(row.statusDate) }, { key: 'gracePoint', label: 'Grace Point effect', render: (row) => row.gracePointEvent ? `−${decimal(row.gracePointEvent.appliedAmount)} GP` : row.status === RECOVERY_STATUS.THRESHOLD_CLEARED ? 'Shared threshold event · −1 GP total' : row.status === RECOVERY_STATUS.ACTIVE ? 'No deduction' : 'Data unavailable' }, { key: 'xpAttribution', label: 'Attributed XP drain', render: () => 'Data unavailable' }]} rows={selectedQuests} empty="No Recovery Quest events were recorded in this month." />
        <div className="monthly-chart-block monthly-chart-block--feature"><div className="monthly-chart-block__heading"><h3>Daily Recovery Quest XP drain</h3><p>Recorded reset events; pause days stay protected.</p></div><DailyBars days={selected.timeline.filter((day) => day.xp?.drained > 0 || day.discipline.protected)} mode="drain" /></div>
        <Table columns={[{ key: 'date', label: 'Date', render: (row) => formatDateKey(row.date) }, { key: 'activeRecoveryQuestCount', label: 'Active Quests' }, { key: 'levelAtCalculation', label: 'Level at reset' }, { key: 'levelRequirement', label: 'Level XP requirement', render: (row) => decimal(row.levelRequirement) }, { key: 'calculated', label: 'Calculated drain', render: (row) => decimal((Number(row.levelRequirement) || 0) * (Number(row.ratePerQuest) || 0) * (Number(row.activeRecoveryQuestCount) || 0)) }, { key: 'amount', label: 'Actual XP deducted', render: (row) => `−${decimal(row.amount)}` }]} rows={xpDrainRows} empty="No Recovery Quest XP-drain reset events were recorded in this period." />
      </HistoryDisclosure>

      <HistoryDisclosure title="XP Events and Level Changes" count={`${xpEventRows.length} XP events · ${levelDownRows.length} Level reductions`}>
        <div className="monthly-history-summary-line"><span>Daily Rank XP <strong>+{decimal(xp.dailyRankBonus)}</strong></span><span>Quest XP drain <strong>−{decimal(xp.recoveryQuestDrain)}</strong></span><span>Levels gained <strong>Unavailable</strong></span><span>Levels lost <strong>{valueOrUnavailable(xp.levelsLost)}</strong></span></div>
        <Table columns={[{ key: 'date', label: 'Date', render: (row) => formatDateKey(row.date) }, { key: 'kind', label: 'Event', render: (row) => row.kind === 'daily-rank-bonus' ? `Daily Rank XP · ${dailyRankById.get(row.id)?.rankName || 'Rank unavailable'}` : row.kind === 'recovery-drain' ? 'Recovery Quest XP drain' : row.kind }, { key: 'amount', label: 'XP change', render: (row) => signed(row.amount) }, { key: 'totalAfter', label: 'Total XP after event', render: (row) => valueOrUnavailable(row.totalAfter) }]} rows={selected.xpStats.eventHistoryAvailable ? xpEventRows : []} empty="XP event history is unavailable for this month." />
        <Table columns={[{ key: 'date', label: 'Date', render: (row) => formatDateKey(row.date) }, { key: 'fromLevel', label: 'From Level' }, { key: 'toLevel', label: 'To Level' }, { key: 'totalXp', label: 'XP after change', render: (row) => valueOrUnavailable(row.totalXp) }, { key: 'reason', label: 'Reason', render: () => 'Recovery Quest XP drain' }]} rows={levelDownRows} empty="No Level reductions were recorded in this period." />
        <p className="monthly-inline-note">Scheduled Task XP and Level-up events are not recorded by the current source system.</p>
      </HistoryDisclosure>

      <HistoryDisclosure title="Grace Point History" count={`${graceRows.length} changes`}>
        <Table columns={[{ key: 'date', label: 'Date', render: (row) => formatDateKey(row.date) }, { key: 'kind', label: 'Event', render: (row) => row.kind === 'expiry' ? 'Individual Quest expiry' : row.kind === 'threshold' ? 'Six-Quest threshold' : 'DP redemption' }, { key: 'amount', label: 'Applied', render: (row) => row.kind === 'redemption' ? `+${decimal(row.gracePointsAdded)} GP` : `−${decimal(row.appliedAmount)} GP` }, { key: 'balanceAfter', label: 'Balance after', render: (row) => valueOrUnavailable(row.balanceAfter) }, { key: 'questId', label: 'Quest / redemption ID', render: (row) => row.questId || row.id }]} rows={graceRows} />
        <div className="monthly-subsection-heading"><div><h3>Grace Point redemption records</h3><p>One Discipline Point is redeemed for one Grace Point.</p></div></div>
        <Table columns={[{ key: 'at', label: 'Redemption time', render: (row) => istDateTime(row.at) }, { key: 'id', label: 'Redemption ID' }, { key: 'dpSpent', label: 'DP spent', render: (row) => decimal(row.dpSpent) }, { key: 'gracePointsAdded', label: 'Grace Points added', render: (row) => decimal(row.gracePointsAdded) }, { key: 'dpBalanceAfter', label: 'DP balance after', render: (row) => valueOrUnavailable(row.dpBalanceAfter) }, { key: 'gracePointsAfter', label: 'Grace balance after', render: (row) => valueOrUnavailable(row.gracePointsAfter) }]} rows={redemptionRows} />
        <p className="monthly-inline-note">{cooldownRemainingHours ? `Current 72-hour redemption cooldown · ${cooldownRemainingHours} hours remain.` : 'No active 72-hour redemption cooldown is recorded.'}</p>
      </HistoryDisclosure>

      <HistoryDisclosure title="Discipline Point History" count={`${dpRows.length} changes`}>
        <Table columns={[{ key: 'date', label: 'Date', render: (row) => formatDateKey(row.date) }, { key: 'title', label: 'Event', render: (row) => row.kind === 'redemption' ? 'Grace Point redemption' : row.title || row.kind }, { key: 'amount', label: 'DP change', render: (row) => signed(row.amount) }, { key: 'balanceAfter', label: 'Balance after', render: (row) => valueOrUnavailable(row.balanceAfter) }, { key: 'id', label: 'Event ID' }]} rows={dpRows} />
      </HistoryDisclosure>

      <HistoryDisclosure title="Rank and Daily Rank Benefit History" count={`${rankRows.length} Rank-ups · ${dailyRankRows.length} daily benefits`}>
        <div className="monthly-rank-days-detail"><div className="monthly-rank-days-detail__chart"><h3>Days spent at each Rank</h3>{rankDays ? <BarList items={rankDays} tone="blue" empty="No Rank-day history is available." /> : <p className="monthly-empty">Starting Rank is unavailable, so Rank days cannot be reconstructed accurately.</p>}</div><div className="monthly-rank-days-detail__summary"><span>Starting / ending Rank</span><strong>{selected.rankStats.startingRank?.name || 'Unavailable'} → {selected.rankStats.endingRank?.name || 'Unavailable'}</strong></div></div>
        <Table columns={[{ key: 'date', label: 'Rank-up date', render: (row) => formatDateKey(row.date) }, { key: 'rankName', label: 'Rank reached', render: (row) => `${row.rankNumber} · ${row.rankName}` }, { key: 'dpAwarded', label: 'Entry DP', render: (row) => `+${decimal(row.dpAwarded)} DP` }, { key: 'xpStatus', label: 'Entry XP', render: (row) => row.xpStatus === 'pending' ? 'Pending configuration' : row.xpStatus }]} rows={rankRows} empty="No Rank-up events were recorded in this period." />
        <Table columns={[{ key: 'date', label: 'Date', render: (row) => formatDateKey(row.date) }, { key: 'rankName', label: 'Rank at reset' }, { key: 'percentage', label: 'Configured benefit', render: (row) => `${decimal(row.percentage)}%` }, { key: 'levelAtAward', label: 'Level at award' }, { key: 'levelRequirement', label: 'Level XP requirement', render: (row) => decimal(row.levelRequirement) }, { key: 'amount', label: 'XP awarded', render: (row) => `+${decimal(row.amount)}` }]} rows={dailyRankRows} empty="No daily Rank XP benefit events were stored in this period." />
      </HistoryDisclosure>

      <HistoryDisclosure title="Emergency Pause History" count={`${pluralCount(selected.pauseStats.used, 'activation')} · ${pluralCount(selected.pauseStats.totalPauseDays, 'protected day')}`}>
        <div className="monthly-pause-summary" aria-label="Emergency Pause monthly summary">
          <div><span>Activations</span><strong>{selected.pauseStats.used}</strong></div>
          <div><span>Protected IST days</span><strong>{selected.pauseStats.totalPauseDays}</strong></div>
          <div><span>Early resumes</span><strong>{selected.pauseStats.earlyResumeCount}</strong></div>
          <div><span>Automatic resumes</span><strong>{selected.pauseStats.automaticResumeCount}</strong></div>
          <div><span>Active in period</span><strong>{selected.pauseStats.activeCount}</strong></div>
        </div>
        <Table columns={[{ key: 'id', label: 'Pause ID', render: (row) => row.id || row.activationEventId || 'Data unavailable' }, { key: 'startAt', label: 'Activated · IST', render: (row) => istDateTime(row.startAt) }, { key: 'durationDays', label: 'Selected duration', render: (row) => pauseSelectedDuration(row) }, { key: 'scheduledResumeAt', label: 'Scheduled resume · IST', render: (row) => istDateTime(row.scheduledResumeAt) }, { key: 'actualResumeAt', label: 'Actual resume · IST', render: (row) => row.actualResumeAt ? istDateTime(row.actualResumeAt) : row.status === 'active' ? 'Active' : 'Data unavailable' }, { key: 'resumeReason', label: 'Resume type', render: (row) => pauseResumeLabel(row) }, { key: 'elapsed', label: 'Actual elapsed', render: (row) => pauseElapsedDuration(row) }, { key: 'protectedDates', label: 'Protected dates · IST month attribution', render: (row) => pauseProtectedDateAttribution(row, selected.rangeStart, selected.rangeEnd) }]} rows={pauseRows} empty="No Emergency Pause records overlap this month." />
        {selected.pauseStats.unavailableHistoryCount > 0 && <p className="monthly-inline-note">{pluralCount(selected.pauseStats.unavailableHistoryCount, 'pause record')} contain missing historical fields. Missing dates or durations are shown as unavailable and are not inferred.</p>}
        <p className="monthly-inline-note">Protected dates use the same unique IST dates as Discipline history. Dates appear under the calendar month they belong to and do not count as missed Tasks or failed Discipline days.</p>
      </HistoryDisclosure>



      <section className="monthly-retention-panel" aria-labelledby="monthly-retention-title">
        <div><p className="app-eyebrow">HISTORY RETENTION · IST</p><h3 id="monthly-retention-title">Detailed records expire by calendar month</h3><p>Task-level history remains for this month and the preceding month. Older records are summarized before detail expires; aggregate summaries remain in this browser session.</p></div>
        {reminderList.length ? <ul className="monthly-reminder-list">{reminderList.map((item) => <li key={item.id}><AppIcon name="clock" /><span><strong>{item.timingLabel} reminder · {item.monthLabel}</strong><small>Detailed history expires {formatDateKey(item.expiryDate)}. Aggregate statistics remain available.</small></span></li>)}</ul> : <span className="monthly-reminder-empty">No history-expiry reminder is due today.</span>}
      </section>
      <p className="monthly-disclosure"><AppIcon name="activity" />Monthly summaries and expiry notices are kept in this browser session. Scheduled Task XP and Level-up events are unavailable in existing source records.</p>
    </section>

    {printing && <PrintReport summaries={reportSummaries} member={dashboardDemo.member} memberSince={disciplineState.memberSince} generatedAt={new Date().toISOString()} disciplineState={disciplineState} recoveryState={recoveryState} emergencyPauseState={emergencyPauseState} currentSchedule={currentSchedule} todayKey={todayKey} analysisRunBaseline={analysisRunBaseline} />}
  </div>;
}
