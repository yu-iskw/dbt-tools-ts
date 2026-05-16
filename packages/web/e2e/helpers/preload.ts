import { expect, type BrowserContext, type Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const MANIFEST_PATH = path.resolve(
  __dirname,
  '../fixtures/dbt-artifacts/manifest_1.11.json',
);
export const RUN_RESULTS_PATH = path.resolve(
  __dirname,
  '../fixtures/dbt-artifacts/run_results_1.11.json',
);
export const CATALOG_PATH = path.resolve(__dirname, '../fixtures/dbt-artifacts/catalog_1.11.json');
export const SOURCES_PATH = path.resolve(__dirname, '../fixtures/sources.json');

const ARTIFACT_SOURCE_ROUTE_GLOB = '**/api/artifact-source';
const ARTIFACT_SOURCE_DISCOVER_GLOB = '**/api/artifact-source/discover';
const ARTIFACT_SOURCE_CONFIGURE_GLOB = '**/api/artifact-source/configure';
const ARTIFACT_SOURCE_PATH = '/api/artifact-source';

function managedPreloadStatus() {
  return {
    mode: 'preload',
    currentSource: 'preload',
    label: 'Live target',
    checkedAtMs: 1,
    remoteProvider: null,
    remoteLocation: null,
    pollIntervalMs: null,
    currentRun: null,
    pendingRun: null,
    supportsSwitch: false,
    sourceKind: 'local',
    locationDisplay: '/e2e/mock/target',
  };
}

const MULTI_CANDIDATE_RUN_ALPHA = {
  runId: 'runAlpha',
  label: 'Local (runAlpha)',
  updatedAtMs: 10,
  versionToken: 'v-alpha',
} as const;

const MULTI_CANDIDATE_RUN_BETA = {
  runId: 'runBeta',
  label: 'Local (runBeta)',
  updatedAtMs: 11,
  versionToken: 'v-beta',
} as const;

function multiCandidateDiscoveryStatus() {
  return {
    sourceKind: 'local' as const,
    locationDisplay: '/mock/multi',
    candidates: [MULTI_CANDIDATE_RUN_ALPHA, MULTI_CANDIDATE_RUN_BETA],
    needsSelection: true,
    discoveryError: null,
  };
}

function managedNoneStatus() {
  return {
    mode: 'none' as const,
    currentSource: null,
    label: 'Waiting for artifacts',
    checkedAtMs: Date.now(),
    remoteProvider: null,
    remoteLocation: null,
    pollIntervalMs: null,
    currentRun: null,
    pendingRun: null,
    supportsSwitch: false,
    needsSelection: false,
    discoveryError: null,
    candidates: undefined,
    sourceKind: null,
    locationDisplay: null,
    missingOptionalArtifacts: undefined,
  };
}

const SOLO_RUN = {
  runId: 'soloRun',
  label: 'Local (soloRun)',
  updatedAtMs: 12,
  versionToken: 'v-solo',
} as const;

function singleCandidateDiscoveryStatus() {
  return {
    sourceKind: 'local' as const,
    locationDisplay: '/mock/solo',
    candidates: [SOLO_RUN],
    needsSelection: false,
    discoveryError: null,
  };
}

function singleCandidatePostSwitchStatus() {
  return {
    mode: 'preload' as const,
    currentSource: 'preload' as const,
    label: 'Mock single-run location',
    checkedAtMs: Date.now(),
    remoteProvider: null,
    remoteLocation: null,
    pollIntervalMs: null,
    currentRun: SOLO_RUN,
    pendingRun: null,
    supportsSwitch: false,
    needsSelection: false,
    discoveryError: null,
    candidates: [SOLO_RUN],
    sourceKind: 'local' as const,
    locationDisplay: '/mock/solo',
    missingOptionalArtifacts: {
      missingCatalog: true,
      missingSources: true,
    },
  };
}

function multiCandidatePostSwitchStatus(runId: string) {
  const currentRun =
    runId === MULTI_CANDIDATE_RUN_BETA.runId ? MULTI_CANDIDATE_RUN_BETA : MULTI_CANDIDATE_RUN_ALPHA;
  return {
    mode: 'preload' as const,
    currentSource: 'preload' as const,
    label: 'Mock multi-run location',
    checkedAtMs: Date.now(),
    remoteProvider: null,
    remoteLocation: null,
    pollIntervalMs: null,
    currentRun,
    pendingRun: null,
    supportsSwitch: false,
    needsSelection: false,
    discoveryError: null,
    candidates: [MULTI_CANDIDATE_RUN_ALPHA, MULTI_CANDIDATE_RUN_BETA],
    sourceKind: 'local' as const,
    locationDisplay: '/mock/multi',
    missingOptionalArtifacts: {
      missingCatalog: true,
      missingSources: true,
    },
  };
}

async function registerMultiRunConfigurePostRoute(page: Page): Promise<void> {
  await page.route(ARTIFACT_SOURCE_CONFIGURE_GLOB, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fulfill({ status: 405 });
      return;
    }
    let runId = '';
    try {
      const body = route.request().postDataJSON() as { runId?: unknown };
      if (typeof body.runId === 'string') runId = body.runId;
    } catch {
      runId = '';
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(multiCandidatePostSwitchStatus(runId)),
    });
  });
}

async function registerArtifactSourceManagedNoneGetRoute(page: Page): Promise<void> {
  await page.route(ARTIFACT_SOURCE_ROUTE_GLOB, async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname !== ARTIFACT_SOURCE_PATH) {
      await route.continue();
      return;
    }
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(managedNoneStatus()),
    });
  });
}

/** Fulfill managed + legacy artifact JSON byte routes (use with configure/switch mocks). */
async function registerArtifactJsonByteRoutes(
  page: Page,
  options?: {
    catalogPath?: string;
    sourcesPath?: string;
  },
) {
  await page.route('**/api/artifacts/current/manifest.json', (route) =>
    route.fulfill({ path: MANIFEST_PATH, contentType: 'application/json' }),
  );
  await page.route('**/api/artifacts/current/run_results.json', (route) =>
    route.fulfill({ path: RUN_RESULTS_PATH, contentType: 'application/json' }),
  );
  await page.route('**/api/artifacts/current/catalog.json', (route) =>
    options?.catalogPath
      ? route.fulfill({
          path: options.catalogPath,
          contentType: 'application/json',
        })
      : route.fulfill({ status: 404 }),
  );
  await page.route('**/api/artifacts/current/sources.json', (route) =>
    options?.sourcesPath
      ? route.fulfill({
          path: options.sourcesPath,
          contentType: 'application/json',
        })
      : route.fulfill({ status: 404 }),
  );
  await page.route('**/api/manifest.json', (route) =>
    route.fulfill({ path: MANIFEST_PATH, contentType: 'application/json' }),
  );
  await page.route('**/api/run_results.json', (route) =>
    route.fulfill({ path: RUN_RESULTS_PATH, contentType: 'application/json' }),
  );
  await page.route('**/api/catalog.json', (route) =>
    options?.catalogPath
      ? route.fulfill({
          path: options.catalogPath,
          contentType: 'application/json',
        })
      : route.fulfill({ status: 404 }),
  );
  await page.route('**/api/sources.json', (route) =>
    options?.sourcesPath
      ? route.fulfill({
          path: options.sourcesPath,
          contentType: 'application/json',
        })
      : route.fulfill({ status: 404 }),
  );
}

/**
 * Mock POST discover (two candidates, needs selection) + POST configure + artifact bytes.
 * Register before `goto("/")`. GET `/api/artifact-source` returns `mode: "none"` so the
 * client does not fall through to legacy manifest URLs while artifact byte routes are mocked.
 */
export async function registerMultiCandidateArtifactSourceMocks(
  page: Page,
  options?: {
    catalogPath?: string;
    sourcesPath?: string;
  },
) {
  await page.route(ARTIFACT_SOURCE_DISCOVER_GLOB, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fulfill({ status: 405 });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(multiCandidateDiscoveryStatus()),
    });
  });
  await registerMultiRunConfigurePostRoute(page);
  await registerArtifactSourceManagedNoneGetRoute(page);
  await registerArtifactJsonByteRoutes(page, options);
}

/**
 * Mock POST discover (one candidate, no selection step) + POST configure + artifact bytes.
 * Discover triggers auto-load in the UI when needsSelection is false.
 */
export async function registerSingleCandidateArtifactSourceMocks(
  page: Page,
  options?: {
    catalogPath?: string;
    sourcesPath?: string;
  },
) {
  await page.route(ARTIFACT_SOURCE_DISCOVER_GLOB, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fulfill({ status: 405 });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(singleCandidateDiscoveryStatus()),
    });
  });
  await page.route(ARTIFACT_SOURCE_CONFIGURE_GLOB, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fulfill({ status: 405 });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(singleCandidatePostSwitchStatus()),
    });
  });
  await registerArtifactSourceManagedNoneGetRoute(page);
  await registerArtifactJsonByteRoutes(page, options);
}

export const GCS_MOCK_IMPERSONATION_SA = 'e2e-impersonation@test.iam.gserviceaccount.com';

function gcsMultiCandidateDiscoveryStatus() {
  return {
    sourceKind: 'gcs' as const,
    locationDisplay: 'GCS mock-bucket/mock-prefix',
    candidates: [MULTI_CANDIDATE_RUN_ALPHA, MULTI_CANDIDATE_RUN_BETA],
    needsSelection: true,
    discoveryError: null,
  };
}

/**
 * Like {@link registerMultiCandidateArtifactSourceMocks}, but asserts GCS discover requests
 * include {@link GCS_MOCK_IMPERSONATION_SA} in `options.impersonatedServiceAccount`.
 */
export async function registerGcsMultiCandidateArtifactSourceMocks(
  page: Page,
  options?: {
    catalogPath?: string;
    sourcesPath?: string;
  },
) {
  await page.route(ARTIFACT_SOURCE_DISCOVER_GLOB, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fulfill({ status: 405 });
      return;
    }
    const body = route.request().postDataJSON() as {
      type?: unknown;
      options?: { impersonatedServiceAccount?: unknown };
    };
    expect(body.type).toBe('gcs');
    expect(body.options).toEqual({ impersonatedServiceAccount: GCS_MOCK_IMPERSONATION_SA });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(gcsMultiCandidateDiscoveryStatus()),
    });
  });
  await registerMultiRunConfigurePostRoute(page);
  await registerArtifactSourceManagedNoneGetRoute(page);
  await registerArtifactJsonByteRoutes(page, options);
}

/** Register `/api/*` mocks on a single page (reliable with Vite preview; use before `goto`). */
async function registerApiMocksOnPage(
  page: Page,
  options?: {
    catalogPath?: string;
    sourcesPath?: string;
  },
) {
  await page.route(ARTIFACT_SOURCE_ROUTE_GLOB, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fulfill({ status: 405 });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(managedPreloadStatus()),
    });
  });
  await registerArtifactJsonByteRoutes(page, options);
}

/**
 * Attach mocks to every {@link Page} already attached to the context.
 * New pages created later still need {@link mockPreload} before their first app navigation.
 */
export async function mockPreloadContext(context: BrowserContext) {
  await Promise.all(context.pages().map((p) => registerApiMocksOnPage(p)));
}

export async function mockPreload(
  page: Page,
  options?: {
    catalogPath?: string;
    sourcesPath?: string;
  },
) {
  await registerApiMocksOnPage(page, options);
}

/**
 * Navigate to "/" with preload mocked, then wait until the workspace is ready
 * (sidebar nav buttons enabled = analysis successfully loaded).
 */
export async function loadWorkspace(
  page: Page,
  options?: {
    catalogPath?: string;
    sourcesPath?: string;
  },
) {
  await registerApiMocksOnPage(page, options);
  await page.goto('/');
  const workspaceNav = page.getByRole('navigation', {
    name: 'Workspace sections',
  });
  await expect(workspaceNav.getByRole('button', { name: 'Health' })).toBeEnabled({
    timeout: 30_000,
  });
  await expect(page.getByRole('main').getByRole('heading').first()).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.locator('.error-banner')).toHaveCount(0);
}
