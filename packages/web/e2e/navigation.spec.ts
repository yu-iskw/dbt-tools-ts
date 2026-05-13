import { test, expect } from '@playwright/test';
import { loadWorkspace } from './helpers/preload';

const APP_SIDEBAR = '#app-sidebar';
const NAV_VIEWS = [
  { label: 'Health', heading: 'Health', view: 'health' },
  { label: 'Timeline', heading: 'Timeline', view: 'timeline' },
  { label: 'Inventory', heading: 'Inventory', view: 'inventory' },
  { label: 'Runs', heading: 'Runs', view: 'runs' },
] as const;

test.describe('sidebar navigation', () => {
  test('all primary nav buttons are visible in the expected order', async ({ page }) => {
    await page.goto('/');
    const labels = await page
      .locator(`${APP_SIDEBAR} .nav-group .sidebar-link strong`)
      .allTextContents();
    expect(labels).toEqual(NAV_VIEWS.map(({ label }) => label));
    await expect(
      page.locator(APP_SIDEBAR).getByRole('button', { name: 'Search', exact: true }),
    ).toHaveCount(0);
  });

  test('clicking each nav button shows the correct heading and URL', async ({ page }) => {
    await loadWorkspace(page);

    for (const { label, heading, view } of NAV_VIEWS) {
      await page.locator(APP_SIDEBAR).getByRole('button', { name: label, exact: true }).click();
      await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`[?&]view=${view}`));
    }
  });

  test('legacy overview URL redirects to health', async ({ page }) => {
    await loadWorkspace(page);
    await page.goto('/?view=overview');
    await expect(page.getByRole('heading', { name: 'Health' }).first()).toBeVisible();
    await expect(page).toHaveURL(/view=health/);
  });

  test('legacy execution timeline URL redirects to timeline', async ({ page }) => {
    await loadWorkspace(page);
    await page.goto('/?view=runs&tab=timeline');
    await expect(page.getByRole('heading', { name: 'Timeline' }).first()).toBeVisible();
    await expect(page).toHaveURL(/view=timeline/);
  });

  test('legacy lineage URL opens Inventory with lineage tab', async ({ page }) => {
    await loadWorkspace(page);
    await page.goto('/?view=lineage&resource=model.jaffle_shop.orders&up=2&down=2&lens=type');
    await expect(page.getByRole('heading', { name: 'Lineage graph' }).first()).toBeVisible();
    await expect(page).toHaveURL(/view=inventory/);
    await expect(page).toHaveURL(/assetTab=lineage/);
    await expect(page).toHaveURL(/[?&]up=2/);
    await expect(page).toHaveURL(/[?&]lens=type/);
  });

  test('legacy discover URL opens Inventory', async ({ page }) => {
    await loadWorkspace(page);
    await page.goto('/?view=discover&q=orders');
    await expect(page).toHaveURL(/view=inventory/);
    await expect(page.locator('.inventory-view').first()).toBeVisible();
  });

  test('legacy dependencies URL opens Inventory with lineage tab', async ({ page }) => {
    await loadWorkspace(page);
    await page.goto('/?view=dependencies&resource=model.jaffle_shop.orders');
    await expect(page.getByRole('heading', { name: 'Lineage graph' }).first()).toBeVisible();
    await expect(page).toHaveURL(/view=inventory/);
    await expect(page).toHaveURL(/assetTab=lineage/);
  });
});
