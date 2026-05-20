import { test, expect } from '@playwright/test';

import { expandExplorerBranchIfCollapsed } from './helpers/explorer-tree';
import { loadWorkspace } from './helpers/preload';

const APP_SIDEBAR = '#app-sidebar';
const LEAF_SELECTOR = '.explorer-tree__row--leaf';
const OPEN_IN_TIMELINE_LABEL = 'Open in Timeline';

test.describe('health cross-view via sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await loadWorkspace(page);
    await expect(page.getByRole('heading', { name: 'Health' }).first()).toBeVisible();
  });

  test('Runs in sidebar navigates to runs view', async ({ page }) => {
    await page.locator(APP_SIDEBAR).getByRole('button', { name: 'Runs', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Runs' }).first()).toBeVisible();
    await expect(page).toHaveURL(/[?&]view=runs/);
  });

  test('Timeline in sidebar navigates to timeline view', async ({ page }) => {
    await page.locator(APP_SIDEBAR).getByRole('button', { name: 'Timeline', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Timeline' }).first()).toBeVisible();
    await expect(page).toHaveURL(/[?&]view=timeline/);
  });

  test('Inventory in sidebar navigates to inventory view', async ({ page }) => {
    await page.locator(APP_SIDEBAR).getByRole('button', { name: 'Inventory', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Inventory' }).first()).toBeVisible();
    await expect(page).toHaveURL(/[?&]view=inventory/);
  });

  test('deep link opens inventory with lineage tab', async ({ page }) => {
    await page.goto('/?view=inventory&resource=model.jaffle_shop.orders&assetTab=lineage');
    await expect(page.getByRole('heading', { name: 'Inventory' }).first()).toBeVisible();
    await expect(page).toHaveURL(/[?&]view=inventory/);
    await expect(page).toHaveURL(/[?&]assetTab=lineage/);
    await expect(page.getByRole('heading', { name: 'Lineage graph' }).first()).toBeVisible();
  });
});

test.describe('inventory to timeline cross-view', () => {
  test('Open in Timeline from asset hero navigates with selected execution', async ({ page }) => {
    await loadWorkspace(page);
    await page.goto('/?view=inventory');
    await expect(page.getByRole('heading', { name: 'Inventory' }).first()).toBeVisible();

    await expandExplorerBranchIfCollapsed(page, 'models');
    await expandExplorerBranchIfCollapsed(page, 'marts');
    await expect(page.locator(LEAF_SELECTOR).first()).toBeVisible();
    await page.locator(LEAF_SELECTOR).first().click();
    const summaryRegion = page.locator('#asset-section-summary');
    await expect(summaryRegion.getByRole('heading', { name: 'Resource' })).toBeVisible();
    await expect(summaryRegion.getByRole('heading', { name: 'This run' })).toBeVisible();

    await page.getByRole('button', { name: OPEN_IN_TIMELINE_LABEL, exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Timeline' }).first()).toBeVisible();
    await expect(page).toHaveURL(/[?&]view=timeline/);
    await expect(page).toHaveURL(/[?&]selected=/);
  });
});
