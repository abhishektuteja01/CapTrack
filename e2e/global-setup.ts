// e2e/global-setup.ts
// Creates a fresh user in the local Supabase and saves a signed-in browser session for the tests.

import fs from 'node:fs';
import { chromium, type FullConfig } from '@playwright/test';

export const E2E_USER = { email: `e2e-${Date.now()}@example.com`, password: `E2e-${Math.random().toString(36).slice(2)}A1` };

export default async function globalSetup(config: FullConfig) {
  const url = process.env.E2E_SUPABASE_URL!;
  const key = process.env.E2E_SECRET_KEY!;
  // Never create test users in a hosted project by accident.
  if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(url) && !process.env.E2E_ALLOW_REMOTE) {
    throw new Error(`Refusing to run e2e against ${url}. Use the local Supabase (npx supabase start).`);
  }

  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...E2E_USER, email_confirm: true, user_metadata: { display_name: 'E2E' } }),
  });
  if (!res.ok) throw new Error(`Couldn't create the test user: ${res.status} ${await res.text()}`);

  const baseURL = config.projects[0].use.baseURL!;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${baseURL}/login`);
  await page.getByLabel('Email').fill(E2E_USER.email);
  await page.getByLabel('Password').fill(E2E_USER.password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(/dashboard/, { timeout: 60_000 });
  fs.mkdirSync('e2e/.auth', { recursive: true });
  await page.context().storageState({ path: 'e2e/.auth/user.json' });
  await browser.close();
}
