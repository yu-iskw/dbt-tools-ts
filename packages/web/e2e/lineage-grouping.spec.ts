import { test, expect, type Locator, type Page } from '@playwright/test';

import { loadWorkspace } from './helpers/preload';

const ORDERS_LINEAGE_PATH = '/?view=inventory&resource=model.jaffle_shop.orders&assetTab=lineage';
const GROUPED_LINEAGE_PATH = `${ORDERS_LINEAGE_PATH}&group=warehouse&allDeps=1`;
const EXPAND_LINEAGE_LABEL = 'Expand lineage';
const DIALOG_PANEL_SELECTOR = '.lineage-dialog__panel';
const GROUP_BY_REGION_NAME = 'Group by';
const GROUP_BY_NONE = 'None';
const GROUP_BY_WAREHOUSE = 'Warehouse';
const CROSSINGS_ONLY_LABEL = 'Crossings only';
const ARIA_PRESSED = 'aria-pressed';
const GROUP_BOX_SELECTOR = '.lineage-group';
const OUTER_BOX_SELECTOR = '.lineage-group--outer';
const INNER_BOX_SELECTOR = '.lineage-group--inner';
const GROUP_LABEL_SELECTOR = '.lineage-group__label';
const CROSS_OUTER_EDGE_SELECTOR = '.dependency-graph__edge--cross-outer';
const NODE_SELECTOR = 'rect.dependency-graph__node';
const CATALOG_LABEL = 'Catalog: jaffle_shop';
const SCHEMA_MAIN_LABEL = 'Schema: main';
const SCHEMA_RAW_LABEL = 'Schema: raw';
const OUTER_CROSSING_LEGEND = 'Crosses project/database boundary (0)';

/** The Group by control only exists in the expanded lineage dialog toolbar. */
async function openExpandedLineage(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: EXPAND_LINEAGE_LABEL, exact: true }).click();
  const panel = page.locator(DIALOG_PANEL_SELECTOR);
  await expect(panel).toBeVisible();
  return panel;
}

test.describe('warehouse-grouped lineage', () => {
  test.beforeEach(async ({ page }) => {
    await loadWorkspace(page);
  });

  test('deep link shows warehouse groups and keeps group=warehouse in the URL', async ({
    page,
  }) => {
    await page.goto(GROUPED_LINEAGE_PATH);

    await expect(page.locator(GROUP_LABEL_SELECTOR, { hasText: CATALOG_LABEL })).toBeVisible();
    await expect(page.locator(GROUP_LABEL_SELECTOR, { hasText: SCHEMA_MAIN_LABEL })).toBeVisible();
    await expect(page.locator(GROUP_LABEL_SELECTOR, { hasText: SCHEMA_RAW_LABEL })).toBeVisible();
    await expect(page.locator(OUTER_BOX_SELECTOR)).toHaveCount(1);
    await expect(page.locator(INNER_BOX_SELECTOR)).toHaveCount(2);
    await expect(page.locator(CROSS_OUTER_EDGE_SELECTOR)).toHaveCount(0);
    await expect(page.getByText(OUTER_CROSSING_LEGEND, { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/group=warehouse/);
  });

  test('ungrouped by default, toggles to warehouse groups and back to none', async ({ page }) => {
    await page.goto(ORDERS_LINEAGE_PATH);
    const panel = await openExpandedLineage(page);

    const groupBy = panel.getByRole('group', { name: GROUP_BY_REGION_NAME });
    const warehouseButton = groupBy.getByRole('button', { name: GROUP_BY_WAREHOUSE, exact: true });
    const noneButton = groupBy.getByRole('button', { name: GROUP_BY_NONE, exact: true });

    await expect(panel.locator(GROUP_BOX_SELECTOR)).toHaveCount(0);
    await expect(panel.getByRole('button', { name: CROSSINGS_ONLY_LABEL })).toHaveCount(0);
    await expect(noneButton).toHaveAttribute(ARIA_PRESSED, 'true');

    await warehouseButton.click();
    await expect(warehouseButton).toHaveAttribute(ARIA_PRESSED, 'true');
    await expect(panel.locator(OUTER_BOX_SELECTOR)).toHaveCount(1);
    await expect(panel.locator(GROUP_LABEL_SELECTOR, { hasText: SCHEMA_MAIN_LABEL })).toBeVisible();
    await expect(page).toHaveURL(/group=warehouse/);

    await noneButton.click();
    await expect(panel.locator(GROUP_BOX_SELECTOR)).toHaveCount(0);
    await expect(page).not.toHaveURL(/group=/);
  });

  test('crossings only chip toggles and never adds nodes', async ({ page }) => {
    await page.goto(GROUPED_LINEAGE_PATH);
    const panel = await openExpandedLineage(page);

    const chip = panel.getByRole('button', { name: CROSSINGS_ONLY_LABEL, exact: true });
    await expect(chip).toBeVisible();
    await expect(chip).toHaveAttribute(ARIA_PRESSED, 'false');
    const nodesBefore = await panel.locator(NODE_SELECTOR).count();

    await chip.click();
    await expect(chip).toHaveAttribute(ARIA_PRESSED, 'true');
    expect(await panel.locator(NODE_SELECTOR).count()).toBeLessThanOrEqual(nodesBefore);
  });
});
