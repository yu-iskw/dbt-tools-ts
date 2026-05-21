#!/usr/bin/env node
/**
 * Regenerate docs/site/public/demo from test fixtures and apply doc-only tweaks.
 *
 * - manifest: v10 jaffle_shop (schema >= 10)
 * - run_results: v6 run_results_1.11.json with one synthetic error on model.jaffle_shop.orders
 */
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const fixtureRoot = join(root, 'packages/test-fixtures/dbt-artifacts-parser/resources');
const demoDir = join(root, 'docs/site/public/demo');

const manifestSrc = join(fixtureRoot, 'manifest/v10/jaffle_shop/manifest.json');
const runResultsSrc = join(fixtureRoot, 'run_results/v6/jaffle_shop/run_results_1.11.json');

copyFileSync(manifestSrc, join(demoDir, 'manifest.json'));

const runResults = JSON.parse(readFileSync(runResultsSrc, 'utf8'));
const orders = runResults.results?.find((r) => r.unique_id === 'model.jaffle_shop.orders');
if (orders) {
  orders.status = 'error';
  orders.message =
    'Database Error in model orders (demo): synthetic failure for documentation examples';
}
writeFileSync(join(demoDir, 'run_results.json'), `${JSON.stringify(runResults, null, 2)}\n`);

console.log('Synced demo artifacts to docs/site/public/demo/');
