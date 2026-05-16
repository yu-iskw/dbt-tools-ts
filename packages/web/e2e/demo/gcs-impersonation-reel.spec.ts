import { test, expect } from '@playwright/test';
import {
  GCS_MOCK_IMPERSONATION_SA,
  registerGcsMultiCandidateArtifactSourceMocks,
} from '../helpers/preload';

const ARTIFACT_SOURCE_TYPE_LABEL = 'Source type';
const LOAD_WORKSPACE = 'Load workspace';

async function pauseForDemo(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

test.describe('demo reel: GCS + impersonation (mocked)', () => {
  test('discover, select run, load workspace', async ({ page }) => {
    test.setTimeout(120_000);
    await registerGcsMultiCandidateArtifactSourceMocks(page);
    await page.goto('/');
    await expect(page.getByLabel(ARTIFACT_SOURCE_TYPE_LABEL)).toBeVisible();
    await pauseForDemo(600);

    await page.getByLabel(ARTIFACT_SOURCE_TYPE_LABEL).selectOption('gcs');
    await pauseForDemo(400);
    await expect(page.getByRole('textbox', { name: 'Impersonated service account' })).toBeVisible();

    await page
      .getByRole('textbox', { name: 'Impersonated service account' })
      .fill(GCS_MOCK_IMPERSONATION_SA);
    await pauseForDemo(500);

    await page.getByRole('textbox', { name: 'Location' }).fill('gs://mock-bucket/mock-prefix');
    await pauseForDemo(400);
    await page.getByRole('textbox', { name: 'Location' }).press('Enter');

    await expect(page.getByRole('group', { name: /Candidate sets/i })).toBeVisible({
      timeout: 30_000,
    });
    await pauseForDemo(800);
    await expect(page.getByRole('radio', { name: 'runBeta' })).toBeVisible();
    await page.getByRole('radio', { name: 'runBeta' }).click();
    await pauseForDemo(500);

    await page.getByRole('button', { name: LOAD_WORKSPACE }).click();
    await expect(page.getByRole('heading', { name: 'Health' }).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator('.error-banner')).toHaveCount(0);
    await pauseForDemo(1200);
  });
});
