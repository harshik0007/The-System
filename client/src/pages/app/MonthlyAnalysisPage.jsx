import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AppIcon from '../../components/app/AppIcon.jsx';
import PageLoadingSkeleton, { SkeletonLine } from '../../components/app/PageLoadingSkeleton.jsx';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';
import { useFlashMessages } from '../../context/FlashMessageContext.jsx';
import { taskApi } from '../../services/taskApi.js';
import '../../styles/monthly-analysis.css';

const rankNames = { origin: 'Origin', ember: 'Ember', surge: 'Surge', vector: 'Vector', apex: 'Diamond', zenith: 'Zenith', continuum: 'Continuum' };
const number = (value, suffix = '') => value === null || value === undefined || !Number.isFinite(Number(value)) ? 'Data unavailable' : `${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}${suffix}`;
const signed = (value) => value === null || value === undefined || !Number.isFinite(Number(value)) ? 'Data unavailable' : `${value > 0 ? '+' : ''}${number(value)}`;
const monthLabel = (key) => key ? new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${key}-01T12:00:00Z`)) : 'Month unavailable';
const dateLabel = (key) => key ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${key}T12:00:00Z`)) : 'Data unavailable';
const dateTimeLabel = (value) => value ? `${new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(new Date(value))}, ${new Intl.DateTimeFormat('en-IN', { timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(value))} IST` : 'Data unavailable';

function Metric({ label, value, note, tone = '' }) {
  return <article className={`monthly-metric${tone ? ` monthly-metric--${tone}` : ''}`}><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</article>;
}

function Panel({ id, eyebrow, title, action, children }) {
  return <section className="monthly-panel" id={id} aria-labelledby={`${id}-title`}><div className="monthly-panel__heading"><div><p className="app-eyebrow">{eyebrow}</p><h2 id={`${id}-title`}>{title}</h2></div>{action}</div>{children}</section>;
}

function StatPair({ label, first, second }) {
  return <div className="m25-stat-pair"><span>{label}</span><strong>{first} <i aria-hidden="true">→</i> {second}</strong></div>;
}

function ChartEmpty({ message }) {
  return <div className="monthly-chart-empty"><AppIcon name="analysis" /><div><strong>No data yet</strong><p>{message}</p><Link className="button button--secondary" to="/app/tasks">Open today’s Tasks</Link></div></div>;
}

function DailyPerformance({ daily }) {
  const taskDays = daily.filter((day) => (Number(day.tasks?.scheduled) || 0) > 0).length;
  const xpDays = daily.filter((day) => (Number(day.xp?.earned) || 0) > 0 || (Number(day.xp?.drained) || 0) > 0).length;
  if (!daily.length) return <ChartEmpty message="Complete a Task today to start your monthly trend." />;
  const maxTasks = Math.max(1, ...daily.map((day) => Number(day.tasks?.scheduled) || 0));
  const maxXp = Math.max(1, ...daily.map((day) => Math.max(Number(day.xp?.earned) || 0, Number(day.xp?.drained) || 0)));
  return <div className="m25-daily-stack">
    <div className="m25-daily-panel"><div className="monthly-chart-block__heading"><h3>Daily Task performance</h3><p>Completed and missed original scheduled Tasks.</p></div>
      {taskDays < 3 ? <ChartEmpty message="Complete a few more scheduled Tasks to make this trend useful." /> : <>
      <div className="m25-day-grid" role="list" aria-label="Daily Task performance">
        {daily.map((day) => <div className="m25-day-item" key={`task-${day.date}`} role="listitem" title={`${dateLabel(day.date)} · ${day.tasks ? `${day.tasks.completed} completed, ${day.tasks.missed} missed of ${day.tasks.scheduled} scheduled` : 'Task detail unavailable'}`}>
          <span className="m25-day-item__bars"><i className="m25-bar m25-bar--completed" style={{ height: `${day.tasks ? Math.max(2, (Number(day.tasks.completed) || 0) / maxTasks * 100) : 0}%` }} /><i className="m25-bar m25-bar--missed" style={{ height: `${day.tasks ? Math.max(2, (Number(day.tasks.missed) || 0) / maxTasks * 100) : 0}%` }} /></span>
          <small>{day.date.slice(-2)}</small><span className="m25-day-item__date">{dateLabel(day.date)}</span>
        </div>)}
      </div>
      <div className="monthly-chart-legend"><span><i className="is-positive" />Completed</span><span><i className="is-negative" />Missed</span></div></>}
    </div>
    <div className="m25-daily-panel"><div className="monthly-chart-block__heading"><h3>Daily XP performance</h3><p>XP earned and Recovery Quest drain, shown separately.</p></div>
      {xpDays < 3 ? <ChartEmpty message="Earn or lose XP on a few more days to see this trend." /> : <><div className="m25-day-grid" role="list" aria-label="Daily XP performance">
        {daily.filter((day) => day.xp).map((day) => <div className="m25-day-item" key={`xp-${day.date}`} role="listitem" title={`${dateLabel(day.date)} · ${number(day.xp.earned)} XP gained · ${number(day.xp.drained)} XP drained · Net ${signed(day.xp.net)}`}>
          <span className="m25-day-item__bars"><i className="m25-bar m25-bar--gained" style={{ height: `${Math.max(day.xp.earned ? 2 : 0, (Number(day.xp.earned) || 0) / maxXp * 100)}%` }} /><i className="m25-bar m25-bar--drained" style={{ height: `${Math.max(day.xp.drained ? 2 : 0, (Number(day.xp.drained) || 0) / maxXp * 100)}%` }} /></span>
          <small>{day.date.slice(-2)}</small><span className="m25-day-item__date">{dateLabel(day.date)}</span>
        </div>)}
      </div><div className="monthly-chart-legend"><span><i className="is-positive" />XP gained</span><span><i className="is-negative" />XP drained</span></div></>}
    </div>
  </div>;
}

function Comparison({ months, firstMonth, secondMonth, setFirstMonth, setSecondMonth, comparison, loading, onCompare }) {
  return <Panel id="monthly-comparison" eyebrow="SAME RUN · SIDE BY SIDE" title="Compare two months">
    <p className="monthly-inline-note">Only summaries from your current Progression Run are available. Changes are descriptive; an increase is not always an improvement.</p>
    <div className="m25-compare-controls">
      <label><span>FIRST MONTH</span><select value={firstMonth} onChange={(event) => setFirstMonth(event.target.value)}>{months.map((month) => <option key={month.monthKey} value={month.monthKey}>{monthLabel(month.monthKey)}{month.status === 'partial' ? ' · Partial' : ''}</option>)}</select></label>
      <label><span>SECOND MONTH</span><select value={secondMonth} onChange={(event) => setSecondMonth(event.target.value)}><option value="">Choose a month</option>{months.filter((month) => month.monthKey !== firstMonth).map((month) => <option key={month.monthKey} value={month.monthKey}>{monthLabel(month.monthKey)}{month.status === 'partial' ? ' · Partial' : ''}</option>)}</select></label>
      <button className="button button--secondary" type="button" disabled={!firstMonth || !secondMonth || loading} onClick={onCompare}>{loading ? 'Comparing…' : 'Compare months'}</button>
    </div>
    {comparison && <div className="monthly-table-wrap"><table className="monthly-table"><thead><tr><th scope="col">Measure</th><th scope="col">{monthLabel(comparison.first.monthKey)} <small>({comparison.first.coverage.from}–{comparison.first.coverage.through})</small></th><th scope="col">{monthLabel(comparison.second.monthKey)} <small>({comparison.second.coverage.from}–{comparison.second.coverage.through})</small></th><th scope="col">Difference</th><th scope="col">Change</th></tr></thead><tbody>{comparison.metrics.map((item) => <tr key={item.label}><th scope="row">{item.label}</th><td>{number(item.first)}</td><td>{number(item.second)}</td><td>{item.difference === null ? 'Data unavailable' : `${item.difference > 0 ? '+' : ''}${number(item.difference)}`}</td><td>{item.percentChange === null ? '—' : `${item.percentChange > 0 ? '+' : ''}${number(item.percentChange, '%')}`}</td></tr>)}</tbody></table></div>}
  </Panel>;
}

export default function MonthlyAnalysisPage() {
  const reduceMotion = useReducedMotion();
  const { notifySuccess, notifyError } = useFlashMessages();
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [months, setMonths] = useState([]);
  const [summaries, setSummaries] = useState({});
  const [selectedMonth, setSelectedMonth] = useState('');
  const [reminders, setReminders] = useState([]);
  const [details, setDetails] = useState([]);
  const [detailCursor, setDetailCursor] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [firstMonth, setFirstMonth] = useState('');
  const [secondMonth, setSecondMonth] = useState('');
  const [comparison, setComparison] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const loadPage = useCallback(async () => {
    setLoading(true);
    setPageError('');
    try {
      const [currentResult, previousResult, monthResult, reminderResult] = await Promise.allSettled([
        taskApi.monthlyAnalysisCurrent(), taskApi.monthlyAnalysisPrevious(), taskApi.monthlyAnalysisMonths(), taskApi.monthlyAnalysisReminders(),
      ]);
      if (currentResult.status === 'rejected') throw currentResult.reason;
      const current = currentResult.value.data?.summary || null;
      const previous = previousResult.status === 'fulfilled' ? previousResult.value.data?.summary || null : null;
      const monthData = monthResult.status === 'fulfilled' ? monthResult.value.data : { months: [] };
      const reminderItems = reminderResult.status === 'fulfilled' ? reminderResult.value.data?.reminders || [] : [];
      const cached = {};
      if (current) cached[current.monthKey] = current;
      if (previous) cached[previous.monthKey] = previous;
      setSummaries(cached);
      const monthMap = new Map((monthData.months || []).map((item) => [item.monthKey, item]));
      [current, previous].filter(Boolean).forEach((item) => monthMap.set(item.monthKey, { monthKey: item.monthKey, status: item.status, hasData: item.hasData, coveredFrom: item.coverage.from, coveredThrough: item.coverage.through, detailAvailable: item.detailedHistoryAvailable, detailExpiresAt: item.detailExpiresAt }));
      const monthList = [...monthMap.values()].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
      setMonths(monthList);
      setReminders(reminderItems);
      const defaultMonth = current?.monthKey || monthList.at(-1)?.monthKey || '';
      setSelectedMonth(defaultMonth);
      setFirstMonth(defaultMonth);
      setSecondMonth(previous?.monthKey || monthList.filter((item) => item.monthKey !== defaultMonth).at(-1)?.monthKey || '');
    } catch (error) {
      setPageError(error?.message || 'Monthly Analysis could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadPage(); }, [loadPage]);

  const selected = summaries[selectedMonth] || null;
  useEffect(() => {
    let active = true;
    if (!selectedMonth || summaries[selectedMonth]) return undefined;
    taskApi.monthlyAnalysisSummary(selectedMonth).then((response) => {
      if (!active) return;
      const summary = response.data?.summary;
      if (summary) setSummaries((current) => ({ ...current, [selectedMonth]: summary }));
    }).catch((error) => { if (active) setPageError(error?.message || 'This monthly summary could not be loaded.'); });
    return () => { active = false; };
  }, [selectedMonth, summaries]);

  useEffect(() => {
    let active = true;
    setDetails([]);
    setDetailCursor(null);
    setDetailError('');
    if (!selected?.detailedHistoryAvailable) return undefined;
    setDetailLoading(true);
    taskApi.monthlyAnalysisDetails(selected.monthKey, { limit: 50 }).then((response) => {
      if (!active) return;
      setDetails(response.data?.items || []);
      setDetailCursor(response.data?.nextCursor || null);
    }).catch((error) => { if (active) setDetailError(error?.message || 'Detailed Task history could not be loaded.'); })
      .finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [selected?.monthKey, selected?.detailedHistoryAvailable]);

  const loadMoreDetails = async () => {
    if (!detailCursor || detailLoading || !selected) return;
    setDetailLoading(true);
    setDetailError('');
    try {
      const response = await taskApi.monthlyAnalysisDetails(selected.monthKey, { limit: 50, cursor: detailCursor });
      setDetails((current) => [...current, ...(response.data?.items || [])]);
      setDetailCursor(response.data?.nextCursor || null);
    } catch (error) { notifyError(error?.message || 'More Task history could not be loaded.'); }
    finally { setDetailLoading(false); }
  };

  const runComparison = async () => {
    if (!firstMonth || !secondMonth || firstMonth === secondMonth || compareLoading) return;
    setCompareLoading(true); setComparison(null);
    try {
      const response = await taskApi.monthlyAnalysisCompare(firstMonth, secondMonth);
      setComparison(response.data);
      notifySuccess('Your monthly comparison is ready.');
    }
    catch (error) { notifyError(error?.message || 'These months could not be compared.'); }
    finally { setCompareLoading(false); }
  };

  const downloadPdf = async () => {
    if (!selected || pdfLoading) return;
    setPdfLoading(true);
    try {
      const blob = await taskApi.downloadMonthlyAnalysisPdf(selected.monthKey, comparison?.first.monthKey === selected.monthKey ? comparison.second.monthKey : comparison?.second.monthKey === selected.monthKey ? comparison.first.monthKey : null);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `the-system-monthly-${selected.monthKey}.pdf`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      notifySuccess('Your monthly report was downloaded.');
    } catch (error) { notifyError(error?.message || 'The report could not be generated.'); }
    finally { setPdfLoading(false); }
  };

  const metrics = selected?.metrics;
  const daily = useMemo(() => metrics?.daily || [], [metrics?.daily]);
  const status = selected?.status === 'partial' ? 'PARTIAL MONTH' : 'FINALIZED';
  const completionRate = metrics?.tasks?.completionRate;
  const rankTransitionText = metrics?.xp?.rankTransitions?.length
    ? metrics.xp.rankTransitions.map((item) => `${dateLabel(item.date)} · ${rankNames[item.from] || 'Unavailable'} → ${rankNames[item.to] || 'Unavailable'}`).join(' · ')
    : 'No Rank transitions recorded.';

  if (loading) return <PageLoadingSkeleton variant="monthly" label="Loading monthly analysis" />;
  if (pageError && !selected) return <div className="monthly-analysis-page"><header className="monthly-analysis-header"><div><p className="app-eyebrow">MY PROGRESS · PERFORMANCE HISTORY</p><h1>Monthly Analysis</h1><p>Review monthly reports saved for your current Progression Run.</p></div></header><section className="monthly-panel monthly-empty-state" role="alert"><AppIcon name="analysis" /><h2>Monthly Analysis is unavailable</h2><p>{pageError}</p><button className="button button--secondary" type="button" onClick={() => void loadPage()}>Retry</button></section></div>;
  if (!selected) return <div className="monthly-analysis-page"><header className="monthly-analysis-header"><div><p className="app-eyebrow">MY PROGRESS · PERFORMANCE HISTORY</p><h1>Monthly Analysis</h1><p>Review monthly reports saved for your current Progression Run.</p></div></header><section className="monthly-panel monthly-empty-state"><AppIcon name="analysis" /><h2>No monthly report is available yet</h2><p>Your report will appear when enough activity has been recorded for this Progression Run.</p></section></div>;

  return <div className="monthly-analysis-page">
    <header className="monthly-analysis-header"><div><p className="app-eyebrow">MY PROGRESS · PERFORMANCE HISTORY</p><h1>Monthly Analysis</h1><p>Measure your consistency. Understand your progress. Identify where you can improve.</p></div></header>
    {pageError && <div className="m25-inline-error" role="alert">{pageError} <button type="button" onClick={() => void loadPage()}>Retry</button></div>}

    <section className="monthly-controls" aria-label="Monthly analysis controls">
      <label><span>IST MONTH</span><select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>{months.map((item) => <option value={item.monthKey} key={item.monthKey}>{monthLabel(item.monthKey)}{item.status === 'partial' ? ' · Partial' : ''}</option>)}</select></label>
      <div className="monthly-controls__range"><span>REPORT COVERAGE · IST</span><strong>{dateLabel(selected.coverage.from)} — {dateLabel(selected.coverage.through)}</strong><small>{selected.status === 'partial' ? 'Current month · activity is still in progress.' : 'Finalized monthly period.'}</small></div>
      <span className={`monthly-period-status${selected.status === 'partial' ? ' is-partial' : ''}`}>{status}</span>
      <button className="button button--secondary monthly-export-button" type="button" onClick={() => void downloadPdf()} disabled={pdfLoading}>{pdfLoading ? <SkeletonLine width="short" label="Preparing PDF" /> : 'Download PDF'}</button>
    </section>
    <p className="monthly-run-note">Current Progression Run · {selected.coverage.aggregationVersion ? `Report version ${selected.coverage.aggregationVersion}` : 'Saved report'} · Comparisons are isolated to this run.</p>

    <nav className="monthly-section-nav" aria-label="Monthly analysis sections">{[['monthly-overview', 'Overview'], ['monthly-performance', 'Performance Trends'], ['monthly-progression', 'Recovery & Progression'], ['monthly-history', 'Detailed History'], ['monthly-comparison', 'Compare']].map(([id, label]) => <a href={`#${id}`} key={id} onClick={(event) => {
      const target = document.getElementById(id);
      if (!target) return;
      event.preventDefault();

      const navigation = event.currentTarget.closest('.monthly-section-nav');
      const navigationTop = Number.parseFloat(navigation ? window.getComputedStyle(navigation).top : '') || 0;
      const navigationHeight = navigation?.getBoundingClientRect().height || 0;
      const topbarBottom = document.querySelector('.app-topbar')?.getBoundingClientRect().bottom || 0;
      const targetTop = target.getBoundingClientRect().top;
      const visibleTop = Math.max(topbarBottom, navigationTop + navigationHeight) + 14;
      const scrollTop = (document.scrollingElement?.scrollTop ?? window.scrollY) + targetTop - visibleTop;
      window.scrollTo({ top: Math.max(0, scrollTop), behavior: reduceMotion ? 'auto' : 'smooth' });
      window.history.replaceState(null, '', `#${id}`);
    }}>{label}</a>)}</nav>

    <section className="monthly-major-section" id="monthly-overview" aria-labelledby="monthly-overview-title">
      <div className="monthly-major-heading"><div><p className="app-eyebrow">SECTION A · PERIOD SNAPSHOT</p><h2 id="monthly-overview-title">{monthLabel(selected.monthKey)} Overview</h2><p>Summary of persisted records from {dateLabel(selected.coverage.from)} through {dateLabel(selected.coverage.through)}.</p></div><span className={`monthly-period-status${selected.status === 'partial' ? ' is-partial' : ''}`}>{status}</span></div>
      {!selected.hasData && <p className="monthly-inline-note">No source records are available for this period. Missing values remain unavailable rather than being shown as zero.</p>}
      <div className="monthly-overview-grid">
        <Metric label="Task completion rate" value={number(completionRate, '%')} note={`${number(metrics.tasks.completed)} of ${number(metrics.tasks.scheduled)} completed`} tone="cyan" />
        <Metric label="Completed Tasks" value={number(metrics.tasks.completed)} note="Original scheduled Task occurrences" />
        <Metric label="Missed Tasks" value={number(metrics.tasks.missed)} note="Finalized scheduled dates only" tone="warning" />
        <Metric label="Qualified Discipline days" value={number(metrics.discipline.qualifyingDays)} note={`${number(metrics.discipline.nonQualifyingDays)} non-qualified · ${number(metrics.discipline.protectedDays)} protected`} />
        <Metric label="Net XP change" value={signed(metrics.xp.net)} note={`${number(metrics.xp.earned)} earned · ${number(metrics.xp.drained)} drained`} tone={Number(metrics.xp.net) < 0 ? 'warning' : 'cyan'} />
        <Metric label="Recovery Quests generated" value={number(metrics.recovery.generated)} note={`${number(metrics.recovery.completed)} completed · ${number(metrics.recovery.expired)} expired`} />
        <Metric label="Discipline Points earned" value={number(metrics.disciplinePoints.earned)} note={`${number(metrics.disciplinePoints.redeemed)} redeemed`} tone="cyan" />
        <Metric label="Grace Point change" value={signed(Number(metrics.gracePoints.added || 0) - Number(metrics.gracePoints.expiryDeductions || 0) - Number(metrics.gracePoints.thresholdDeductions || 0))} note={`${number(metrics.gracePoints.added)} added · ${number(metrics.gracePoints.expiryDeductions + metrics.gracePoints.thresholdDeductions)} deducted`} tone="violet" />
      </div>
      {!selected.detailedHistoryAvailable && <p className="monthly-retention-banner"><AppIcon name="clock" /><span><strong>Aggregate-only history.</strong> Task-level details expired at the IST retention boundary. Monthly totals remain available.</span></p>}
    </section>

    <section className="monthly-major-section" id="monthly-performance" aria-labelledby="monthly-performance-title"><div className="monthly-major-heading"><div><p className="app-eyebrow">SECTION B · DAILY ACTIVITY</p><h2 id="monthly-performance-title">Performance Trends</h2><p>Daily records use their saved IST business dates and occurrence snapshots.</p></div></div>
      <div className="monthly-charts-grid"><article className="monthly-chart-block monthly-chart-block--wide"><DailyPerformance daily={daily} /></article></div>
      <div className="monthly-rank-level-summary">
        <StatPair label="XP · starting → ending" first={number(metrics.xp.startingXp)} second={number(metrics.xp.endingXp)} />
        <StatPair label="Level · starting → ending" first={number(metrics.xp.startingLevel)} second={number(metrics.xp.endingLevel)} />
        <StatPair label="Rank · starting → ending" first={rankNames[metrics.xp.startingRank] || 'Data unavailable'} second={rankNames[metrics.xp.endingRank] || 'Data unavailable'} />
      </div>
    </section>

    <section className="monthly-major-section" id="monthly-progression" aria-labelledby="monthly-progression-title"><div className="monthly-major-heading"><div><p className="app-eyebrow">SECTION C · SYSTEM RECORDS</p><h2 id="monthly-progression-title">Recovery &amp; Progression</h2><p>Lifecycle and progression events persisted for this Progression Run.</p></div></div>
      <div className="monthly-secondary-charts">
        <Panel id="m25-recovery-panel" eyebrow="RECOVERY QUESTS" title="Quest outcomes"><div className="monthly-metrics-grid monthly-metrics-grid--compact"><Metric label="Generated" value={number(metrics.recovery.generated)} /><Metric label="Completed" value={number(metrics.recovery.completed)} tone="cyan" /><Metric label="Expired" value={number(metrics.recovery.expired)} tone="warning" /><Metric label="Threshold-cleared" value={number(metrics.recovery.thresholdCleared)} /></div><p className="monthly-inline-note">Quests and Forfeits are separate from original Task counts and Discipline qualification.</p></Panel>
        <Panel id="m25-discipline-panel" eyebrow="DISCIPLINE" title="Streak and qualification"><div className="monthly-metrics-grid monthly-metrics-grid--compact"><Metric label="Current / ending streak" value={`${number(metrics.discipline.currentStreak)} / ${number(metrics.discipline.endingStreak)}`} /><Metric label="Longest recorded streak" value={number(metrics.discipline.longestStreak)} tone="cyan" /><Metric label="Qualified days" value={number(metrics.discipline.qualifyingDays)} /><Metric label="Protected dates" value={number(metrics.discipline.protectedDays)} /></div><p className="monthly-inline-note">Pause-protected dates are not counted as failed or qualified Discipline days.</p></Panel>
        <Panel id="m25-wallet-panel" eyebrow="POINTS &amp; XP" title="Wallet and Rank movement"><div className="m25-balance-list"><StatPair label="Discipline Points · start → end" first={number(metrics.disciplinePoints.startingBalance)} second={number(metrics.disciplinePoints.endingBalance)} /><StatPair label="Recurring / Rank-entry DP" first={number(metrics.disciplinePoints.recurringAwarded)} second={number(metrics.disciplinePoints.rankEntryAwarded)} /><StatPair label="Grace Points · start → end" first={number(metrics.gracePoints.startingBalance)} second={number(metrics.gracePoints.endingBalance)} /><StatPair label="Levels lost to XP drain" first={number(metrics.xp.levelsLost)} second="—" /></div></Panel>
        <Panel id="m25-pause-panel" eyebrow="EMERGENCY PAUSE" title="Activation and protected-date history"><div className="m25-pause-overview"><Metric label="Activations in this IST month" value={number(metrics.emergencyPause.activations)} /><Metric label="Unique protected dates in this IST month" value={number(metrics.emergencyPause.protectedDates.length)} tone="cyan" /></div>
          {metrics.emergencyPause.records.length ? <div className="monthly-table-wrap"><table className="monthly-table"><thead><tr><th scope="col">Activated · IST</th><th scope="col">Selected duration</th><th scope="col">Actual end · IST</th><th scope="col">Actual duration</th></tr></thead><tbody>{metrics.emergencyPause.records.map((item, index) => <tr key={`${item.activatedAt}-${index}`}><td>{dateTimeLabel(item.activatedAt)}</td><td>{item.selectedDurationDays} days</td><td>{dateTimeLabel(item.actualEndAt || item.effectiveEndAt)}</td><td>{number(item.durationMinutes / 60)} hours</td></tr>)}</tbody></table></div> : <p className="monthly-empty">No Emergency Pause activation events are recorded for this month.</p>}
          <p className="monthly-inline-note">Protected dates are attributed to their own IST month, separately from the activation month: {metrics.emergencyPause.protectedDates.length ? metrics.emergencyPause.protectedDates.map(dateLabel).join(', ') : 'none recorded'}.</p></Panel>
      </div>
      <p className="monthly-inline-note">Rank transitions: {rankTransitionText}</p>
    </section>

    <section className="monthly-major-section" id="monthly-history" aria-labelledby="monthly-history-title"><div className="monthly-major-heading"><div><p className="app-eyebrow">SECTION D · RETAINED DETAIL</p><h2 id="monthly-history-title">Detailed Task History</h2><p>Task titles and Forfeits come from immutable occurrence snapshots.</p></div><span className="monthly-detail-tag">{selected.detailedHistoryAvailable ? 'DETAIL AVAILABLE' : 'AGGREGATE ONLY'}</span></div>
      {!selected.detailedHistoryAvailable ? <p className="monthly-retention-banner"><AppIcon name="clock" /><span><strong>Task detail is no longer retained.</strong> No Task rows are shown for this month; the aggregate report remains available.</span></p>
        : <><p className="monthly-inline-note">Detailed history expires {dateTimeLabel(selected.detailExpiresAt)}. The saved monthly aggregate remains available after that date.</p>{detailError && <p className="m25-inline-error" role="alert">{detailError}</p>}
          {detailLoading && !details.length ? <PageLoadingSkeleton variant="table" compact label="Loading retained Task history" /> : details.length ? <div className="monthly-table-wrap"><table className="monthly-table"><thead><tr><th scope="col">IST date</th><th scope="col">Cycle day</th><th scope="col">Task snapshot</th><th scope="col">Forfeit snapshot</th><th scope="col">Status</th></tr></thead><tbody>{details.map((item, index) => <tr key={`${item.date}-${item.cycleDay}-${index}`}><td>{dateLabel(item.date)}</td><td>{String(item.cycleDay).padStart(2, '0')}</td><td><strong>{item.title}</strong>{item.description && <small className="m25-detail-description">{item.description}</small>}</td><td><strong>{item.accountabilityAction?.title || 'Data unavailable'}</strong>{item.accountabilityAction?.description && <small className="m25-detail-description">{item.accountabilityAction.description}</small>}</td><td><span className={`m25-status m25-status--${item.status}`}>{item.status.replaceAll('-', ' ')}</span></td></tr>)}</tbody></table></div> : <p className="monthly-empty">No Task occurrences were recorded in this retained month.</p>}
          {detailCursor && <button className="button button--secondary m25-load-more" type="button" onClick={() => void loadMoreDetails()} disabled={detailLoading}>{detailLoading ? <SkeletonLine width="medium" label="Loading more Task history" /> : 'Load more Task history'}</button>}
        </>}
    </section>

    <Comparison months={months} firstMonth={firstMonth} secondMonth={secondMonth} setFirstMonth={setFirstMonth} setSecondMonth={setSecondMonth} comparison={comparison} loading={compareLoading} onCompare={() => void runComparison()} />

    <section className="monthly-retention-panel"><div><p className="app-eyebrow">DETAIL EXPIRY REMINDERS</p><h2>Keep your history in view</h2><p>Task details are retained for the current and immediately previous IST months. Their monthly summaries are preserved after detail expiry.</p></div>
      {reminders.length ? <ul className="monthly-reminder-list">{reminders.map((item) => <li key={`${item.monthKey}-${item.reminder}`}><AppIcon name="clock" /><span><strong>{item.status === 'due' ? 'Reminder' : 'Upcoming reminder'} · {item.reminder} before {monthLabel(item.monthKey)} detail expiry</strong><small>{item.status === 'due' ? 'Available now.' : `Scheduled for ${dateTimeLabel(item.remindAt)}.`} Detailed history expires {dateTimeLabel(item.expiresAt)}.</small></span></li>)}</ul> : <span className="monthly-reminder-empty">No retained Task detail is approaching expiry. Reminders appear at 7 days, 48 hours and 24 hours before expiry.</span>}
    </section>
  </div>;
}
