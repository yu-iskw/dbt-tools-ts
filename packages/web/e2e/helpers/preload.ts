import path from 'path';
import { fileURLToPath } from 'url';

import { expect, type BrowserContext, type Page } from '@playwright/test';

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
const ARTIFACT_SOURCE_REFRESH_GLOB = '**/api/artifact-source/refresh';
const ARTIFACT_SOURCE_ACCEPT_GLOB = '**/api/artifact-source/accept-pending-run';

const REMOTE_RUN_1 = {
  runId: 'run-1',
  label: 'run-1',
  updatedAtMs: 1_000,
  versionToken: 'run-1',
} as const;

const REMOTE_RUN_2 = {
  runId: 'run-2',
  label: 'run-2',
  updatedAtMs: 2_000,
  versionToken: 'run-2',
} as const;

function remoteStatusWithPendingRun() {
  return {
    mode: 'remote' as const,
    currentSource: 'remote' as const,
    label: 'Remote E2E source',
    checkedAtMs: Date.now(),
    remoteProvider: 's3' as const,
    remoteLocation: 'S3 e2e-bucket/prefix',
    sourceKind: 's3' as const,
    locationDisplay: 'S3 e2e-bucket/prefix',
    pollIntervalMs: 300_000,
    currentRun: REMOTE_RUN_1,
    pendingRun: REMOTE_RUN_2,
    supportsSwitch: true,
    discoveryError: null,
    missingOptionalArtifacts: {
      missingCatalog: true,
      missingSources: true,
    },
  };
}

function remoteStatusAfterAccept() {
  return {
    ...remoteStatusWithPendingRun(),
    currentRun: REMOTE_RUN_2,
    pendingRun: null,
    supportsSwitch: false,
  };
}

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
    discoveryError: null,
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
    discoveryError: null,
    sourceKind: 'local' as const,
    locationDisplay: '/mock/solo',
    missingOptionalArtifacts: {
      missingCatalog: true,
      missingSources: true,
    },
  };
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
 * Mock POST discover + POST configure + artifact bytes.
 * Successful discover triggers auto-load in the UI.
 */
export async function registerSingleCandidateArtifactSourceMocks(
  page: Page,
  options?: {
    catalogPath?: string;
    sourcesPath?: string;
  },
): Promise<void> {
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

const GCS_MOCK_LOCATION_DISPLAY = 'GCS mock-bucket/mock-prefix';

const GCS_SOLO_RUN = {
  runId: 'gcsSoloRun',
  label: 'GCS (gcsSoloRun)',
  updatedAtMs: 13,
  versionToken: 'v-gcs-solo',
} as const;

function gcsSingleCandidateDiscoveryStatus() {
  return {
    sourceKind: 'gcs' as const,
    locationDisplay: GCS_MOCK_LOCATION_DISPLAY,
    discoveryError: null,
  };
}

function gcsSingleCandidatePostSwitchStatus() {
  return {
    mode: 'preload' as const,
    currentSource: 'preload' as const,
    label: 'Mock GCS single-run location',
    checkedAtMs: Date.now(),
    remoteProvider: null,
    remoteLocation: null,
    pollIntervalMs: null,
    currentRun: GCS_SOLO_RUN,
    pendingRun: null,
    supportsSwitch: false,
    discoveryError: null,
    sourceKind: 'gcs' as const,
    locationDisplay: GCS_MOCK_LOCATION_DISPLAY,
    missingOptionalArtifacts: {
      missingCatalog: true,
      missingSources: true,
    },
  };
}

async function registerGcsSingleCandidateConfigurePostRoute(page: Page): Promise<void> {
  await page.route(ARTIFACT_SOURCE_CONFIGURE_GLOB, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fulfill({ status: 405 });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(gcsSingleCandidatePostSwitchStatus()),
    });
  });
}

/**
 * GCS discover with impersonation; successful discover triggers auto-load in the UI.
 */
export async function registerGcsSingleCandidateWithImpersonationMocks(
  page: Page,
  options?: {
    catalogPath?: string;
    sourcesPath?: string;
  },
): Promise<void> {
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
      body: JSON.stringify(gcsSingleCandidateDiscoveryStatus()),
    });
  });
  await registerGcsSingleCandidateConfigurePostRoute(page);
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
export async function mockPreloadContext(context: BrowserContext): Promise<void> {
  await Promise.all(context.pages().map((p) => registerApiMocksOnPage(p)));
}

export async function mockPreload(
  page: Page,
  options?: {
    catalogPath?: string;
    sourcesPath?: string;
  },
): Promise<void> {
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
): Promise<void> {
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

/**
 * Remote preload with a pending newer run; supports refresh poll and accept-pending-run.
 */
export async function registerRemotePendingAcceptMocks(
  page: Page,
  options?: {
    catalogPath?: string;
    sourcesPath?: string;
  },
): Promise<void> {
  let accepted = false;

  const statusForRequest = () =>
    accepted ? remoteStatusAfterAccept() : remoteStatusWithPendingRun();

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
      body: JSON.stringify(statusForRequest()),
    });
  });

  await page.route(ARTIFACT_SOURCE_REFRESH_GLOB, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fulfill({ status: 405 });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(statusForRequest()),
    });
  });

  await page.route(ARTIFACT_SOURCE_ACCEPT_GLOB, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fulfill({ status: 405 });
      return;
    }
    accepted = true;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(remoteStatusAfterAccept()),
    });
  });

  await registerArtifactJsonByteRoutes(page, options);
}

/** Load workspace with remote pending-run mocks (see {@link registerRemotePendingAcceptMocks}). */
export async function loadRemoteWorkspaceWithPendingRun(
  page: Page,
  options?: {
    catalogPath?: string;
    sourcesPath?: string;
  },
): Promise<void> {
  await registerRemotePendingAcceptMocks(page, options);
  await page.goto('/');
  const workspaceNav = page.getByRole('navigation', {
    name: 'Workspace sections',
  });
  await expect(workspaceNav.getByRole('button', { name: 'Health' })).toBeEnabled({
    timeout: 30_000,
  });
  await expect(page.getByRole('region', { name: 'Remote update available' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Load latest remote run' })).toBeVisible();
}
