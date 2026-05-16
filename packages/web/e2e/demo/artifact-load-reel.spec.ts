import { test, expect } from '@playwright/test';
import { registerSingleCandidateArtifactSourceMocks } from '../helpers/preload';

async function pause(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

test.describe('demo reel: artifact load (mocked)', () => {
  test('scan location and auto-load single run into Health', async ({ page }) => {
    test.setTimeout(120_000);
    await registerSingleCandidateArtifactSourceMocks(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Point the workspace/i })).toBeVisible();
    await pause(500);

    await page.getByRole('textbox', { name: 'Location' }).fill('/mock/solo');
    await pause(400);
    await page.getByRole('textbox', { name: 'Location' }).press('Enter');

    await expect(page.getByRole('heading', { name: 'Health' }).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator('.error-banner')).toHaveCount(0);
    await pause(1500);
  });
});
