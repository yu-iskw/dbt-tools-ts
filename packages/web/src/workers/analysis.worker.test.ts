import { loadTestManifest, loadTestRunResults } from 'dbt-artifacts-parser/test-utils';
import { describe, expect, it } from 'vitest';

import { ANALYSIS_WORKER_PROTOCOL_VERSION } from './analysis-protocol';
import { handleAnalysisWorkerRequest } from './analysis.worker';

function encodeJson(value: Record<string, unknown>) {
  return new TextEncoder().encode(JSON.stringify(value)).buffer;
}

describe('analysis worker contract', () => {
  it('returns a full analysis snapshot for valid artifacts', async () => {
    const manifestJson = loadTestManifest('v12', 'manifest_1.10.json') as Record<string, unknown>;
    const runResultsJson = loadTestRunResults('v6', 'run_results.json') as Record<string, unknown>;

    const response = await handleAnalysisWorkerRequest({
      type: 'load-analysis',
      protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION,
      requestId: 1,
      artifactBuffers: {
        manifestBytes: encodeJson(manifestJson),
        runResultsBytes: encodeJson(runResultsJson),
      },
      source: 'upload',
    });

    expect(response.type).toBe('analysis-ready');
    if (response.type !== 'analysis-ready') return;
    expect(response.analysis.summary.total_nodes).toBeGreaterThan(0);
    expect(response.timings.totalWorkerMs).toBeGreaterThanOrEqual(0);
    expect(response.timings.graphBuildMs).toBeGreaterThanOrEqual(0);
    expect(response.timings.snapshotBuildMs).toBeGreaterThanOrEqual(0);
  });

  it('returns a protocol error for malformed JSON bytes', async () => {
    const invalidBytes = new TextEncoder().encode('{bad json').buffer;

    const response = await handleAnalysisWorkerRequest({
      type: 'load-analysis',
      protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION,
      requestId: 2,
      artifactBuffers: {
        manifestBytes: invalidBytes,
        runResultsBytes: invalidBytes,
      },
      source: 'preload',
    });

    expect(response.type).toBe('analysis-error');
    if (response.type !== 'analysis-error') return;
    expect(response.message).toContain('JSON');
  });

  it('returns an unsupported-artifact error for old manifest versions', async () => {
    const manifestJson = loadTestManifest('v1', 'manifest.json') as Record<string, unknown>;
    const runResultsJson = loadTestRunResults('v6', 'run_results.json') as Record<string, unknown>;

    const response = await handleAnalysisWorkerRequest({
      type: 'load-analysis',
      protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION,
      requestId: 3,
      artifactBuffers: {
        manifestBytes: encodeJson(manifestJson),
        runResultsBytes: encodeJson(runResultsJson),
      },
      source: 'upload',
    });

    expect(response.type).toBe('analysis-error');
    if (response.type !== 'analysis-error') return;
    expect(response.message).toContain('Unsupported dbt version');
  });

  it('returns resource SQL after a successful load', async () => {
    const manifestJson = loadTestManifest('v12', 'manifest_1.10.json') as Record<string, unknown>;
    const runResultsJson = loadTestRunResults('v6', 'run_results.json') as Record<string, unknown>;

    const loadResponse = await handleAnalysisWorkerRequest({
      type: 'load-analysis',
      protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION,
      requestId: 10,
      artifactBuffers: {
        manifestBytes: encodeJson(manifestJson),
        runResultsBytes: encodeJson(runResultsJson),
      },
      source: 'upload',
    });

    expect(loadResponse.type).toBe('analysis-ready');
    if (loadResponse.type !== 'analysis-ready') return;

    const modelId = loadResponse.analysis.resources.find(
      (r) => r.resourceType === 'model',
    )?.uniqueId;
    expect(modelId).toBeDefined();

    const codeResponse = await handleAnalysisWorkerRequest({
      type: 'get-resource-code',
      protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION,
      requestId: 11,
      uniqueId: modelId!,
    });

    expect(codeResponse.type).toBe('resource-code-ready');
    if (codeResponse.type !== 'resource-code-ready') return;
    const hasSql =
      (codeResponse.compiledCode?.length ?? 0) > 0 || (codeResponse.rawCode?.length ?? 0) > 0;
    expect(hasSql).toBe(true);
  });

  it('returns search hits after a successful load', async () => {
    const manifestJson = loadTestManifest('v12', 'manifest_1.10.json') as Record<string, unknown>;
    const runResultsJson = loadTestRunResults('v6', 'run_results.json') as Record<string, unknown>;

    await handleAnalysisWorkerRequest({
      type: 'load-analysis',
      protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION,
      requestId: 20,
      artifactBuffers: {
        manifestBytes: encodeJson(manifestJson),
        runResultsBytes: encodeJson(runResultsJson),
      },
      source: 'upload',
    });

    const searchResponse = await handleAnalysisWorkerRequest({
      type: 'search-resources',
      protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION,
      requestId: 21,
      query: 'model',
    });

    expect(searchResponse.type).toBe('search-resources-ready');
    if (searchResponse.type !== 'search-resources-ready') return;
    expect(searchResponse.resources.length).toBeGreaterThan(0);
    expect(searchResponse.resources.length).toBeLessThanOrEqual(8);
  });

  it('loads optional catalog and sources buffers without requiring them', async () => {
    const manifestJson = loadTestManifest('v12', 'manifest_1.11.json') as Record<string, unknown>;
    const runResultsJson = loadTestRunResults('v6', 'run_results_1.11.json') as Record<
      string,
      unknown
    >;
    const catalogJson = {
      metadata: {
        dbt_schema_version: 'https://schemas.getdbt.com/dbt/catalog/v1.json',
      },
      nodes: {},
      sources: {
        'source.jaffle_shop.ecom.raw_customers': {
          columns: {
            id: { type: 'integer' },
          },
        },
      },
    } as Record<string, unknown>;
    const sourcesJson = {
      metadata: {
        dbt_schema_version: 'https://schemas.getdbt.com/dbt/sources/v3.json',
      },
      results: [
        {
          unique_id: 'source.jaffle_shop.ecom.raw_customers',
          status: 'pass',
          max_loaded_at: '2026-01-01T00:00:00.000Z',
          snapshotted_at: '2026-01-01T00:30:00.000Z',
          max_loaded_at_time_ago_in_s: 1800,
          criteria: {},
        },
      ],
    } as Record<string, unknown>;

    const response = await handleAnalysisWorkerRequest({
      type: 'load-analysis',
      protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION,
      requestId: 30,
      artifactBuffers: {
        manifestBytes: encodeJson(manifestJson),
        runResultsBytes: encodeJson(runResultsJson),
        catalogBytes: encodeJson(catalogJson),
        sourcesBytes: encodeJson(sourcesJson),
      },
      source: 'upload',
    });

    expect(response.type).toBe('analysis-ready');
    if (response.type !== 'analysis-ready') return;
    const source = response.analysis.resources.find(
      (resource) => resource.uniqueId === 'source.jaffle_shop.ecom.raw_customers',
    );
    expect(source?.catalogStats?.columnCount).toBe(1);
    expect(source?.sourceFreshness?.status).toBe('Pass');
  });
});
