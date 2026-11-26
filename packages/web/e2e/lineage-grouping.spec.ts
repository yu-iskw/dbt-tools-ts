import { test, expect } from '@playwright/test';

import { loadWorkspace } from './helpers/preload';

const ORDERS_LINEAGE_PATH = '/?view=inventory&resource=model.jaffle_shop.orders&assetTab=lineage';
const GROUPED_LINEAGE_PATH = `${ORDERS_LINEAGE_PATH}&group=warehouse&allDeps=1`;
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
const SUMMARY_CARD_SELECTOR = '.dependency-graph__summary-node';
const COLLAPSE_RAW_LABEL = 'Collapse Schema raw';
const EXPAND_RAW_LABEL = /^Expand Schema raw/;
const EXPAND_ALL_LABEL = 'Expand all';
const COLLAPSE_OTHERS_LABEL = 'Collapse others';
const ALL_EXPANDED_STATUS = 'All groups expanded';
const ARIA_EXPANDED = 'aria-expanded';

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

    const groupBy = page.getByRole('group', { name: GROUP_BY_REGION_NAME });
    const warehouseButton = groupBy.getByRole('button', { name: GROUP_BY_WAREHOUSE, exact: true });
    const noneButton = groupBy.getByRole('button', { name: GROUP_BY_NONE, exact: true });

    await expect(page.locator(GROUP_BOX_SELECTOR)).toHaveCount(0);
    await expect(page.getByRole('button', { name: CROSSINGS_ONLY_LABEL })).toHaveCount(0);
    await expect(noneButton).toHaveAttribute(ARIA_PRESSED, 'true');

    await warehouseButton.click();
    await expect(warehouseButton).toHaveAttribute(ARIA_PRESSED, 'true');
    await expect(page.locator(OUTER_BOX_SELECTOR)).toHaveCount(1);
    await expect(page.locator(GROUP_LABEL_SELECTOR, { hasText: SCHEMA_MAIN_LABEL })).toBeVisible();
    await expect(page).toHaveURL(/group=warehouse/);

    await noneButton.click();
    await expect(page.locator(GROUP_BOX_SELECTOR)).toHaveCount(0);
    await expect(page).not.toHaveURL(/group=/);
  });

  test('crossings only chip toggles and never adds nodes', async ({ page }) => {
    await page.goto(GROUPED_LINEAGE_PATH);

    const chip = page.getByRole('button', { name: CROSSINGS_ONLY_LABEL, exact: true });
    await expect(chip).toBeVisible();
    await expect(chip).toHaveAttribute(ARIA_PRESSED, 'false');
    const nodesBefore = await page.locator(NODE_SELECTOR).count();

    await chip.click();
    await expect(chip).toHaveAttribute(ARIA_PRESSED, 'true');
    expect(await page.locator(NODE_SELECTOR).count()).toBeLessThanOrEqual(nodesBefore);
  });

  test('small graphs start expanded and a group header collapses and re-expands it', async ({
    page,
  }) => {
    await page.goto(GROUPED_LINEAGE_PATH);

    await expect(page.getByText(ALL_EXPANDED_STATUS, { exact: true })).toBeVisible();
    await expect(page.locator(SUMMARY_CARD_SELECTOR)).toHaveCount(0);
    const crossingLegend = page.getByText(OUTER_CROSSING_LEGEND, { exact: true });
    await expect(crossingLegend).toBeVisible();

    const header = page.getByRole('button', { name: COLLAPSE_RAW_LABEL, exact: true });
    await expect(header).toHaveAttribute(ARIA_EXPANDED, 'true');
    await header.click();

    await expect(page.locator(SUMMARY_CARD_SELECTOR)).toHaveCount(1);
    await expect(page.getByText(/1 group collapsed, \d+ edges? bundled/)).toBeVisible();
    // Collapsing never changes what the legend says about real edges.
    await expect(crossingLegend).toBeVisible();
    await expect(page.getByRole('button', { name: COLLAPSE_OTHERS_LABEL })).toBeVisible();

    const summary = page.getByRole('button', { name: EXPAND_RAW_LABEL });
    await expect(summary).toHaveAttribute(ARIA_EXPANDED, 'false');
    await summary.click();

    await expect(page.locator(SUMMARY_CARD_SELECTOR)).toHaveCount(0);
    await expect(page.getByText(ALL_EXPANDED_STATUS, { exact: true })).toBeVisible();
  });

  test('Collapse others and Expand all switch every other group', async ({ page }) => {
    await page.goto(GROUPED_LINEAGE_PATH);

    const collapseOthers = page.getByRole('button', { name: COLLAPSE_OTHERS_LABEL, exact: true });
    await collapseOthers.click();
    // Every group except the selected node's collapses, so there is at least one summary card.
    await expect(page.locator(SUMMARY_CARD_SELECTOR).first()).toBeVisible();
    await expect(collapseOthers).toBeDisabled();

    await page.getByRole('button', { name: EXPAND_ALL_LABEL, exact: true }).click();
    await expect(page.locator(SUMMARY_CARD_SELECTOR)).toHaveCount(0);
    await expect(page.getByText(ALL_EXPANDED_STATUS, { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/group=warehouse/);
    await expect(page).not.toHaveURL(/collapse/);
  });
});
