import { test, expect } from '@playwright/test';

import { loadWorkspace } from './helpers/preload';

const OPEN_IN_TIMELINE_LABEL = 'Open in Timeline';
const OPEN_IN_INVENTORY_LABEL = 'Open in Inventory';
const RESULTS_TABLE_ROW = '.results-table__row';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test.describe('runs workspace', () => {
  test.beforeEach(async ({ page }) => {
    await loadWorkspace(page);
    await page.getByRole('button', { name: 'Runs', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Runs' }).first()).toBeVisible();
  });

  test('shows unified evidence table and filters', async ({ page }) => {
    await expect(page.getByText('Execution and quality evidence')).toBeVisible();
    await expect(page.locator('.workspace-scaffold__leading')).toHaveCount(0);
    await expect(page.locator('.workspace-scaffold__inspector')).toHaveCount(0);
    await expect(page.getByPlaceholder('Filter by name, type, status, thread…')).toBeVisible();
    await expect(page.locator('.results-table__header')).toContainText(
      /Item.*Type.*Materialization.*Status.*Duration.*Thread/s,
    );
  });

  test('shows expected facets', async ({ page }) => {
    for (const label of [
      'All',
      'Models',
      'Tests',
      'Seeds',
      'Snapshots',
      'Operations',
      'Healthy',
      'Warnings',
      'Errors',
    ]) {
      await expect(page.getByRole('button', { name: new RegExp(label) }).first()).toBeVisible();
    }
  });

  test('selecting a row shows inline selection actions', async ({ page }) => {
    await expect(page.locator(RESULTS_TABLE_ROW).first()).toBeVisible();
    await page.locator(RESULTS_TABLE_ROW).first().click();
    await expect(page.getByText('Selected run item')).toBeVisible();
    await expect(page.getByText(OPEN_IN_TIMELINE_LABEL)).toBeVisible();
    await expect(page.getByText(OPEN_IN_INVENTORY_LABEL)).toBeVisible();
  });
});

test.describe('runs quick jump navigation', () => {
  const MODEL_UNIQUE_ID = 'model.jaffle_shop.stg_orders';

  test.beforeEach(async ({ page }) => {
    await loadWorkspace(page);
    await page.getByRole('button', { name: 'Runs', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Runs' }).first()).toBeVisible();
    await page.getByRole('button', { name: /^Models \(\d+\)$/ }).click();
    await page.getByPlaceholder('Filter by name, type, status, thread…').fill('stg_orders');
    const modelRow = page
      .locator(RESULTS_TABLE_ROW)
      .filter({ hasText: /stg_orders/i })
      .first();
    await expect(modelRow).toBeVisible({ timeout: 15_000 });
    await modelRow.click();
    await expect(page.getByText('Selected run item')).toBeVisible();
    await expect(
      page.getByRole('button', {
        name: OPEN_IN_INVENTORY_LABEL,
        exact: true,
      }),
    ).toBeEnabled();
  });

  test('Open in Timeline navigates to timeline with selected execution', async ({ page }) => {
    await page.getByRole('button', { name: OPEN_IN_TIMELINE_LABEL, exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Timeline' }).first()).toBeVisible();
    await expect(page).toHaveURL(/[?&]view=timeline/);
    await expect(page).toHaveURL(new RegExp(`[?&]selected=${escapeRegExp(MODEL_UNIQUE_ID)}`));
  });

  test('Open in Inventory navigates to inventory summary for resource', async ({ page }) => {
    await page.getByRole('button', { name: OPEN_IN_INVENTORY_LABEL, exact: true }).click();
    await expect(page).toHaveURL(/[?&]view=inventory/);
    await expect(page).toHaveURL(new RegExp(`[?&]resource=${escapeRegExp(MODEL_UNIQUE_ID)}(&|$)`));
    await expect(page).toHaveURL(/[?&]assetTab=summary/);
    const summaryRegion = page.locator('#asset-section-summary');
    await expect(summaryRegion.getByRole('heading', { name: 'Resource' })).toBeVisible();
    await expect(summaryRegion.getByRole('heading', { name: 'This run' })).toBeVisible();
  });

  test('selected run item shows an Open in Lineage action', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Open in Lineage', exact: true })).toBeVisible();
  });
});
