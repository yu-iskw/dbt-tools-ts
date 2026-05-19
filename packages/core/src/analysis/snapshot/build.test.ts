import { describe, expect, it } from 'vitest';
import { parseManifest } from 'dbt-artifacts-parser/manifest';
import { parseRunResults } from 'dbt-artifacts-parser/run_results';
import {
  loadTestCatalog,
  loadTestManifest,
  loadTestRunResults,
} from 'dbt-artifacts-parser/test-utils';
import {
  buildAnalysisSnapshotFromArtifactBundle,
  buildAnalysisSnapshotFromArtifacts,
  buildAnalysisSnapshotFromParsedArtifactBundle,
  buildAnalysisSnapshotFromParsedArtifacts,
} from '../snapshot';

describe('analysis snapshot facade', () => {
  it('builds a serializable snapshot from raw artifacts', async () => {
    const manifestJson = loadTestManifest('v12', 'manifest_1.10.json') as Record<string, unknown>;
    const runResultsJson = loadTestRunResults('v6', 'run_results.json') as Record<string, unknown>;

    const snapshot = await buildAnalysisSnapshotFromArtifacts(manifestJson, runResultsJson);

    expect(snapshot.summary.total_nodes).toBeGreaterThan(0);
    expect(snapshot.resources.length).toBeGreaterThan(0);
    expect(snapshot.executions.length).toBe(snapshot.summary.total_nodes);
    expect(snapshot.selectedResourceId).not.toBeNull();
    expect(snapshot.timelineAdjacency).not.toEqual({});
    expect(snapshot.projectName).toBe('jaffle_shop');
    expect(snapshot.warehouseType).toBe('duckdb');
  });

  it('supports bundle inputs with optional catalog and sources enrichments', async () => {
    const manifestJson = loadTestManifest('v12', 'manifest_1.11.json') as Record<string, unknown>;
    const runResultsJson = loadTestRunResults('v6', 'run_results_1.11.json') as Record<
      string,
      unknown
    >;
    const catalogJson = loadTestCatalog('v1', 'catalog_1.11.json') as Record<string, unknown>;
    const sourcesJson = {
      metadata: {
        dbt_schema_version: 'https://schemas.getdbt.com/dbt/sources/v3.json',
        dbt_version: '1.11.0',
      },
      results: [
        {
          unique_id: 'source.jaffle_shop.ecom.raw_customers',
          status: 'warn',
          max_loaded_at: '2026-01-01T00:00:00.000Z',
          snapshotted_at: '2026-01-01T01:00:00.000Z',
          max_loaded_at_time_ago_in_s: 3600,
          criteria: {
            warn_after: { count: 12, period: 'hour' },
            error_after: { count: 24, period: 'hour' },
          },
        },
      ],
    } satisfies Record<string, unknown>;

    const snapshot = await buildAnalysisSnapshotFromArtifactBundle({
      manifestJson,
      runResultsJson,
      catalogJson,
      sourcesJson,
    });

    const source = snapshot.resources.find(
      (resource) => resource.uniqueId === 'source.jaffle_shop.ecom.raw_customers',
    );
    expect(source?.catalogStats?.columnCount).toBeGreaterThan(0);
    expect(source?.sourceFreshness?.status).toBe('Warn');
  });

  it('supports bundle inputs without run_results.json', async () => {
    const manifestJson = loadTestManifest('v12', 'manifest_1.11.json') as Record<string, unknown>;

    const snapshot = await buildAnalysisSnapshotFromArtifactBundle({
      manifestJson,
    });

    expect(snapshot.resources.length).toBeGreaterThan(0);
    expect(snapshot.summary.total_nodes).toBe(0);
    expect(snapshot.executions).toEqual([]);
    expect(snapshot.ganttData).toEqual([]);
    expect(snapshot.invocationId).toBeNull();
  });

  it('keeps the parsed-artifact builder aligned with the raw facade', () => {
    const manifestJson = loadTestManifest('v12', 'manifest_1.10.json') as Record<string, unknown>;
    const runResultsJson = loadTestRunResults('v6', 'run_results.json') as Record<string, unknown>;

    const manifest = parseManifest(manifestJson);
    const runResults = parseRunResults(runResultsJson);
    const { analysis, timings } = buildAnalysisSnapshotFromParsedArtifacts(
      manifestJson,
      runResultsJson,
      manifest,
      runResults,
    );

    expect(analysis.summary.total_nodes).toBeGreaterThan(0);
    expect(analysis.graphSummary.totalNodes).toBeGreaterThan(0);
    expect(analysis.projectName).toBe('jaffle_shop');
    expect(analysis.warehouseType).toBe('duckdb');
    expect(timings.graphBuildMs).toBeGreaterThanOrEqual(0);
    expect(timings.snapshotBuildMs).toBeGreaterThanOrEqual(0);
  });

  it('keeps the parsed bundle builder aligned with optional enrichments', () => {
    const manifestJson = loadTestManifest('v12', 'manifest_1.11.json') as Record<string, unknown>;
    const runResultsJson = loadTestRunResults('v6', 'run_results_1.11.json') as Record<
      string,
      unknown
    >;
    const manifest = parseManifest(manifestJson);
    const runResults = parseRunResults(runResultsJson);

    const { analysis } = buildAnalysisSnapshotFromParsedArtifactBundle({
      manifestJson,
      runResultsJson,
      sourcesJson: {
        metadata: {
          dbt_schema_version: 'https://schemas.getdbt.com/dbt/sources/v3.json',
          dbt_version: '1.11.0',
        },
        results: [
          {
            unique_id: 'source.jaffle_shop.ecom.raw_customers',
            status: 'pass',
            max_loaded_at: '2026-01-01T00:00:00.000Z',
            snapshotted_at: '2026-01-01T01:00:00.000Z',
            max_loaded_at_time_ago_in_s: 1800,
            criteria: {},
          },
        ],
      },
      manifest,
      runResults,
    });

    expect(
      analysis.resources.find(
        (resource) => resource.uniqueId === 'source.jaffle_shop.ecom.raw_customers',
      )?.sourceFreshness?.status,
    ).toBe('Pass');
  });

  it('uses direct dependency edges in dependencyIndex and omits bulk SQL fields', () => {
    const manifestJson = loadTestManifest('v12', 'manifest_1.10.json') as Record<string, unknown>;
    const runResultsJson = loadTestRunResults('v6', 'run_results.json') as Record<string, unknown>;

    const manifest = parseManifest(manifestJson);
    const runResults = parseRunResults(runResultsJson);
    const { analysis } = buildAnalysisSnapshotFromParsedArtifacts(
      manifestJson,
      runResultsJson,
      manifest,
      runResults,
    );

    for (const summary of Object.values(analysis.dependencyIndex)) {
      expect(summary.upstream.every((u) => u.depth === 1)).toBe(true);
      expect(summary.downstream.every((d) => d.depth === 1)).toBe(true);
      expect(summary.upstream.length).toBe(summary.upstreamCount);
      expect(summary.downstream.length).toBe(summary.downstreamCount);
    }

    const model = analysis.resources.find((r) => r.resourceType === 'model');
    expect(model).toBeDefined();
    expect(model?.compiledCode).toBeNull();
    expect(model?.rawCode).toBeNull();
  });

  it('preserves raw adapter_response fields in execution rows', () => {
    const manifestJson = loadTestManifest('v12', 'manifest_1.10.json') as Record<string, unknown>;
    const runResultsJson = loadTestRunResults('v6', 'run_results.json') as Record<string, unknown>;
    const results = (runResultsJson.results as Array<Record<string, unknown>>) ?? [];
    const first = results[0];
    if (!first) {
      throw new Error('Expected fixture run_results to contain at least one result');
    }
    first.adapter_response = {
      custom_metric: 7,
      nested: { phase: 'scan' },
    };

    const manifest = parseManifest(manifestJson);
    const runResults = parseRunResults(runResultsJson);
    const { analysis } = buildAnalysisSnapshotFromParsedArtifacts(
      manifestJson,
      runResultsJson,
      manifest,
      runResults,
    );

    const execution = analysis.executions.find((item) => item.uniqueId === String(first.unique_id));
    expect(execution?.adapterResponseFields?.map((field) => field.key)).toEqual([
      'custom_metric',
      'nested.phase',
    ]);
  });
});
