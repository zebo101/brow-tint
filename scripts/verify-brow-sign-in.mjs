// Run against a local server: node scripts/verify-brow-sign-in.mjs http://localhost:3015
// PLAYWRIGHT_MODULE may point to a shared Playwright installation.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.argv[2] || 'http://localhost:3015';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  page.setDefaultTimeout(15000);
  // Keep the user anonymous and intercept OAuth before any real account action.
  await page.route('**/api/auth/get-session', (route) =>
    route.fulfill({ json: null })
  );
  await page.route('**/api/config/get-configs', (route) =>
    route.fulfill({
      json: {
        code: 0,
        data: { google_auth_enabled: 'true', email_auth_enabled: 'false' },
      },
    })
  );
  let oauthRequests = 0;
  await page.route('**/api/auth/sign-in/social', (route) => {
    oauthRequests++;
    assert.equal(route.request().postDataJSON().provider, 'google');
    return route.fulfill({
      status: 400,
      json: { message: 'OAuth intercepted by regression test' },
    });
  });
  await page.goto(`${origin}/zh`, {
    waitUntil: 'domcontentloaded',
    timeout: 180000,
  });
  await page.locator('.brow-showcase__sample').first().tap();
  console.log('Sample clicked');
  const guideline = page.getByRole('dialog');
  console.log('Guidelines:', await guideline.innerText());
  await guideline.getByRole('button').last().tap();
  const confirm = page.getByRole('button', {
    name: '确认定位，选样本',
    exact: true,
  });
  await confirm.waitFor({ timeout: 60000 });
  await confirm.tap({ timeout: 60000 });
  await page.locator('.brow-catalog__grid button').first().tap();
  await page.getByRole('button', { name: '登录并生成', exact: true }).tap();
  console.log('Login shown');
  const google = page.getByRole('button', {
    name: '使用 Google 登录',
    exact: true,
    includeHidden: true,
  });
  await google.waitFor();
  console.log(
    'Layers:',
    await page
      .locator(
        '[role="dialog"], [data-slot="modal-backdrop"], [data-slot="drawer-overlay"]'
      )
      .evaluateAll((nodes) =>
        nodes.map((n) => ({
          slot: n.getAttribute('data-slot'),
          label: n.getAttribute('aria-label'),
          hidden: n.getAttribute('aria-hidden'),
          inert: !!n.closest('[inert]'),
          zIndex: getComputedStyle(n).zIndex,
          pointerEvents: getComputedStyle(n).pointerEvents,
        }))
      )
  );
  await google.tap({ timeout: 5000 });
  await page.waitForFunction(
    () =>
      document.body.innerText.includes('OAuth intercepted by regression test'),
    undefined,
    { timeout: 5000 }
  );
  assert.equal(oauthRequests, 1, 'Google button must start OAuth');
  await page
    .getByRole('button', { name: '取消', exact: true, includeHidden: true })
    .and(page.locator('[data-slot]'))
    .tap({ timeout: 5000 });
  await google.waitFor({ state: 'hidden' });
  assert.equal(
    await page.locator('.brow-editor-modal').count(),
    1,
    'Cancel retains the editor'
  );
  await page.getByRole('button', { name: '登录并生成', exact: true }).tap();
  await google.waitFor();
  await page
    .getByRole('button', { name: '取消', exact: true, includeHidden: true })
    .and(page.locator('[data-slot]'))
    .tap();
  console.log(
    'PASS: sample → mapping → style → Google request → cancel → reopen/cancel'
  );
} finally {
  await browser.close();
}
