import { test, expect, type Page } from '@playwright/test';

import { loadWorkspaceWithProductAdapterResponse } from './helpers/adapter-response-helpers';
import { expandExplorerBranchIfCollapsed } from './helpers/explorer-tree';

const LEAF_SELECTOR = '.explorer-tree__row--leaf';
const PRODUCTS_MODEL_TITLE = 'model.jaffle_shop.products';

function thisRunSummaryCard(page: Page) {
  return page
    .locator('#asset-section-summary .asset-summary-stack > section.workspace-card')
    .nth(1);
}

test.describe('adapter response (inventory asset summary)', () => {
  async function openProductsModel(page: Page) {
    await expandExplorerBranchIfCollapsed(page, 'models');
    await expandExplorerBranchIfCollapsed(page, 'marts');
    await page.locator(`${LEAF_SELECTOR}[title="${PRODUCTS_MODEL_TITLE}"]`).click();
    await expect(page.getByRole('heading', { name: 'products' }).first()).toBeVisible();
  }

  test('shows normalized adapter metrics and additional raw fields when extras exist', async ({
    page,
  }) => {
    await loadWorkspaceWithProductAdapterResponse(page, {
      includeExtraRawField: true,
    });
    await openProductsModel(page);

    const card = thisRunSummaryCard(page);
    await expect(card.getByText('Adapter response')).toBeVisible();
    await expect(card.getByText('Bytes processed')).toBeVisible();
    await expect(card.getByText('12,345')).toBeVisible();
    await expect(card.getByText('Query ID')).toBeVisible();
    await expect(card.getByText('e2e-adapter-job-id')).toBeVisible();

    const additional = page.getByLabel('Additional adapter response fields');
    await expect(additional).toBeVisible();
    await expect(additional).toContainText('custom_e2e_extra');
    await expect(additional).toContainText('only-in-raw');
  });

  test('omits the additional raw block when values are fully covered by normalized metrics', async ({
    page,
  }) => {
    await loadWorkspaceWithProductAdapterResponse(page, {
      includeExtraRawField: false,
    });
    await openProductsModel(page);

    const card = thisRunSummaryCard(page);
    await expect(card.getByText('Adapter response')).toBeVisible();
    await expect(card.getByText('Bytes processed')).toBeVisible();
    await expect(page.getByLabel('Additional adapter response fields')).toHaveCount(0);
  });
});
