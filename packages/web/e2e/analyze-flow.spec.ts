import { test, expect, type Page } from '@playwright/test';
import {
  GCS_MOCK_IMPERSONATION_SA,
  loadWorkspace,
  mockPreload,
  registerGcsMultiCandidateArtifactSourceMocks,
  registerMultiCandidateArtifactSourceMocks,
  registerSingleCandidateArtifactSourceMocks,
} from './helpers/preload';

const ARTIFACT_SOURCE_TYPE_LABEL = 'Source type';
const LOAD_WORKSPACE = 'Load workspace';
const SETTINGS_VIEW = '/?view=settings';

async function commitLocationScan(page: Page) {
  await page.getByRole('textbox', { name: 'Location' }).press('Enter');
}

async function expectNoErrorBanner(page: Page) {
  await expect(page.locator('.error-banner')).toHaveCount(0);
}

test.describe('analyze flow', () => {
  test('landing page shows new workspace navigation', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('navigation', { name: 'Workspace sections' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Health', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Runs', exact: true })).toBeVisible();
  });

  test('artifact load panel shows directory-based controls', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByLabel(ARTIFACT_SOURCE_TYPE_LABEL)).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Location' })).toBeVisible();
    await expect(
      page.locator('section.upload-hero').getByRole('button', { name: 'Discover' }),
    ).toHaveCount(0);
    await expect(page.getByRole('button', { name: LOAD_WORKSPACE })).toBeVisible();
  });

  test('artifact load panel load workspace disabled until location scan', async ({ page }) => {
    await registerSingleCandidateArtifactSourceMocks(page);
    await page.goto('/');
    const loadBtn = page.getByRole('button', { name: LOAD_WORKSPACE });
    await expect(loadBtn).toBeDisabled();
    await page.getByRole('textbox', { name: 'Location' }).fill('/mock/solo');
    await expect(loadBtn).toBeDisabled();
    await commitLocationScan(page);
    await expect(page.getByRole('heading', { name: 'Health' }).first()).toBeVisible({
      timeout: 30_000,
    });
    await expectNoErrorBanner(page);
  });

  test('artifact load panel single-candidate scan auto-loads workspace', async ({ page }) => {
    await registerSingleCandidateArtifactSourceMocks(page);
    await page.goto('/');
    await page.getByRole('textbox', { name: 'Location' }).fill('/mock/solo');
    await commitLocationScan(page);
    await expect(page.getByRole('heading', { name: 'Health' }).first()).toBeVisible({
      timeout: 30_000,
    });
    await expectNoErrorBanner(page);
  });

  test('artifact load panel multi-candidate scan, pick run, load workspace', async ({ page }) => {
    await registerMultiCandidateArtifactSourceMocks(page);
    await page.goto('/');
    await page.getByRole('textbox', { name: 'Location' }).fill('/mock/multi');
    await commitLocationScan(page);
    await expect(page.getByRole('group', { name: /Candidate sets/i })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'runAlpha' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'runBeta' })).toBeVisible();
    await page.getByRole('radio', { name: 'runBeta' }).click();
    await page.getByRole('button', { name: LOAD_WORKSPACE }).click();
    await expect(page.getByRole('heading', { name: 'Health' }).first()).toBeVisible({
      timeout: 30_000,
    });
    await expectNoErrorBanner(page);
  });

  test('artifact load panel source type updates location placeholder', async ({ page }) => {
    await page.goto('/');
    const location = page.getByRole('textbox', { name: 'Location' });
    await expect(location).toHaveAttribute('placeholder', /\/path\/to\/target|relative\/path/);
    await page.getByLabel(ARTIFACT_SOURCE_TYPE_LABEL).selectOption('s3');
    await expect(location).toHaveAttribute('placeholder', /s3:\/\/bucket\/prefix|bucket\/prefix/);
    await page.getByLabel(ARTIFACT_SOURCE_TYPE_LABEL).selectOption('gcs');
    await expect(location).toHaveAttribute('placeholder', /gs:\/\/bucket\/prefix|bucket\/prefix/);
  });

  test('artifact load panel GCS flow sends impersonated service account on discover', async ({
    page,
  }) => {
    await registerGcsMultiCandidateArtifactSourceMocks(page);
    await page.goto('/');
    await page.getByLabel(ARTIFACT_SOURCE_TYPE_LABEL).selectOption('gcs');
    await page
      .getByRole('textbox', { name: 'Impersonated service account' })
      .fill(GCS_MOCK_IMPERSONATION_SA);
    await page.getByRole('textbox', { name: 'Location' }).fill('gs://mock-bucket/mock-prefix');
    await page.getByRole('textbox', { name: 'Location' }).press('Enter');
    await expect(page.getByRole('group', { name: /Candidate sets/i })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'runBeta' })).toBeVisible();
    await page.getByRole('radio', { name: 'runBeta' }).click();
    await page.getByRole('button', { name: LOAD_WORKSPACE }).click();
    await expect(page.getByRole('heading', { name: 'Health' }).first()).toBeVisible({
      timeout: 30_000,
    });
    await expectNoErrorBanner(page);
  });

  test('preload mock mounts workspace', async ({ page }) => {
    await loadWorkspace(page);
    await expect(page.getByRole('heading', { name: 'Health' }).first()).toBeVisible();
  });

  test('mockPreload helper is sufficient to enable nav', async ({ page }) => {
    await mockPreload(page);
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Inventory', exact: true })).toBeEnabled({
      timeout: 30_000,
    });
  });

  test('settings shows configured location from preload status', async ({ page }) => {
    await loadWorkspace(page);
    await page.goto(SETTINGS_VIEW);
    await expect(page.getByText('Configured location')).toBeVisible();
    await expect(page.getByText('Local directory')).toBeVisible();
    await expect(page.getByText('/e2e/mock/target')).toBeVisible();
  });

  test('settings does not offer reset workspace', async ({ page }) => {
    await loadWorkspace(page);
    await page.goto(SETTINGS_VIEW);
    await expect(page.getByRole('button', { name: /Reset workspace/ })).toHaveCount(0);
  });

  test('settings change location opens artifact wizard dialog', async ({ page }) => {
    await loadWorkspace(page);
    await page.goto(SETTINGS_VIEW);
    await page.getByRole('button', { name: 'Change location…' }).click();
    await expect(page.getByRole('dialog', { name: 'Change artifact location' })).toBeVisible();
    await expect(page.getByLabel(ARTIFACT_SOURCE_TYPE_LABEL)).toBeVisible();
  });
});
