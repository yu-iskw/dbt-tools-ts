import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

/**
 * Opt-in Playwright config for short screen recordings (PR demos). Not used in CI.
 *
 * From `packages/web` after `pnpm build`:
 * `pnpm demo:reel`
 */
const webPackageDir = path.dirname(fileURLToPath(import.meta.url));
const e2ePort = Number(process.env.PLAYWRIGHT_E2E_PORT ?? '4173');
const e2eOrigin = `http://127.0.0.1:${e2ePort}`;

export default defineConfig({
  testDir: './e2e/demo',
  fullyParallel: false,
  forbidOnly: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: e2eOrigin,
    trace: 'off',
    ...devices['Desktop Chrome'],
    video: 'on',
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: `./node_modules/.bin/vite preview --host 127.0.0.1 --port ${e2ePort}`,
    cwd: webPackageDir,
    url: e2eOrigin,
    reuseExistingServer: process.env.GITHUB_ACTIONS !== 'true',
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: {} }],
});
