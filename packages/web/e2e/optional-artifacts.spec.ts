import { expect, test } from '@playwright/test';

import { CATALOG_PATH, SOURCES_PATH, loadWorkspace } from './helpers/preload';

test.describe('optional artifacts', () => {
  test('workspace still loads when catalog.json and sources.json are absent', async ({ page }) => {
    await loadWorkspace(page);
    await expect(page.getByRole('heading', { name: 'Health' }).first()).toBeVisible();
  });

  test('inventory summary shows catalog and sources enrichment when available', async ({
    page,
  }) => {
    await loadWorkspace(page, {
      catalogPath: CATALOG_PATH,
      sourcesPath: SOURCES_PATH,
    });
    await page.goto('/?view=inventory&resource=source.jaffle_shop.ecom.raw_customers');
    await expect(page.getByRole('heading', { name: 'Inventory' }).first()).toBeVisible();

    const summaryRegion = page.locator('#asset-section-summary');
    await expect(summaryRegion.getByRole('heading', { name: 'Resource' })).toBeVisible();
    await expect(summaryRegion.getByText('Catalog columns')).toBeVisible();
    await expect(summaryRegion.getByRole('heading', { name: 'Source freshness' })).toBeVisible();
    await expect(summaryRegion.getByText('Warn', { exact: true })).toBeVisible();
    await expect(summaryRegion.getByText('12 hour')).toBeVisible();
  });
});
