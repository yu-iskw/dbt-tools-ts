import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

/** Directory containing this config (always use for preview so `dist/` resolves correctly). */
const webPackageDir = path.dirname(fileURLToPath(import.meta.url));

/** Preview port; override if 4173 is already taken locally (e.g. another `vite preview`). */
const e2ePort = Number(process.env.PLAYWRIGHT_E2E_PORT ?? '4173');
const e2eOrigin = `http://127.0.0.1:${e2ePort}`;

export default defineConfig({
  testDir: './e2e',
  /** Opt-in screen recordings live under `e2e/demo/` (see `playwright.demo.config.ts`). */
  testIgnore: ['**/demo/**'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // One retry keeps CI resilient without tripling wall time on every flake (was 2).
  retries: process.env.CI ? 1 : 0,
  // Fixed CI parallelism keeps the single vite preview process predictable; raise after profiling.
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['line']] : 'html',
  use: {
    baseURL: e2eOrigin,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `./node_modules/.bin/vite preview --host 127.0.0.1 --port ${e2ePort}`,
    cwd: webPackageDir,
    url: e2eOrigin,
    // Prefer GITHUB_ACTIONS over CI: some environments set CI=1 for other tooling,
    // which would forbid reuse and collide with an already-running `vite preview`.
    reuseExistingServer: process.env.GITHUB_ACTIONS !== 'true',
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
