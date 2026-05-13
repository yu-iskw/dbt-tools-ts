import { test, expect } from '@playwright/test';
import { expandExplorerBranchIfCollapsed } from './helpers/explorerTree';
import { loadWorkspace } from './helpers/preload';

const ASSET_WORKSPACE_SECTION = '.asset-workspace__section';
const LEAF_SELECTOR = '.explorer-tree__row--leaf';
const BRANCH_SELECTOR = '.explorer-tree__row--branch';
const BRANCH_LABEL_SELECTOR = '.explorer-tree__label';
const MACRO_LEAF_NAME = 'bigquery__cents_to_dollars';
const MACROS_BRANCH_NAME = 'macros';
const PRODUCTS_MODEL_TITLE = 'model.jaffle_shop.products';
const INVENTORY_BROWSE_COPY = 'Browse, filter, and inspect all workspace assets.';
const LINEAGE_GRAPH_HEADING = 'Lineage graph';
const EXPAND_LINEAGE_LABEL = 'Expand lineage';
const OPEN_IN_TIMELINE_LABEL = 'Open in Timeline';

test.describe('inventory workspace', () => {
  test.beforeEach(async ({ page }) => {
    await loadWorkspace(page);
    await page.goto('/?view=inventory');
    await expect(page.getByRole('heading', { name: 'Inventory' }).first()).toBeVisible();
  });

  test('shows explorer and stacked selected asset sections', async ({ page }) => {
    await expandExplorerBranchIfCollapsed(page, 'models');
    await expandExplorerBranchIfCollapsed(page, 'marts');
    await expect(page.locator(LEAF_SELECTOR).first()).toBeVisible();
    await page.locator(LEAF_SELECTOR).first().click();
    await expect(page.getByText(INVENTORY_BROWSE_COPY)).toHaveCount(0);
    await expect(page.locator('.workspace-scaffold__inspector')).toHaveCount(0);
    await expect(page.getByLabel('Asset sections')).toHaveCount(0);
    const summaryRegion = page.locator('#asset-section-summary');
    await expect(summaryRegion.getByRole('heading', { name: 'Resource' })).toBeVisible();
    await expect(summaryRegion.getByRole('heading', { name: 'This run' })).toBeVisible();
    await expect(page.getByText('Asset details')).toHaveCount(0);
    const assetActions = page.locator('.asset-hero__actions');
    await expect(assetActions).not.toContainText('Open in Runs');
    await expect(assetActions).toContainText(OPEN_IN_TIMELINE_LABEL);
    await expect(assetActions).not.toContainText(EXPAND_LINEAGE_LABEL);
    const lineageCard = page.locator(ASSET_WORKSPACE_SECTION).filter({
      has: page.getByRole('heading', { name: LINEAGE_GRAPH_HEADING }).first(),
    });
    await expect(
      lineageCard.getByRole('button', {
        name: EXPAND_LINEAGE_LABEL,
        exact: true,
      }),
    ).toBeVisible();
    for (const action of [OPEN_IN_TIMELINE_LABEL]) {
      await expect(assetActions.getByRole('button', { name: action, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: LINEAGE_GRAPH_HEADING }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Tests' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'SQL' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Runtime' })).toHaveCount(0);
    const sectionIds = await page
      .locator(ASSET_WORKSPACE_SECTION)
      .evaluateAll((sections) => sections.map((section) => section.getAttribute('id')));
    expect(sectionIds).toEqual([
      'asset-section-summary',
      'asset-section-lineage',
      'asset-section-tests',
      'asset-section-sql',
    ]);
  });

  test('branch rows fold and unfold the inventory tree', async ({ page }) => {
    const macrosBranch = page.locator(BRANCH_SELECTOR, {
      has: page.locator(BRANCH_LABEL_SELECTOR, {
        hasText: MACROS_BRANCH_NAME,
      }),
    });
    const macroLeaf = page.locator(LEAF_SELECTOR, {
      hasText: MACRO_LEAF_NAME,
    });
    const productsLeaf = page.locator(`${LEAF_SELECTOR}[title="${PRODUCTS_MODEL_TITLE}"]`);
    await expandExplorerBranchIfCollapsed(page, MACROS_BRANCH_NAME);
    await expect(macrosBranch).toBeVisible();
    await expect(macroLeaf).toBeVisible();
    await expandExplorerBranchIfCollapsed(page, 'models');
    await expandExplorerBranchIfCollapsed(page, 'marts');
    await expect(productsLeaf).toBeVisible();

    await productsLeaf.click();
    await macrosBranch.click();
    await expect(macroLeaf).toHaveCount(0);

    await macrosBranch.click();
    await expect(macroLeaf).toBeVisible();
  });

  test('collapsing a selected asset branch keeps selection but hides the tree path', async ({
    page,
  }) => {
    const modelsBranch = page.locator(BRANCH_SELECTOR, {
      has: page.locator(BRANCH_LABEL_SELECTOR, { hasText: 'models' }),
    });
    const martsBranch = page.locator(BRANCH_SELECTOR, {
      has: page.locator(BRANCH_LABEL_SELECTOR, { hasText: 'marts' }),
    });
    const ordersLeaf = page.locator(`${LEAF_SELECTOR}[title="model.jaffle_shop.orders"]`);

    await expandExplorerBranchIfCollapsed(page, 'models');
    await expandExplorerBranchIfCollapsed(page, 'marts');
    await ordersLeaf.click();
    await expect(page.getByRole('heading', { name: 'orders' })).toBeVisible();

    await martsBranch.click();
    await expect(ordersLeaf).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'orders' })).toBeVisible();

    await modelsBranch.click();
    await expect(martsBranch).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'orders' })).toBeVisible();

    await modelsBranch.click();
    await expect(martsBranch).toBeVisible();
    await martsBranch.click();
    await expect(ordersLeaf).toBeVisible();
  });

  test('deep-linked selections reveal the path once but can still be collapsed', async ({
    page,
  }) => {
    const macrosBranch = page.locator(BRANCH_SELECTOR, {
      has: page.locator(BRANCH_LABEL_SELECTOR, {
        hasText: MACROS_BRANCH_NAME,
      }),
    });
    const macroLeaf = page.locator(LEAF_SELECTOR, {
      hasText: MACRO_LEAF_NAME,
    });

    await page.goto('/?view=inventory&resource=macro.jaffle_shop.bigquery__cents_to_dollars');
    await expect(macrosBranch).toBeVisible();
    await expect(macroLeaf).toBeVisible();
    await expect(page.getByRole('heading', { name: 'bigquery__cents_to_dollars' })).toBeVisible();

    await macrosBranch.click();
    await expect(macroLeaf).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'bigquery__cents_to_dollars' })).toBeVisible();
  });

  test('deep-link assetTab still anchors the stacked document', async ({ page }) => {
    await page.goto('/?view=inventory&resource=model.jaffle_shop.products&assetTab=lineage');
    await expect(page.getByRole('heading', { name: LINEAGE_GRAPH_HEADING }).first()).toBeVisible();
    const lineageNodeStats = page.locator('.dependency-graph__node-stat');
    await expect(lineageNodeStats.first()).toContainText(/\d+/);
    const statTexts = await lineageNodeStats.allTextContents();
    expect(statTexts.some((text) => /\d+/.test(text))).toBeTruthy();
    expect(statTexts.every((text) => !text.includes('✓'))).toBeTruthy();
    expect(statTexts.every((text) => !text.includes('✗'))).toBeTruthy();
    await expect(page).toHaveURL(/assetTab=lineage/);
  });

  test('orders shows attached test evidence with quick jump to runs', async ({ page }) => {
    const ordersLeaf = page.locator(`${LEAF_SELECTOR}[title="model.jaffle_shop.orders"]`);

    await expandExplorerBranchIfCollapsed(page, 'models');
    await expandExplorerBranchIfCollapsed(page, 'marts');
    await ordersLeaf.click();
    await expect(page.getByRole('heading', { name: 'Tests' })).toBeVisible();
    await expect(page.locator('.asset-tests-summary__metric').first()).toContainText(
      'Attached tests',
    );
    await expect(page.locator('.asset-tests-table__header')).toBeVisible();
    await expect(page.locator('.asset-tests-table__header')).toContainText('Duration');
    await expect(
      page.locator('.asset-tests-table__header button', { hasText: 'Test' }),
    ).toBeVisible();
    await expect(
      page.locator('.asset-tests-table__header button', { hasText: 'Status' }),
    ).toBeVisible();
    const testsTable = page.locator('.asset-tests-table');
    await expect(testsTable.getByRole('button', { name: 'Name' })).toHaveCount(0);
    await expect(page.getByText('not_null_orders_order_id')).toBeVisible();
    await expect(page.getByRole('button', { name: /open .* in runs/i }).first()).toBeVisible();
  });

  test('legacy runtime asset tab still lands on summary content', async ({ page }) => {
    await page.goto('/?view=inventory&resource=model.jaffle_shop.orders&assetTab=runtime');

    await expect(page).toHaveURL(/assetTab=runtime/);
    const summaryRegion = page.locator('#asset-section-summary');
    await expect(summaryRegion.getByRole('heading', { name: 'Resource' })).toBeVisible();
    await expect(summaryRegion.getByRole('heading', { name: 'This run' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Runtime' })).toHaveCount(0);
    await expect(page.getByText('Execution time')).toBeVisible();
  });

  test('expand lineage opens the embedded fullscreen dialog', async ({ page }) => {
    await expandExplorerBranchIfCollapsed(page, 'models');
    await expandExplorerBranchIfCollapsed(page, 'marts');
    await page.locator(LEAF_SELECTOR).first().click();
    const lineageCard = page.locator(ASSET_WORKSPACE_SECTION).filter({
      has: page.getByRole('heading', { name: LINEAGE_GRAPH_HEADING }).first(),
    });
    await lineageCard.getByRole('button', { name: EXPAND_LINEAGE_LABEL, exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const dialogPanel = page.locator('.lineage-dialog__panel');
    await expect(dialogPanel).toBeVisible();
    const backdrop = page.locator('.lineage-dialog__backdrop');
    await expect(backdrop).toBeVisible();
    const dialogRect = await dialog.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });
    const panelRect = await dialogPanel.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });
    const viewport = page.viewportSize();
    expect(dialogRect.width).toBeGreaterThan((viewport?.width ?? 0) * 0.9);
    expect(dialogRect.height).toBeGreaterThan((viewport?.height ?? 0) * 0.9);
    expect(panelRect.width).toBeGreaterThan((viewport?.width ?? 0) * 0.85);
    expect(panelRect.height).toBeGreaterThan((viewport?.height ?? 0) * 0.8);
    const closeButton = page.locator('.lineage-dialog__close');
    await expect(closeButton).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close', exact: true })).toHaveCount(0);
    await closeButton.click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});
