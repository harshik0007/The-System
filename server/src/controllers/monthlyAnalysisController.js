import PDFDocument from 'pdfkit';
import * as monthly from '../services/monthlyAnalysisService.js';
import { getIstDateKey } from '../utils/ist.js';

export async function getCurrent(request, response) {
  const summary = await monthly.getCurrentMonthlyAnalysis(request.user.id);
  response.status(200).json({ data: { summary } });
}

export async function getPrevious(request, response) {
  const summary = await monthly.getPreviousMonthlyAnalysis(request.user.id);
  response.status(200).json({ data: { summary } });
}

export async function getMonths(request, response) {
  response.status(200).json({ data: await monthly.getAvailableMonthlySummaries(request.user.id) });
}

export async function getSummary(request, response) {
  const summary = await monthly.getMonthlySummary(request.user.id, request.params.monthKey);
  response.status(200).json({ data: { summary } });
}

export async function getDetails(request, response) {
  const result = await monthly.getMonthlyDetails(request.user.id, request.params.monthKey, {
    limit: request.query.limit,
    cursor: request.query.cursor,
  });
  response.status(200).json({ data: result });
}

export async function compare(request, response) {
  response.status(200).json({ data: await monthly.compareMonthlySummaries(request.user.id, request.query.first, request.query.second) });
}

export async function getReminders(request, response) {
  response.status(200).json({ data: { reminders: await monthly.getMonthlyReminders(request.user.id) } });
}

function display(value, suffix = '') {
  return value === null || value === undefined || !Number.isFinite(Number(value)) ? 'Unavailable' : `${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}${suffix}`;
}

function addFooter(document, pageNumber) {
  // Keep footer text inside the printable page area. Writing below the bottom
  // margin makes PDFKit auto-create extra pages while the buffered page loop
  // is still running.
  const footerY = document.page.height - document.page.margins.bottom - 14;
  document.save();
  document.font('Helvetica').fontSize(8).fillColor('#647b92')
    .text(`THE SYSTEM · Generated ${getIstDateKey()} · IST`, 48, footerY, { width: 390, height: 10, lineBreak: false });
  document.text(`Page ${pageNumber}`, 460, footerY, { width: 90, height: 10, align: 'right', lineBreak: false });
  document.restore();
}

export async function downloadPdf(request, response) {
  const now = new Date();
  const monthKey = request.params.monthKey;
  const summary = await monthly.getMonthlySummary(request.user.id, monthKey, { now });
  const compareMonth = request.query.compare;
  let comparison = null;
  if (compareMonth) comparison = await monthly.compareMonthlySummaries(request.user.id, monthKey, compareMonth, { now });

  try {
    const document = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true, info: { Title: `THE SYSTEM Monthly Analysis · ${monthKey}`, Author: 'THE SYSTEM' } });
    const chunks = [];
    document.on('data', (chunk) => chunks.push(chunk));
    const bufferPromise = new Promise((resolve, reject) => {
      document.on('end', () => resolve(Buffer.concat(chunks)));
      document.on('error', reject);
    });
    const navy = '#0b1522';
    const cyan = '#44d9ed';
    const ink = '#152233';
    const rule = '#c8d3dc';
    const heading = (title) => {
      document.moveDown(0.9).font('Helvetica-Bold').fontSize(13).fillColor(ink).text(title);
      document.moveDown(0.25).strokeColor(cyan).lineWidth(1.5).moveTo(48, document.y).lineTo(547, document.y).stroke();
      document.moveDown(0.4);
    };
    const row = (label, value) => {
      document.font('Helvetica').fontSize(9).fillColor('#26384a').text(label, 54, document.y, { width: 265, continued: true });
      document.font('Helvetica-Bold').fillColor('#0b1522').text(String(value ?? 'Unavailable'), { width: 265, align: 'right' });
      document.moveDown(0.15).strokeColor(rule).lineWidth(0.35).moveTo(54, document.y).lineTo(541, document.y).stroke().moveDown(0.3);
    };
    document.rect(0, 0, document.page.width, 118).fill(navy);
    document.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20).text('THE SYSTEM', 48, 42);
    document.fillColor(cyan).font('Helvetica').fontSize(8).text('MONTHLY PERFORMANCE REPORT', 48, 72, { characterSpacing: 1.4 });
    document.fillColor('#b9c9d8').fontSize(9).text(`${monthKey} · ${summary.coverage.from} to ${summary.coverage.through} · IST`, 48, 91);
    document.y = 137;
    const generated = new Intl.DateTimeFormat('en-IN', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(now);
    document.fontSize(8).fillColor('#60758a').text(`Generated ${generated} · Current Progression Run`, { align: 'right' });
    heading('Task Performance');
    row('Original scheduled Task occurrences', display(summary.metrics.tasks.scheduled));
    row('Completed original Tasks', display(summary.metrics.tasks.completed));
    row('Missed / incomplete Tasks', `${display(summary.metrics.tasks.missed)} / ${display(summary.metrics.tasks.incomplete)}`);
    row('Task completion rate', display(summary.metrics.tasks.completionRate, '%'));
    heading('Discipline');
    row('Qualified / finalized non-qualified days', `${display(summary.metrics.discipline.qualifyingDays)} / ${display(summary.metrics.discipline.nonQualifyingDays)}`);
    row('Emergency Pause protected dates', display(summary.metrics.emergencyPause.protectedDates.length));
    row('Starting / ending streak', `${display(summary.metrics.discipline.startingStreak)} / ${display(summary.metrics.discipline.endingStreak)}`);
    row('Longest recorded streak in period', display(summary.metrics.discipline.longestStreak));
    heading('XP and Rank Progression');
    row('XP earned / drained / net', `${display(summary.metrics.xp.earned)} / ${display(summary.metrics.xp.drained)} / ${display(summary.metrics.xp.net)}`);
    row('Starting / ending Level', `${display(summary.metrics.xp.startingLevel)} / ${display(summary.metrics.xp.endingLevel)}`);
    row('Starting / ending Rank', `${monthly.rankLabel(summary.metrics.xp.startingRank) || 'Unavailable'} / ${monthly.rankLabel(summary.metrics.xp.endingRank) || 'Unavailable'}`);
    row('Rank transitions', summary.metrics.xp.rankTransitions.length ? summary.metrics.xp.rankTransitions.map((event) => `${event.date}: ${monthly.rankLabel(event.from)} to ${monthly.rankLabel(event.to)}`).join('; ') : 'None recorded');
    heading('Recovery and Grace Points');
    row('Recovery Quests generated', display(summary.metrics.recovery.generated));
    row('Completed / expired / threshold-cleared', `${display(summary.metrics.recovery.completed)} / ${display(summary.metrics.recovery.expired)} / ${display(summary.metrics.recovery.thresholdCleared)}`);
    row('Grace Points added / expiry deductions / threshold deductions', `${display(summary.metrics.gracePoints.added)} / ${display(summary.metrics.gracePoints.expiryDeductions)} / ${display(summary.metrics.gracePoints.thresholdDeductions)}`);
    heading('Discipline Points');
    row('DP earned / redeemed', `${display(summary.metrics.disciplinePoints.earned)} / ${display(summary.metrics.disciplinePoints.redeemed)}`);
    row('Recurring-cycle / Rank-entry DP', `${display(summary.metrics.disciplinePoints.recurringAwarded)} / ${display(summary.metrics.disciplinePoints.rankEntryAwarded)}`);
    row('Starting / ending DP balance', `${display(summary.metrics.disciplinePoints.startingBalance)} / ${display(summary.metrics.disciplinePoints.endingBalance)}`);
    heading('Emergency Pause');
    row('Pause activations in activation month', display(summary.metrics.emergencyPause.activations));
    row('Protected dates in this IST month', summary.metrics.emergencyPause.protectedDates.length ? summary.metrics.emergencyPause.protectedDates.join(', ') : 'None recorded');
    row('Selected duration / actual duration', summary.metrics.emergencyPause.records.length ? summary.metrics.emergencyPause.records.map((event) => `${event.selectedDurationDays}d / ${display(event.durationMinutes / 60, 'h')}`).join('; ') : 'No activation recorded');
    if (!summary.detailedHistoryAvailable) {
      document.moveDown(0.5).font('Helvetica-Oblique').fontSize(8).fillColor('#52677b').text('Detailed Task history has expired under the two-month retention rule. This report contains retained aggregate history only.');
    }
    if (comparison) {
      document.addPage();
      heading(`Comparison · ${comparison.first.monthKey} and ${comparison.second.monthKey}`);
      document.fontSize(8).fillColor('#60758a').text(`Coverage: ${comparison.first.coverage.from} to ${comparison.first.coverage.through} vs ${comparison.second.coverage.from} to ${comparison.second.coverage.through}. Increase is not necessarily improvement.`);
      document.moveDown(0.8);
      comparison.metrics.forEach((metric) => row(metric.label, `${display(metric.first)} to ${display(metric.second)} | Difference: ${display(metric.difference)}${metric.percentChange == null ? '' : ` (${display(metric.percentChange, '%')})`}`));
    }
    const range = document.bufferedPageRange();
    for (let index = range.start; index < range.start + range.count; index += 1) {
      document.switchToPage(index);
      addFooter(document, index + 1);
    }
    document.end();
    const buffer = await bufferPromise;
    response.set({ 'Content-Type': 'application/pdf', 'Content-Length': String(buffer.length), 'Content-Disposition': `attachment; filename="the-system-monthly-${monthKey}.pdf"`, 'Cache-Control': 'private, no-store' });
    response.status(200).send(buffer);
  } catch (error) { throw error; }
}
