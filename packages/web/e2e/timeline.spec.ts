import { test, expect, type Page } from '@playwright/test';

import seedManifest from './fixtures/dbt-artifacts/manifest_1.11.json' with { type: 'json' };
import seedRunResults from './fixtures/dbt-artifacts/run_results_1.11.json' with { type: 'json' };
import { getObjectProperty, setObjectProperty } from './helpers/json-record-access';
import { loadWorkspace, mockPreload } from './helpers/preload';

const SEARCH_TIMELINE_LABEL = 'Search timeline nodes';

type JsonRecord = Record<string, unknown>;

async function buildSeedAndSourceTimelineFixtures(): Promise<{
  manifest: JsonRecord;
  runResults: JsonRecord;
}> {
  const manifest = structuredClone(seedManifest) as JsonRecord & {
    nodes: Record<string, JsonRecord>;
    parent_map: Record<string, string[]>;
    child_map: Record<string, string[]>;
  };
  const runResults = structuredClone(seedRunResults) as JsonRecord & {
    results: JsonRecord[];
  };

  const cloneNode = (sourceId: string, overrides: JsonRecord) => {
    const source = getObjectProperty(manifest.nodes, sourceId);
    if (source == null || typeof source !== 'object') {
      throw new Error(`Missing manifest node: ${sourceId}`);
    }
    return { ...structuredClone(source as JsonRecord), ...overrides };
  };
  const cloneResult = (matcher: (entry: JsonRecord) => boolean, overrides: JsonRecord) => {
    const source = runResults.results.find(matcher);
    if (source == null) {
      throw new Error('Missing run result template');
    }
    return { ...structuredClone(source), ...overrides };
  };

  const sourceTestId = 'test.jaffle_shop.not_null_raw_customers_customer_id.synthetic_source';
  const sourceParentId = 'source.jaffle_shop.ecom.raw_customers';

  setObjectProperty(
    manifest.nodes,
    sourceTestId,
    cloneNode('test.jaffle_shop.not_null_stg_customers_customer_id.e2cfb1f9aa', {
      unique_id: sourceTestId,
      name: 'not_null_raw_customers_customer_id',
      path: 'models/staging/__sources.yml',
      original_file_path: 'models/staging/__sources.yml',
      attached_node: sourceParentId,
      depends_on: {
        macros: [],
        nodes: [sourceParentId],
      },
    }),
  );
  setObjectProperty(manifest.parent_map, sourceTestId, [sourceParentId]);
  const existingChildrenRaw = getObjectProperty(manifest.child_map, sourceParentId);
  const existingChildren = Array.isArray(existingChildrenRaw)
    ? (existingChildrenRaw as string[])
    : [];
  setObjectProperty(manifest.child_map, sourceParentId, [...existingChildren, sourceTestId]);

  runResults.results.push(
    cloneResult((entry) => entry.unique_id === 'model.jaffle_shop.stg_orders', {
      unique_id: 'seed.jaffle_shop.raw_orders',
      status: 'success',
      timing: [
        {
          name: 'compile',
          started_at: '2024-12-16T07:45:01.000Z',
          completed_at: '2024-12-16T07:45:01.050Z',
        },
        {
          name: 'execute',
          started_at: '2024-12-16T07:45:01.050Z',
          completed_at: '2024-12-16T07:45:02.000Z',
        },
      ],
      execution_time: 0.95,
    }),
    cloneResult(
      (entry) =>
        entry.unique_id === 'test.jaffle_shop.not_null_stg_customers_customer_id.e2cfb1f9aa',
      {
        unique_id: sourceTestId,
        status: 'pass',
        timing: [
          {
            name: 'compile',
            started_at: '2024-12-16T07:45:02.100Z',
            completed_at: '2024-12-16T07:45:02.200Z',
          },
          {
            name: 'execute',
            started_at: '2024-12-16T07:45:02.200Z',
            completed_at: '2024-12-16T07:45:02.900Z',
          },
        ],
        execution_time: 0.7,
      },
    ),
  );

  return { manifest, runResults };
}

async function loadWorkspaceWithSeedAndSourceTimeline(page: Page) {
  const fixtures = await buildSeedAndSourceTimelineFixtures();
  await page.route('**/api/manifest.json', (route) =>
    route.fulfill({
      body: JSON.stringify(fixtures.manifest),
      contentType: 'application/json',
    }),
  );
  await page.route('**/api/run_results.json', (route) =>
    route.fulfill({
      body: JSON.stringify(fixtures.runResults),
      contentType: 'application/json',
    }),
  );
  await page.goto('/');
  const workspaceNav = page.getByRole('navigation', {
    name: 'Workspace sections',
  });
  await expect(workspaceNav.getByRole('button', { name: 'Health' })).toBeEnabled({
    timeout: 30_000,
  });
}

test.describe('timeline workspace', () => {
  test.beforeEach(async ({ page }) => {
    await loadWorkspace(page);
    await page.getByRole('button', { name: 'Timeline', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Timeline' }).first()).toBeVisible();
  });

  test('shows execution timeline heading and canvas', async ({ page }) => {
    await expect(page.locator('.workspace-scaffold__inspector')).toHaveCount(0);
    await expect(page.getByText('Selected node')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Execution timeline' }).first()).toBeVisible();
    await expect(page.locator('.chart-frame canvas').first()).toBeVisible();
  });

  test('removes bottlenecks block and keeps search controls', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Bottlenecks' })).toHaveCount(0);
    await expect(page.getByLabel(SEARCH_TIMELINE_LABEL)).toBeVisible();
  });

  test('does not show a persistent empty inspector', async ({ page }) => {
    await expect(page.getByText('Select a node to inspect runtime evidence')).toHaveCount(0);
  });

  test('shows timezone to the left of the mode toggle in timestamps mode', async ({ page }) => {
    await page.getByRole('button', { name: 'Timestamps', exact: true }).click();
    const modeToggle = page.locator('.gantt-mode-toggle');
    const timezoneSelect = page.locator('.gantt-timezone-select');

    await expect(modeToggle).toBeVisible();
    await expect(timezoneSelect).toBeVisible();

    const toggleBox = await modeToggle.boundingBox();
    const timezoneBox = await timezoneSelect.boundingBox();

    expect(toggleBox).not.toBeNull();
    expect(timezoneBox).not.toBeNull();
    expect(timezoneBox!.x).toBeLessThan(toggleBox!.x);
  });

  test('dependency controls default to both at depth 2', async ({ page }) => {
    await expect(page.locator('.timeline-dependency-controls')).toBeVisible();
    await expect(page.getByText('Depth', { exact: true })).toBeVisible();
    await expect(page.getByText('2', { exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Both' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: 'Max' })).toBeVisible();
  });

  test('dependency neighborhood strip toggles with selection', async ({ page }) => {
    const selectedId = 'model.jaffle_shop.orders';
    await mockPreload(page);
    await page.goto(`/?view=timeline&selected=${encodeURIComponent(selectedId)}`);
    const workspaceNav = page.getByRole('navigation', {
      name: 'Workspace sections',
    });
    await expect(workspaceNav.getByRole('button', { name: 'Health' })).toBeEnabled({
      timeout: 30_000,
    });
    await expect(page.getByRole('heading', { name: 'Timeline' }).first()).toBeVisible();

    await page.getByRole('tab', { name: /Upstream/ }).click();
    await page.getByRole('button', { name: 'Decrease dependency depth' }).click();

    await expect(page.getByText(/timeline rows \(dependency neighborhood\)/i)).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole('button', { name: 'Show all rows' }).click();
    await expect(page.getByRole('button', { name: /Neighborhood only/ })).toBeVisible();

    await page.goto('/?view=timeline');
    await expect(page.getByText(/timeline rows \(dependency neighborhood\)/i)).toHaveCount(0);
  });
});

test('timeline type filtering explains hidden seed and source rows', async ({ page }) => {
  await loadWorkspaceWithSeedAndSourceTimeline(page);
  await page.getByRole('button', { name: 'Timeline', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Timeline' }).first()).toBeVisible();

  const seedTypeButton = page
    .locator('.gantt-legend__group')
    .filter({ hasText: 'Type' })
    .getByRole('button', { name: /seed/i });
  // Match dbt type "source" only; /source/i also matches "source_freshness".
  const sourceTypeButton = page
    .locator('.gantt-legend__group')
    .filter({ hasText: 'Type' })
    .getByRole('button', { name: /^source(\s|\()/i });

  await expect(seedTypeButton).toBeVisible();
  await expect(sourceTypeButton).toBeVisible();
  await expect(seedTypeButton).toHaveClass(/gantt-legend__item--active/);
  await expect(sourceTypeButton).toHaveClass(/gantt-legend__item--active/);

  await seedTypeButton.click();
  await sourceTypeButton.click();

  const typeHint = page.locator('.timeline-toolbar__hint');

  await expect(typeHint).toBeVisible();
  await expect(typeHint).toContainText('Showing types:');
  await expect(typeHint).toContainText('Hidden by type filter:');
  await expect(typeHint).toContainText('seed');
  await expect(typeHint).toContainText('source');
  await expect(seedTypeButton).not.toHaveClass(/gantt-legend__item--active/);
  await expect(sourceTypeButton).not.toHaveClass(/gantt-legend__item--active/);

  await page.getByRole('button', { name: 'Clear all filters' }).click();

  await expect(typeHint).toHaveCount(0);
  await expect(seedTypeButton).toHaveClass(/gantt-legend__item--active/);
  await expect(sourceTypeButton).toHaveClass(/gantt-legend__item--active/);
});
