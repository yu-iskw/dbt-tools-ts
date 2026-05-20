import * as os from 'node:os';
import * as path from 'node:path';

import {
  mkdtempValidated,
  readValidatedUtf8,
  resolveJoinedSafe,
  writeValidatedUtf8,
} from '@dbt-tools/core';
import {
  getTestResourcePath,
  type ArtifactType,
  type ResourceLocation,
} from 'dbt-artifacts-parser/test-utils';

type FixtureResourcePath = readonly [ArtifactType, string, ResourceLocation, string, string];

const JAFFLE_MANIFEST_RESOURCE = [
  'manifest',
  'v12',
  'resources',
  'jaffle_shop',
  'manifest_1.10.json',
] as const satisfies FixtureResourcePath;

const JAFFLE_RUN_RESULTS_RESOURCE = [
  'run_results',
  'v6',
  'resources',
  'jaffle_shop',
  'run_results.json',
] as const satisfies FixtureResourcePath;

const MANIFEST_FILENAME = 'manifest.json';
const RUN_RESULTS_FILENAME = 'run_results.json';

/**
 * Temp directory with standard dbt artifact names for CLI tests.
 */
async function copyFixtureIntoDir(
  sourceResource: FixtureResourcePath,
  dir: string,
  destFilename: string,
): Promise<void> {
  const [artifactType, version, location, project, filename] = sourceResource;
  const text = await readValidatedUtf8(
    getTestResourcePath(artifactType, version, location, project, filename),
  );
  await writeValidatedUtf8(resolveJoinedSafe(dir, destFilename), text);
}

export async function createJaffleArtifactBundleDir(): Promise<string> {
  const dir = await mkdtempValidated(path.join(os.tmpdir(), 'dbt-cli-bundle-'));
  await copyFixtureIntoDir(JAFFLE_MANIFEST_RESOURCE, dir, MANIFEST_FILENAME);
  await copyFixtureIntoDir(JAFFLE_RUN_RESULTS_RESOURCE, dir, RUN_RESULTS_FILENAME);
  return dir;
}

export async function createJaffleManifestOnlyDir(): Promise<string> {
  const dir = await mkdtempValidated(path.join(os.tmpdir(), 'dbt-cli-manifest-'));
  await copyFixtureIntoDir(JAFFLE_MANIFEST_RESOURCE, dir, MANIFEST_FILENAME);
  return dir;
}

export async function createJaffleRunResultsOnlyDir(): Promise<string> {
  const dir = await mkdtempValidated(path.join(os.tmpdir(), 'dbt-cli-run-results-'));
  await copyFixtureIntoDir(JAFFLE_RUN_RESULTS_RESOURCE, dir, RUN_RESULTS_FILENAME);
  return dir;
}
