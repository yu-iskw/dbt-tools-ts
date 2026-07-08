import * as os from 'node:os';
import * as path from 'node:path';

import { parseManifest } from 'dbt-artifacts-parser/manifest';
import { parseRunResults } from 'dbt-artifacts-parser/run_results';
import { loadTestManifest, loadTestRunResults } from 'dbt-artifacts-parser/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildAnalysisSnapshotFromParsedArtifactBundle } from '../analysis/snapshot/build.js';
import { DBT_MANIFEST_JSON, DBT_RUN_RESULTS_JSON } from '../io/artifact-filenames.js';
import {
  mkdtempValidated,
  resolveJoinedSafe,
  rmValidated,
  writeValidatedUtf8,
} from '../io/safe-fs.js';

import { USE_CASE_REGISTRY } from './registry.js';

import type { LoadedArtifactWorkspace } from '../artifact-workspace/types.js';

const manifestJson = loadTestManifest('v12', 'manifest_1.10.json') as Record<string, unknown>;
const runResultsJson = loadTestRunResults('v6', 'run_results.json') as Record<string, unknown>;

function buildLoadedSnapshot(): LoadedArtifactWorkspace {
  const manifest = parseManifest(manifestJson);
  const runResults = parseRunResults(runResultsJson);
  const { analysis, graph } = buildAnalysisSnapshotFromParsedArtifactBundle({
    manifestJson,
    runResultsJson,
    manifest,
    runResults,
  });
  return {
    run: {
      runId: 'current',
      manifestKey: DBT_MANIFEST_JSON,
      runResultsKey: DBT_RUN_RESULTS_JSON,
      updatedAtMs: 1,
      versionToken: 'test-token',
    },
    analysis,
    graph,
    loadedAtMs: Date.now(),
  };
}

describe('USE_CASE_REGISTRY', () => {
  let tempDir: string;
  let loaded: LoadedArtifactWorkspace;

  beforeEach(async () => {
    tempDir = await mkdtempValidated(path.join(os.tmpdir(), 'dbt-tools-registry-'));
    await writeValidatedUtf8(
      resolveJoinedSafe(tempDir, DBT_MANIFEST_JSON),
      JSON.stringify(manifestJson),
    );
    await writeValidatedUtf8(
      resolveJoinedSafe(tempDir, DBT_RUN_RESULTS_JSON),
      JSON.stringify(runResultsJson),
    );
    loaded = buildLoadedSnapshot();
  });

  afterEach(async () => {
    await rmValidated(tempDir, { recursive: true, force: true });
  });

  it('contains five read-only snapshot use cases', () => {
    expect(USE_CASE_REGISTRY).toHaveLength(5);
    for (const useCase of USE_CASE_REGISTRY) {
      expect(useCase.read).toBe('snapshot');
      expect(useCase.input).toBeDefined();
      expect(useCase.output).toBeDefined();
    }
  });

  it('resource.search returns contract-valid output', () => {
    const useCase = USE_CASE_REGISTRY.find((entry) => entry.name === 'resource.search')!;
    const output = useCase.run(loaded, { query: 'model', limit: 5, offset: 0 });
    expect(useCase.output.safeParse(output).success).toBe(true);
    expect(output.total).toBeGreaterThanOrEqual(0);
  });

  it('runs.summary returns contract-valid output', () => {
    const useCase = USE_CASE_REGISTRY.find((entry) => entry.name === 'runs.summary')!;
    const output = useCase.run(loaded, {});
    expect(useCase.output.safeParse(output).success).toBe(true);
    expect(output.summary.total_nodes).toBeGreaterThan(0);
  });

  it('resource.search defaults limit when omitted', () => {
    const useCase = USE_CASE_REGISTRY.find((entry) => entry.name === 'resource.search')!;
    const output = useCase.run(loaded, { query: 'model' });
    expect(output.limit).toBe(20);
    expect(output.results.length).toBeLessThanOrEqual(20);
    expect(useCase.output.safeParse(output).success).toBe(true);
  });

  it('resource.dependencies returns contract-valid output for a model', () => {
    const useCase = USE_CASE_REGISTRY.find((entry) => entry.name === 'resource.dependencies')!;
    const output = useCase.run(loaded, {
      uniqueId: 'model.jaffle_shop.customers',
      direction: 'upstream',
    });
    expect(useCase.output.safeParse(output).success).toBe(true);
  });
});
