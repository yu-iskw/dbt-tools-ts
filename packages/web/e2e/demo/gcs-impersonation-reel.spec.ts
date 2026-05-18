import { test, expect } from '@playwright/test';
import {
  GCS_MOCK_IMPERSONATION_SA,
  registerGcsSingleCandidateWithImpersonationMocks,
} from '../helpers/preload';

const CONNECTION_TABLIST = 'Connection';

async function pauseForDemo(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

test.describe('demo reel: GCS + impersonation (mocked)', () => {
  test('GCS source, impersonated SA, single run auto-loads', async ({ page }) => {
    test.setTimeout(120_000);
    await registerGcsSingleCandidateWithImpersonationMocks(page);
    await page.goto('/');
    await expect(page.getByRole('tablist', { name: CONNECTION_TABLIST })).toBeVisible();
    await pauseForDemo(600);

    await page.getByRole('tab', { name: 'Google Cloud Storage' }).click();
    await pauseForDemo(400);
    await expect(page.getByRole('textbox', { name: 'Impersonated service account' })).toBeVisible();

    await page
      .getByRole('textbox', { name: 'Impersonated service account' })
      .fill(GCS_MOCK_IMPERSONATION_SA);
    await pauseForDemo(500);

    await page.getByRole('textbox', { name: 'Location' }).fill('gs://mock-bucket/mock-prefix');
    await pauseForDemo(400);
    await page.getByRole('textbox', { name: 'Location' }).press('Enter');

    await expect(page.getByRole('heading', { name: 'Health' }).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator('.error-banner')).toHaveCount(0);
    await pauseForDemo(1200);
  });
});
