// playwright.config.ts
// Browser tests against a local Supabase (`npx supabase start`) and the app on :3000.
// CI builds and starts the app; locally it reuses `npm run dev` if it's already running.

import { execSync } from 'node:child_process';
import { defineConfig, devices } from '@playwright/test';

/** URL and keys of the local Supabase, unless the environment already has them. */
function localSupabase() {
  if (process.env.E2E_SUPABASE_URL) return;
  let out = '';
  try {
    out = execSync('npx supabase status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    throw new Error('Local Supabase is not running. Start it with: npx supabase start');
  }
  const env = Object.fromEntries(
    out
      .split('\n')
      .map((l) => /^([A-Z_]+)="?(.*?)"?$/.exec(l.trim()))
      .filter((m): m is RegExpExecArray => Boolean(m))
      .map((m) => [m[1], m[2]])
  );
  process.env.E2E_SUPABASE_URL = env.API_URL;
  process.env.E2E_PUBLISHABLE_KEY = env.PUBLISHABLE_KEY ?? env.ANON_KEY;
  process.env.E2E_SECRET_KEY = env.SECRET_KEY ?? env.SERVICE_ROLE_KEY;
}
localSupabase();

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    storageState: 'e2e/.auth/user.json',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: process.env.CI ? 'npm run start' : 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.E2E_SUPABASE_URL!,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.E2E_PUBLISHABLE_KEY!,
      SUPABASE_SECRET_KEY: process.env.E2E_SECRET_KEY!,
    },
  },
});
