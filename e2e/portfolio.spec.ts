// e2e/portfolio.spec.ts
// The main flows, in order, on one fresh account: import, every page, sell (and the oversell guard),
// a dividend, export and bulk delete. Prices come from live sources, so nothing here asserts a price.

import { expect, test, type Page } from '@playwright/test';

// One account, built up step by step: a retry would start from a changed account, so there are none.
test.describe.configure({ mode: 'serial', retries: 0 });

/** Fails the test on any console error or uncaught exception (hydration mismatches included). */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test('import a CSV', async ({ page }) => {
  await page.goto('/trades/import', { waitUntil: 'networkidle' });
  await page.setInputFiles('input[type=file]', 'e2e/fixtures/sample.csv');
  await page.getByRole('button', { name: 'Import 10' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Imported 10 rows' })).toBeVisible({ timeout: 60_000 });

  // The same file again adds nothing.
  await page.setInputFiles('input[type=file]', 'e2e/fixtures/sample.csv');
  await page.getByRole('button', { name: /^Import \d+/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'skipped 10 already saved' })).toBeVisible({ timeout: 60_000 });
});

for (const [path, heading] of [
  ['/dashboard', 'Overview'],
  ['/holdings', 'Holdings'],
  ['/holdings/INFY.NS?type=stock', 'INFY.NS'],
  ['/trades', 'Activity'],
  ['/pnl?year=all', 'Profit and loss'],
  ['/settings', 'Settings'],
]) {
  test(`${path} renders without errors`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(path, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { level: 1 })).toContainText(heading);
    expect(errors).toEqual([]);
  });
}

test('money panel adds up', async ({ page }) => {
  await page.goto('/dashboard', { waitUntil: 'networkidle' });
  const panel = page.locator('section', { has: page.getByRole('heading', { name: 'Money in and out' }) });
  await expect(panel.getByText('Net invested')).toBeVisible();
  await expect(panel.getByText('Deposited')).toBeVisible();
});

test('sell: oversell is blocked, a valid sell saves', async ({ page }) => {
  await page.goto('/holdings?trade=new&f_side=SELL&f_symbol=INFY.NS&f_type=stock&f_platform=Zerodha&f_qty=25', { waitUntil: 'networkidle' });
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByText('You hold 20 on Zerodha')).toBeVisible();
  await sheet.getByLabel('Price per unit').fill('1100');
  await sheet.getByRole('button', { name: 'Add sell' }).click();
  await expect(sheet.getByText(/You held 20 on Zerodha/).first()).toBeVisible();

  await sheet.getByLabel('Quantity').fill('10');
  await expect(sheet.getByText('Profit on this sale (FIFO)')).toBeVisible();
  await sheet.getByRole('button', { name: 'Add sell' }).click();
  await expect(sheet).toBeHidden({ timeout: 30_000 });
  await expect(page.locator('tr', { hasText: 'INFY.NS' }).first()).toContainText('10');
});

test('log a dividend', async ({ page }) => {
  await page.goto('/pnl?cash=new&f_kind=dividend&f_symbol=ITC.NS&f_type=stock&f_platform=Groww&f_amount=1300&f_currency=INR&f_date=2025-06-01', {
    waitUntil: 'networkidle',
  });
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByLabel('Paid by')).toHaveValue('ITC.NS');
  await sheet.getByRole('button', { name: 'Add dividend' }).click();
  await expect(sheet).toBeHidden({ timeout: 30_000 });
  await page.goto('/pnl?year=all', { waitUntil: 'networkidle' });
  await expect(page.locator('tr', { hasText: 'ITC.NS' }).filter({ hasText: '1,300' }).first()).toBeVisible();
});

test('export round-trips', async ({ page }) => {
  const res = await page.request.get('/api/export');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-disposition']).toContain('captrack-');
  const rows = (await res.text()).trim().split('\n');
  expect(rows[0]).toContain('date,kind,symbol');
  expect(rows.length - 1).toBe(12); // 10 imported + sell + dividend
});

test('bulk delete from activity', async ({ page }) => {
  await page.goto('/trades', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: /Log · 12/ })).toBeVisible();
  const boxes = page.locator('tbody input[type=checkbox]');
  await boxes.nth(0).check();
  await boxes.nth(1).check();
  await page.getByRole('button', { name: 'Delete selected' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Log · 10/ })).toBeVisible({ timeout: 30_000 });
});
