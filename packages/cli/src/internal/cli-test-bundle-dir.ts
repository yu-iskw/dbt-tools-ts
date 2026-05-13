import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { getTestResourcePath } from 'dbt-artifacts-parser/test-utils';

const JAFFLE_MANIFEST_RESOURCE = [
  'manifest',
  'v12',
  'resources',
  'jaffle_shop',
  'manifest_1.10.json',
] as const;

const JAFFLE_RUN_RESULTS_RESOURCE = [
  'run_results',
  'v6',
  'resources',
  'jaffle_shop',
  'run_results.json',
] as const;

const MANIFEST_FILENAME = 'manifest.json';
const RUN_RESULTS_FILENAME = 'run_results.json';

/**
 * Temp directory with standard dbt artifact names for CLI tests.
 */
export async function createJaffleArtifactBundleDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dbt-cli-bundle-'));
  await fs.copyFile(
    getTestResourcePath(...JAFFLE_MANIFEST_RESOURCE),
    path.join(dir, MANIFEST_FILENAME),
  );
  await fs.copyFile(
    getTestResourcePath(...JAFFLE_RUN_RESULTS_RESOURCE),
    path.join(dir, RUN_RESULTS_FILENAME),
  );
  return dir;
}

export async function createJaffleManifestOnlyDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dbt-cli-manifest-'));
  await fs.copyFile(
    getTestResourcePath(...JAFFLE_MANIFEST_RESOURCE),
    path.join(dir, MANIFEST_FILENAME),
  );
  return dir;
}

export async function createJaffleRunResultsOnlyDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dbt-cli-run-results-'));
  await fs.copyFile(
    getTestResourcePath(...JAFFLE_RUN_RESULTS_RESOURCE),
    path.join(dir, RUN_RESULTS_FILENAME),
  );
  return dir;
}
