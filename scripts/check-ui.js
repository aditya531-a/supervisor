// Run with the dev server on port 5175:
// playwright-cli -s=jalsakshi run-code --filename=scripts/check-ui.js
// All API responses below are isolated browser fixtures; no account or database is changed.
async (page) => {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let authenticated = false;
  let rejectLogin = true;
  const profile = { id: 'supervisor-demo', email: 'supervisor@example.test', role: 'supervisor', team_id: 'team-demo', team_name: 'Riverside Demo District', dataMode: 'synthetic' };
  const timestamp = '2026-09-22T09:30:00.000Z';
  const names = ['Riverside community borewell', 'West ward public tap', 'School water storage tank', 'North village handpump'];
  const water_sources = names.map((name, index) => ({ id: `source-${index}`, name, locality: `Demo ward ${index + 1}`, team_id: profile.team_id, version: 1 }));
  const cases = names.map((_, index) => ({ id: `case000${index}-demo`, team_id: profile.team_id, source_id: `source-${index}`, screening_id: `sample-${index}`, origin: 'screening', status: index === 3 ? 'closed' : 'under_review', priority: ['critical', 'urgent', 'normal', 'normal'][index], created_at: timestamp, version: 1, closed_at: index === 3 ? timestamp : null, closure_reason: index === 3 ? 'Demo evidence reviewed and resolution recorded.' : null }));
  const screening_records = names.map((_, index) => ({ id: `sample-${index}`, source_id: `source-${index}`, sample_code: `DEMO-2026-00${index + 1}`, machine_suggestion: 'Elevated turbidity indicated. Laboratory review recommended.', human_observation: 'The field worker recorded cloudy water after rainfall. Follow-up sampling is needed.', screening_flag: 'flagged', captured_at: timestamp, created_by: 'worker-demo', capture_name: null }));
  const workspace = {
    profile, water_sources, cases, screening_records,
    lab_reports: [{ id: 'lab-demo', case_id: cases[0].id, source_id: 'source-0', screening_id: 'sample-0', report_number: 'DEMO-LAB-028', lab_name: 'District Water Laboratory', result: 'Turbidity recorded at 7.2 NTU. Verify the source report before making a decision.', file_name: 'demo-laboratory-report.pdf', file_sha256: 'a'.repeat(64), uploaded_at: timestamp, uploaded_by: profile.id, verification_status: 'uploaded', verified_at: null, verified_by: null, verification_note: null }],
    case_actions: [{ id: 'action-demo', case_id: cases[0].id, kind: 'referral', description: 'Sample referred to the district laboratory for confirmation.', performed_by: 'Demo field team', performed_at: timestamp, evidence_name: null }],
    retests: [], resident_communications: [],
    ivr_complaints: [{ id: 'complaint-demo', source_id: null, case_id: null, summary: 'Synthetic complaint: cloudy water reported at a community tap.', status: 'new', received_at: timestamp, version: 1 }],
    audit_log: [{ id: 'audit-demo', entity_id: cases[0].id, sequence: 1, occurred_at: timestamp, actor_id: profile.id, event: 'case.created', event_hash: 'b'.repeat(64), previous_hash: '', payload: { fixture: true } }],
  };
  await page.unroute('**/api/**');
  await page.route('**/api/**', async route => {
    const path = route.request().url().replace(/^https?:\/\/[^/]+/, '').split('?')[0];
    if (path === '/api/auth/session') return route.fulfill({ status: authenticated ? 200 : 401, json: authenticated ? profile : { error: 'Sign in required.' } });
    if (path === '/api/auth/login') {
      if (rejectLogin) return route.fulfill({ status: 401, json: { error: 'Check your email and password, then try again.' } });
      authenticated = true;
      return route.fulfill({ json: profile });
    }
    if (path === '/api/auth/logout') { authenticated = false; return route.fulfill({ json: { ok: true } }); }
    if (path === '/api/supervisor/workspace') return route.fulfill({ json: workspace });
    if (path === '/api/supervisor/export') return route.fulfill({ contentType: 'text/csv', body: 'data_mode,metric,count\nsynthetic,total_cases,4\n' });
    if (path === '/api/supervisor/rpc/verify_case_audit') return route.fulfill({ json: { valid: true } });
    return route.fulfill({ status: 400, json: { error: 'UI fixture: this mutation is intentionally not persisted.' } });
  });
  const ready = async () => {
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(image => image.decode().catch(() => {}))); });
  };
  const noOverflow = async label => {
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label}: horizontal overflow`);
  };
  const capture = async name => {
    await ready();
    await noOverflow(name);
    await page.screenshot({ path: `.impeccable/review/${name}.png`, fullPage: true, animations: 'disabled' });
  };
  const nav = label => page.getByRole('navigation', { name: 'Main navigation' }).getByText(label, { exact: true });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:5175/');
  await page.getByRole('heading', { name: 'Welcome back.' }).waitFor();
  await page.getByRole('button', { name: 'Pause water animation' }).click();
  assert(await page.locator('.water-scene__orb').evaluate(element => getComputedStyle(element).animationPlayState === 'paused'), 'Pause must stop the animation');
  await page.getByRole('button', { name: 'Play water animation' }).click();
  assert(await page.locator('.water-scene__orb').evaluate(element => getComputedStyle(element).animationPlayState === 'running'), 'Play must resume the animation');
  await capture('auth-desktop');
  await page.getByLabel('Password', { exact: true }).fill('local-ui-check');
  await page.getByRole('button', { name: 'Show password' }).click();
  assert(await page.getByLabel('Password', { exact: true }).getAttribute('type') === 'text', 'Password visibility toggle failed');
  await page.getByRole('button', { name: 'Hide password' }).click();
  await page.getByLabel('Email address').fill(profile.email);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Check your email' }).waitFor();
  assert(await page.getByLabel('Email address').inputValue() === profile.email, 'Failed login must retain the email');

  await page.setViewportSize({ width: 390, height: 844 });
  await capture('auth-mobile');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert(await page.locator('.water-scene__orb').evaluate(element => getComputedStyle(element).animationName === 'none'), 'Reduced motion must stop spatial animation');
  assert(await page.getByRole('button', { name: 'Pause water animation' }).count() === 0, 'Reduced motion should hide unnecessary motion control');
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  rejectLogin = false;
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('heading', { name: 'Your district, in focus.' }).waitFor();
  await capture('overview-mobile');
  await page.setViewportSize({ width: 1440, height: 900 });
  await capture('overview-desktop');
  assert(await page.locator('.overview-stats strong').allTextContents().then(values => values.join(',')) === '3,2,1,1', 'Overview counts must match fixture records');
  await page.getByRole('button', { name: 'Refresh workspace' }).click();
  await page.getByRole('button', { name: 'Refresh workspace' }).waitFor({ state: 'visible' });
  await page.locator('.attention-list button').first().click();
  await page.getByRole('heading', { name: names[0], exact: true }).waitFor();
  assert(await page.getByRole('button', { name: 'Close case — evidence missing' }).isDisabled(), 'Unverified evidence must not enable closure');
  await capture('cases-desktop');
  const tabs = page.getByRole('navigation', { name: 'Case sections' });
  await tabs.getByRole('button', { name: 'Lab reports' }).click();
  await page.getByRole('heading', { name: 'Upload laboratory report' }).waitFor();
  await tabs.getByRole('button', { name: 'Actions', exact: true }).click();
  await page.getByRole('heading', { name: 'Record completed action or referral' }).waitFor();
  await tabs.getByRole('button', { name: 'Retests' }).click();
  await page.getByRole('heading', { name: 'Request follow-up sampling' }).waitFor();
  await tabs.getByRole('button', { name: 'Residents' }).click();
  await page.getByRole('heading', { name: 'Log an actual resident update' }).waitFor();
  await tabs.getByRole('button', { name: 'History' }).click();
  await page.getByRole('button', { name: 'Verify history' }).click();
  await page.getByRole('status').filter({ hasText: 'Hash chain verified.' }).waitFor();
  await tabs.getByRole('button', { name: 'Evidence', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await capture('cases-mobile');
  await page.getByRole('button', { name: 'Back to queue' }).click();
  await page.getByLabel('Search cases').fill('does-not-exist');
  await page.getByText('No cases match these filters.').waitFor();
  await page.getByLabel('Search cases').fill('');
  await page.locator('.board-filters select').nth(0).selectOption('closed');
  assert(await page.locator('.queue-row').count() === 1, 'Closed filter must show one fixture case');
  await page.locator('.board-filters select').nth(0).selectOption('under_review');
  await page.locator('.board-filters select').nth(1).selectOption('critical');
  assert(await page.locator('.queue-row').count() === 1, 'Priority filter must narrow the queue');
  await nav('Reports').click();
  await page.getByRole('heading', { name: 'Current team activity' }).waitFor();
  await capture('reports-mobile');
  await page.setViewportSize({ width: 1440, height: 900 });
  await capture('reports-desktop');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export aggregate CSV' }).click();
  assert((await downloadEvent).suggestedFilename() === 'jalsakshi-safe-summary.csv', 'CSV export must retain its filename');
  for (const [width, height] of [[375,812], [768,1024], [1024,768], [844,390]]) {
    await page.setViewportSize({ width, height });
    for (const screen of ['Overview', 'Cases', 'Reports']) { await nav(screen).click(); await noOverflow(`${screen} ${width}×${height}`); }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await nav('Overview').click();
  assert(errors.length === 0, `Browser runtime errors: ${errors.join('; ')}`);
  console.log('UI checks passed: responsive layouts, login error and success, motion controls, reduced motion, real record counts, case tabs, filtering, closure guard, CSV export; no runtime errors.');
}
