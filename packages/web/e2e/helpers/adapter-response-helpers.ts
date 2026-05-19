import fs from 'node:fs';

import { expect, type Page } from '@playwright/test';

import { MANIFEST_PATH, RUN_RESULTS_PATH } from './preload';

const PRODUCTS_UNIQUE_ID = 'model.jaffle_shop.products';

export function buildRunResultsJsonWithAdapter(options: { includeExtraRawField: boolean }): string {
  const raw = fs.readFileSync(RUN_RESULTS_PATH, 'utf8');
  const data = JSON.parse(raw) as {
    results: Array<{
      unique_id: string;
      adapter_response: Record<string, unknown>;
    }>;
  };
  const target = data.results.find((r) => r.unique_id === PRODUCTS_UNIQUE_ID);
  if (target == null) {
    throw new Error(`run_results missing ${PRODUCTS_UNIQUE_ID}`);
  }
  const adapterResponse: Record<string, unknown> = {
    bytes_processed: 12_345,
    bytes_billed: 12_346,
    slot_ms: 99,
    rows_affected: 7,
    code: 'SELECT',
    _message: 'e2e adapter message',
    job_id: 'e2e-adapter-job-id',
    location: 'us-east-1',
    project_id: 'e2e-project',
  };
  if (options.includeExtraRawField) {
    adapterResponse.custom_e2e_extra = 'only-in-raw';
  }
  target.adapter_response = adapterResponse;
  return JSON.stringify(data);
}

/**
 * Loads workspace with manifest + run_results where `model.jaffle_shop.products`
 * has a rich adapter_response (for inventory / adapter UI tests).
 */
export async function loadWorkspaceWithProductAdapterResponse(
  page: Page,
  options: { includeExtraRawField: boolean },
): Promise<void> {
  await page.route('**/api/manifest.json', (route) =>
    route.fulfill({ path: MANIFEST_PATH, contentType: 'application/json' }),
  );
  await page.route('**/api/run_results.json', async (route) => {
    await route.fulfill({
      body: buildRunResultsJsonWithAdapter(options),
      contentType: 'application/json',
    });
  });
  await page.goto('/?view=inventory');
  const workspaceNav = page.getByRole('navigation', {
    name: 'Workspace sections',
  });
  await expect(workspaceNav.getByRole('button', { name: 'Health' })).toBeEnabled({
    timeout: 30_000,
  });
  await expect(page.getByRole('heading', { name: 'Inventory' }).first()).toBeVisible({
    timeout: 15_000,
  });
}
