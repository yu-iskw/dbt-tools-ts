import { expect, test } from '@playwright/test';

import { loadRemoteWorkspaceWithPendingRun } from './helpers/preload';

test.describe('remote pending run accept', () => {
  test('accepting a pending remote run clears the banner and keeps the workspace usable', async ({
    page,
  }) => {
    await loadRemoteWorkspaceWithPendingRun(page);

    const banner = page.getByRole('region', { name: 'Remote update available' });
    await expect(banner.getByText('run-2')).toBeVisible();

    await page.getByRole('button', { name: 'Load latest remote run' }).click();

    await expect(banner).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Switching…' })).toHaveCount(0);

    const workspaceNav = page.getByRole('navigation', {
      name: 'Workspace sections',
    });
    await expect(workspaceNav.getByRole('button', { name: 'Health' })).toBeEnabled();
    await expect(
      page.getByRole('main').getByRole('heading', { name: 'Health' }).first(),
    ).toBeVisible();
    await expect(page.locator('.error-banner')).toHaveCount(0);
  });
});
