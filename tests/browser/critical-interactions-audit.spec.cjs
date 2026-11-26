const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { attachBrowserEventCapture, waitForPageContent } = require('./routeAuditHelper.cjs');

const baseUrl = () => process.env.PW_BASE_URL || 'http://localhost:5174';
const artifactsRoot = () => path.resolve(process.env.PW_ARTIFACTS_DIR || 'artifacts/stability-audit');

async function openRoute(page, route, heading) {
  await page.goto(new URL(route, baseUrl()).toString(), { waitUntil: 'domcontentloaded' });
  const pageContent = await waitForPageContent(page, heading, 15_000);
  await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => {});
  return pageContent;
}

async function check(results, name, callback) {
  try {
    results[name] = { status: 'passed', ...(await callback() || {}) };
  } catch (error) {
    results[name] = { status: 'failed', message: error?.message || String(error) };
  }
}

test('read-only critical interactions: leaderboard, reports, profile, task dialogs, discipline and pause', async ({ page }, testInfo) => {
  test.setTimeout(15 * 60 * 1000);
  const events = attachBrowserEventCapture(page);
  const root = path.join(artifactsRoot(), 'interactions', testInfo.project.name);
  const pdfDirectory = path.join(artifactsRoot(), 'pdf');
  fs.mkdirSync(root, { recursive: true });
  if (testInfo.project.name === 'desktop-chrome') fs.mkdirSync(pdfDirectory, { recursive: true });
  const results = { project: testInfo.project.name, viewport: testInfo.project.use.viewport, checks: {} };

  await check(results.checks, 'leaderboardCategoriesAndPodium', async () => {
    await openRoute(page, '/app/leaderboard', 'Community Leaderboard');
    const categories = ['Overall Ranking', 'Discipline Ranking', 'XP Ranking'];
    const selectedStates = [];
    for (const label of categories) {
      const tab = page.getByRole('tab', { name: label, exact: true });
      await tab.click();
      await expect(tab).toHaveAttribute('aria-selected', 'true');
      selectedStates.push(label);
    }
    const podiumVisible = await page.getByRole('heading', { name: 'Top three' }).isVisible().catch(() => false);
    const currentMemberMarkerCount = await page.locator('.leaderboard-podium__you, .leaderboard-member__you').count();
    const tiedPodium = await page.locator('.leaderboard-podium-grid--tied').count() > 0;
    return { selectedStates, podiumVisible, currentMemberMarkerCount, tiedPodium, tieDataAvailable: tiedPodium };
  });

  await check(results.checks, 'publicMemberProfileNavigationAndPrivacy', async () => {
    await openRoute(page, '/app/leaderboard', 'Community Leaderboard');
    const links = page.locator('#leaderboard-results a[href^="/app/profile/"]');
    await page.waitForFunction(() => {
      const results = document.querySelector('#leaderboard-results');
      return results && !results.innerText.includes('Loading standings');
    }, null, { timeout: 15_000 });
    const candidates = await links.evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href')));
    const publicHref = candidates.find((href) => {
      if (!href) return false;
      const segment = decodeURIComponent(href.split('/').filter(Boolean).at(-1) || '');
      return segment.length >= 3 && !/^[a-f\d]{24}$/i.test(segment);
    });
    if (!publicHref) return { status: 'blocked', reason: 'No publicHandle-based Leaderboard link was available.' };
    await page.locator(`a[href="${publicHref}"]`).first().click();
    await page.waitForURL(/\/app\/profile\/[^/]+$/);
    await page.locator('.leaderboard-public-profile h1').waitFor({ state: 'visible', timeout: 15_000 });
    const bodyText = await page.locator('body').innerText();
    const emailsVisible = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(bodyText);
    const internalIdLabelVisible = /(?:database|internal)\s+id/i.test(bodyText);
    return { profileRendered: true, emailsVisible, internalIdLabelVisible };
  });

  await check(results.checks, 'monthlyAnalysisSectionsAndHistory', async () => {
    await openRoute(page, '/app/monthly-analysis', 'Monthly Analysis');
    const pageError = await page.locator('.monthly-empty-state[role="alert"]').isVisible().catch(() => false);
    const monthSelect = page.locator('.monthly-controls select').first();
    const reportAvailable = await monthSelect.isVisible().catch(() => false);
    if (!reportAvailable) return { status: pageError ? 'unavailable' : 'unavailable', reason: pageError ? 'Monthly Analysis reported a data or service error.' : 'No saved monthly report is available.' };

    const navItems = ['Overview', 'Performance Trends', 'Recovery & Progression', 'Detailed History'];
    const sectionResults = [];
    for (const label of navItems) {
      const link = page.getByRole('navigation', { name: 'Monthly analysis sections' }).getByRole('link', { name: label, exact: true });
      await link.click();
      const sectionId = await link.getAttribute('href');
      const target = page.locator(sectionId);
      await expect.poll(async () => target.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const nav = document.querySelector('.monthly-section-nav')?.getBoundingClientRect();
        const topbar = document.querySelector('.app-topbar')?.getBoundingClientRect();
        const minTop = Math.max(nav?.bottom || 0, topbar?.bottom || 0);
        return rect.top >= minTop + 2;
      }), { timeout: 5_000 }).toBe(true);
      sectionResults.push(label);
    }

    const monthOptions = await monthSelect.locator('option').evaluateAll((options) => options.map((option) => ({ value: option.value, text: option.textContent.trim() })));
    const initialMonth = await monthSelect.inputValue();
    const otherMonth = monthOptions.find((option) => option.value && option.value !== initialMonth)?.value || null;
    let previousMonthLoaded = false;
    let aggregateOnlyAvailable = false;
    if (otherMonth) {
      await monthSelect.selectOption(otherMonth);
      await expect.poll(() => page.locator('.monthly-period-status').first().innerText(), { timeout: 8_000 }).not.toContain('Loading');
      previousMonthLoaded = true;
      aggregateOnlyAvailable = (await page.locator('.monthly-detail-tag').innerText().catch(() => '')).includes('AGGREGATE ONLY');
    }

    const comparisonSelects = page.locator('.m25-compare-controls select');
    let comparisonRendered = false;
    let comparisonAvailable = false;
    if (otherMonth && await comparisonSelects.count() === 2) {
      await comparisonSelects.nth(0).selectOption(initialMonth);
      await comparisonSelects.nth(1).selectOption(otherMonth);
      await page.getByRole('button', { name: 'Compare months', exact: true }).click();
      comparisonRendered = await page.locator('#monthly-comparison table').isVisible({ timeout: 10_000 }).catch(() => false);
      comparisonAvailable = comparisonRendered || await page.locator('#monthly-comparison [role="alert"]').isVisible().catch(() => false);
    }

    let normalPdf = null;
    let comparisonPdf = null;
    let aggregatePdf = null;
    if (testInfo.project.name === 'desktop-chrome') {
      const downloadPdf = async (filename) => {
        const button = page.getByRole('button', { name: 'Download PDF', exact: true });
        if (!(await button.isEnabled())) return null;
        const downloadPromise = page.waitForEvent('download', { timeout: 20_000 });
        await button.click();
        const download = await downloadPromise;
        const targetPath = path.join(pdfDirectory, filename);
        await download.saveAs(targetPath);
        return { path: targetPath, suggestedFilename: download.suggestedFilename() };
      };
      await monthSelect.selectOption(initialMonth);
      await expect(page.getByRole('button', { name: 'Download PDF', exact: true })).toBeEnabled();
      normalPdf = await downloadPdf('monthly-current.pdf');
      if (comparisonRendered) comparisonPdf = await downloadPdf('monthly-comparison.pdf');
      if (aggregateOnlyAvailable && otherMonth) {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.getByRole('heading', { name: 'Monthly Analysis' }).waitFor({ state: 'visible', timeout: 15_000 });
        const reloadedMonthSelect = page.locator('.monthly-controls select').first();
        await reloadedMonthSelect.selectOption(otherMonth);
        await expect(page.locator('.monthly-detail-tag')).toContainText('AGGREGATE ONLY');
        aggregatePdf = await downloadPdf('monthly-aggregate-only.pdf');
      }
    }
    return { pageError, sectionResults, monthOptions, initialMonth, otherMonth, previousMonthLoaded, aggregateOnlyAvailable, comparisonAvailable, comparisonRendered, pdf: { normalPdf, comparisonPdf, aggregatePdf } };
  });

  await check(results.checks, 'profileSettingsRefreshAndReturn', async () => {
    await openRoute(page, '/app/profile', 'Member Profile');
    const profileReady = await page.locator('.profile-identity').isVisible().catch(() => false);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Member Profile' }).waitFor({ state: 'visible', timeout: 15_000 });
    await openRoute(page, '/app/settings', 'Settings');
    const categories = ['Profile', 'Privacy & Visibility', 'Appearance', 'Notification Preferences', 'Account & Security', 'Accessibility'];
    const visitedCategories = [];
    for (const category of categories) {
      const button = page.getByRole('navigation', { name: 'Settings categories' }).getByRole('button', { name: category, exact: true });
      await button.click();
      await expect(button).toHaveAttribute('aria-current', 'page');
      visitedCategories.push(category);
    }
    await openRoute(page, '/app/dashboard', 'Today');
    await openRoute(page, '/app/settings', 'Settings');
    const settingsReady = await page.locator('.settings-content').isVisible().catch(() => false);
    const settingsEndpointCalls = events.apiTimings.filter((request) => request.url.endsWith('/leaderboard/profile-settings')).length;
    return { profileReady, settingsReady, visitedCategories, profileSettingsEndpointCalls: settingsEndpointCalls, settingsDataSource: 'Current preferences context; no settings save was submitted.' };
  });

  await check(results.checks, 'taskActionsAndSubmitProofDialog', async () => {
    await openRoute(page, '/app/tasks', 'Daily Tasks');
    const tasks = await page.locator('.task-list-item').count();
    const taskStatuses = await page.locator('.task-status').allTextContents();
    const scheduleEmpty = await page.locator('.daily-task-empty').isVisible().catch(() => false);
    const trigger = page.locator('.task-card__manage-trigger').first();
    const canOpenMenu = await trigger.isVisible().catch(() => false);
    let menuActions = [];
    if (canOpenMenu) {
      await trigger.click();
      const menu = page.getByRole('menu').first();
      await expect(menu).toBeVisible();
      menuActions = await menu.getByRole('menuitem').allTextContents();
      await page.keyboard.press('Escape');
      await expect(menu).toBeHidden();
    }
    const submitButton = page.getByRole('button', { name: 'Submit Proof', exact: true }).first();
    const submitAvailable = await submitButton.isVisible().catch(() => false);
    let optionalFields = false;
    if (submitAvailable) {
      await submitButton.click();
      const dialog = page.getByRole('dialog', { name: 'Submit proof' });
      await expect(dialog).toBeVisible();
      optionalFields = await dialog.getByText('Optional', { exact: true }).count() >= 2;
      await dialog.getByRole('button', { name: 'Close submission dialog' }).click();
      await expect(dialog).toBeHidden();
    }
    const controlsAvailable = canOpenMenu && submitAvailable;
    return {
      status: controlsAvailable ? 'passed' : 'unavailable',
      reason: controlsAvailable ? undefined : 'The current IST data did not expose both a scheduled Task action menu and an incomplete occurrence with Submit Proof; no Task state was changed to manufacture one.',
      visibleTaskCards: tasks,
      taskStatuses,
      scheduleEmpty,
      menuActions,
      submitAvailable,
      optionalFields,
      dialogClosedWithoutSubmitting: submitAvailable,
    };
  });

  await check(results.checks, 'disciplineActivityMapAndEmergencyPause', async () => {
    await openRoute(page, '/app/discipline', 'Discipline');
    const map = page.getByRole('group', { name: 'Last 365 calendar days of scheduled task activity' });
    await expect(map).toBeVisible();
    const cells = map.locator('button.discipline-activity__cell');
    const cellCount = await cells.count();
    const selected = map.locator('button.discipline-activity__cell.is-selected');
    await selected.click();
    const selectedDayText = await page.locator('.discipline-activity__detail').innerText();
    const historicalCell = map.locator('button.discipline-activity__cell:not(.is-selected):not([disabled])').first();
    let historicalDateSelected = false;
    if (await historicalCell.count()) {
      await historicalCell.click();
      historicalDateSelected = true;
      await historicalCell.focus();
    }
    const tooltipVisible = await page.getByRole('tooltip').isVisible().catch(() => false);
    const tooltipText = tooltipVisible ? await page.getByRole('tooltip').innerText() : '';
    const currentStatusVisible = /In Progress|Qualified|Protected/i.test(selectedDayText);
    await openRoute(page, '/app/dashboard', 'Today');
    const pauseControl = page.locator('.emergency-pause-control');
    const pauseAvailable = await pauseControl.isVisible().catch(() => false);
    const pauseStatus = pauseAvailable ? await pauseControl.innerText() : '';
    const activePause = /Emergency Pause Active/.test(pauseStatus);
    const allowanceVisible = /\d\s*\/\s*2 used this month/.test(pauseStatus);
    const rules = pauseControl.getByRole('button', { name: 'Pause Rules', exact: true });
    let rulesModalOpened = false;
    if (await rules.isVisible().catch(() => false)) {
      await rules.click();
      const dialog = page.getByRole('dialog', { name: /Emergency Pause/ });
      rulesModalOpened = await dialog.isVisible().catch(() => false);
      if (rulesModalOpened) await dialog.getByRole('button', { name: 'Close dialog' }).click();
    }
    return { activityCellCount: cellCount, historicalDateSelected, selectedDayStatusVisible: currentStatusVisible, tooltipVisible, tooltipIncludesEmergencyPause: /Emergency Pause/.test(tooltipText), pauseAvailable, activePause, allowanceVisible, rulesModalOpened, noPauseActionTriggered: true };
  });

  await check(results.checks, 'recoveryQuestAndGraceWalletReadOnly', async () => {
    await openRoute(page, '/app/recovery-quests', 'Recovery Quests');
    const cards = await page.locator('.recovery-quest-card').count();
    const activeCount = await page.locator('.recovery-quest-card[data-status="active"]').count();
    const graceSummary = await page.locator('.grace-point-summary, [aria-label*="Grace Point"]').count();
    const allFilter = page.getByRole('button', { name: 'All', exact: true });
    const filterAvailable = await allFilter.isVisible().catch(() => false);
    if (filterAvailable) await allFilter.click();
    const transactionHistoryVisible = await page.getByText(/Grace Point transactions|Transaction history/i).count() > 0;
    return { questCards: cards, activeQuestCards: activeCount, graceSummaryAvailable: graceSummary > 0, filterAvailable, transactionHistoryVisible, noQuestCompleted: true };
  });

  results.console = {
    errors: events.consoleErrors,
    warnings: events.consoleWarnings,
    pageErrors: events.pageErrors,
    failedRequests: events.failedRequests,
    expectedNavigationCancellations: events.failedRequests.filter((request) => /ERR_ABORTED|aborted/i.test(request.error)),
    unexpectedFailedRequests: events.failedRequests.filter((request) => !/ERR_ABORTED|aborted/i.test(request.error)),
    httpFailures: events.httpFailures,
    apiTimings: events.apiTimings,
  };
  fs.writeFileSync(path.join(root, 'critical-interactions.json'), `${JSON.stringify(results, null, 2)}\n`);
  await page.screenshot({ path: path.join(root, 'final-interaction-state.png'), fullPage: true, animations: 'disabled' }).catch(() => {});

  const hardFailures = Object.entries(results.checks).filter(([, result]) => result.status === 'failed');
  expect(hardFailures, 'Read-only interaction checks should not throw').toHaveLength(0);
});
