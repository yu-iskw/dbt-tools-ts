import { beforeEach, describe, expect, it, vi } from 'vitest';

const { loadAnalysisFromBuffers } = vi.hoisted(() => ({
  loadAnalysisFromBuffers: vi.fn(),
}));

vi.mock('./analysisLoader', () => ({
  loadAnalysisFromBuffers,
}));

import {
  configureArtifactSourceFromApi,
  discoverArtifactSourceFromApi,
  fetchArtifactSourceStatus,
  loadCurrentManagedArtifacts,
  refetchFromApi,
} from './artifactSourceApi';

type FetchMock = ReturnType<typeof vi.fn>;

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('artifactSourceApi', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    loadAnalysisFromBuffers.mockReset();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('falls back to legacy artifacts when artifact source status returns 404', async () => {
    const analysisResult = {
      analysis: { projectName: 'legacy-run' },
      metrics: { source: 'preload' },
    };
    loadAnalysisFromBuffers.mockResolvedValue(analysisResult);
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(
        new Response('manifest', {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response('run-results', {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));

    const result = await loadCurrentManagedArtifacts();

    expect(result).toEqual({
      status: expect.objectContaining({
        mode: 'preload',
        currentSource: 'preload',
        label: 'Live target',
      }),
      result: analysisResult,
    });
    expect(loadAnalysisFromBuffers).toHaveBeenCalledWith(
      expect.objectContaining({
        manifestBytes: expect.any(ArrayBuffer),
        runResultsBytes: expect.any(ArrayBuffer),
      }),
      'preload',
    );
  });

  it('falls back to legacy artifacts when artifact source status returns 500', async () => {
    const analysisResult = {
      analysis: { projectName: 'legacy-run' },
      metrics: { source: 'preload' },
    };
    loadAnalysisFromBuffers.mockResolvedValue(analysisResult);
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(
        new Response('manifest', {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response('run-results', {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));

    const result = await loadCurrentManagedArtifacts();

    expect(result.status).toEqual(
      expect.objectContaining({
        mode: 'preload',
        currentSource: 'preload',
        label: 'Live target',
      }),
    );
    expect(result.result).toBe(analysisResult);
  });

  it('falls back to legacy artifacts when artifact source status fetch throws', async () => {
    const analysisResult = {
      analysis: { projectName: 'legacy-run' },
      metrics: { source: 'preload' },
    };
    loadAnalysisFromBuffers.mockResolvedValue(analysisResult);
    fetchMock
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(
        new Response('manifest', {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response('run-results', {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));

    const result = await loadCurrentManagedArtifacts();

    expect(result.status).toEqual(
      expect.objectContaining({
        mode: 'preload',
        currentSource: 'preload',
        label: 'Live target',
      }),
    );
    expect(result.result).toBe(analysisResult);
  });

  it('returns waiting status when artifact source fails and legacy artifacts are unavailable', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));

    const result = await loadCurrentManagedArtifacts();

    expect(result).toEqual({
      status: expect.objectContaining({
        mode: 'none',
        currentSource: null,
        label: 'Waiting for artifacts',
      }),
      result: null,
    });
    expect(loadAnalysisFromBuffers).not.toHaveBeenCalled();
  });

  it('does not fall back when the artifact source endpoint reports no managed source', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        mode: 'none',
        currentSource: null,
        label: 'Waiting for artifacts',
        checkedAtMs: 123,
        remoteProvider: null,
        remoteLocation: null,
        pollIntervalMs: null,
        currentRun: null,
        pendingRun: null,
        supportsSwitch: false,
      }),
    );

    const result = await loadCurrentManagedArtifacts();

    expect(result).toEqual({
      status: {
        mode: 'none',
        currentSource: null,
        label: 'Waiting for artifacts',
        checkedAtMs: 123,
        remoteProvider: null,
        remoteLocation: null,
        pollIntervalMs: null,
        currentRun: null,
        pendingRun: null,
        supportsSwitch: false,
      },
      result: null,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('loads current managed artifact routes before considering legacy fallbacks', async () => {
    const analysisResult = {
      analysis: { projectName: 'managed-run' },
      metrics: { source: 'preload' },
    };
    loadAnalysisFromBuffers.mockResolvedValue(analysisResult);
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          mode: 'preload',
          currentSource: 'preload',
          label: 'Live target',
          checkedAtMs: 123,
          remoteProvider: null,
          remoteLocation: null,
          pollIntervalMs: null,
          currentRun: null,
          pendingRun: null,
          supportsSwitch: false,
        }),
      )
      .mockResolvedValueOnce(
        new Response('manifest', {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response('run-results', {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response('catalog', {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response('sources', {
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    const result = await loadCurrentManagedArtifacts();

    expect(result).toEqual({
      status: expect.objectContaining({
        mode: 'preload',
        currentSource: 'preload',
        label: 'Live target',
      }),
      result: analysisResult,
    });
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/artifact-source');
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/artifacts/current/manifest.json');
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/artifacts/current/run_results.json');
    expect(fetchMock).toHaveBeenNthCalledWith(4, '/api/artifacts/current/catalog.json');
    expect(fetchMock).toHaveBeenNthCalledWith(5, '/api/artifacts/current/sources.json');
    expect(loadAnalysisFromBuffers).toHaveBeenCalledWith(
      expect.objectContaining({
        manifestBytes: expect.any(ArrayBuffer),
        runResultsBytes: expect.any(ArrayBuffer),
        catalogBytes: expect.any(ArrayBuffer),
        sourcesBytes: expect.any(ArrayBuffer),
      }),
      'preload',
    );
  });

  it('ignores optional managed artifact fetch rejections when required files succeed', async () => {
    const analysisResult = {
      analysis: { projectName: 'managed-run' },
      metrics: { source: 'preload' },
    };
    loadAnalysisFromBuffers.mockResolvedValue(analysisResult);
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          mode: 'preload',
          currentSource: 'preload',
          label: 'Live target',
          checkedAtMs: 123,
          remoteProvider: null,
          remoteLocation: null,
          pollIntervalMs: null,
          currentRun: null,
          pendingRun: null,
          supportsSwitch: false,
        }),
      )
      .mockResolvedValueOnce(
        new Response('manifest', {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response('run-results', {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockRejectedValueOnce(new Error('catalog unavailable'))
      .mockRejectedValueOnce(new Error('sources unavailable'));

    const result = await loadCurrentManagedArtifacts();

    expect(result.result).toBe(analysisResult);
    expect(loadAnalysisFromBuffers).toHaveBeenCalledWith(
      expect.objectContaining({
        manifestBytes: expect.any(ArrayBuffer),
        runResultsBytes: expect.any(ArrayBuffer),
      }),
      'preload',
    );
    expect(loadAnalysisFromBuffers.mock.calls[0]?.[0]).not.toHaveProperty('catalogBytes');
    expect(loadAnalysisFromBuffers.mock.calls[0]?.[0]).not.toHaveProperty('sourcesBytes');
  });

  it('refetches successfully when optional managed artifacts reject', async () => {
    const analysisResult = {
      analysis: { projectName: 'managed-run' },
      metrics: { source: 'remote' },
    };
    loadAnalysisFromBuffers.mockResolvedValue(analysisResult);
    fetchMock
      .mockResolvedValueOnce(
        new Response('manifest', {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response('run-results', {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockRejectedValueOnce(new Error('catalog unavailable'))
      .mockRejectedValueOnce(new Error('sources unavailable'));

    await expect(refetchFromApi('remote')).resolves.toBe(analysisResult);
    expect(loadAnalysisFromBuffers).toHaveBeenCalledWith(
      expect.objectContaining({
        manifestBytes: expect.any(ArrayBuffer),
        runResultsBytes: expect.any(ArrayBuffer),
      }),
      'remote',
    );
  });

  it('does not load when a required managed artifact fetch rejects', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('manifest unavailable'))
      .mockResolvedValueOnce(
        new Response('run-results', {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response('catalog', { status: 200 }))
      .mockResolvedValueOnce(new Response('sources', { status: 200 }));

    await expect(refetchFromApi('preload')).resolves.toBeNull();
    expect(loadAnalysisFromBuffers).not.toHaveBeenCalled();
  });

  it('ignores optional managed artifacts when their content type is not json', async () => {
    const analysisResult = {
      analysis: { projectName: 'managed-run' },
      metrics: { source: 'preload' },
    };
    loadAnalysisFromBuffers.mockResolvedValue(analysisResult);
    fetchMock
      .mockResolvedValueOnce(
        new Response('manifest', {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response('run-results', {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response('<html>catalog</html>', {
          headers: { 'Content-Type': 'text/html' },
        }),
      )
      .mockResolvedValueOnce(
        new Response('<html>sources</html>', {
          headers: { 'Content-Type': 'text/html' },
        }),
      );

    await expect(refetchFromApi('preload')).resolves.toBe(analysisResult);
    expect(loadAnalysisFromBuffers.mock.calls[0]?.[0]).not.toHaveProperty('catalogBytes');
    expect(loadAnalysisFromBuffers.mock.calls[0]?.[0]).not.toHaveProperty('sourcesBytes');
  });

  it('keeps fetchArtifactSourceStatus strict for non-ok responses', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));

    await expect(fetchArtifactSourceStatus()).rejects.toThrow(
      'Failed to load artifact source status',
    );
  });

  it('posts discovery requests to the preview endpoint', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        sourceKind: 'local',
        locationDisplay: '/tmp/target',
        candidates: [
          {
            runId: 'current',
            label: 'Local (root)',
            updatedAtMs: 1,
            versionToken: 'v1',
          },
        ],
        needsSelection: false,
        discoveryError: null,
      }),
    );

    await expect(discoverArtifactSourceFromApi('local', '/tmp/target')).resolves.toEqual(
      expect.objectContaining({
        sourceKind: 'local',
        locationDisplay: '/tmp/target',
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith('/api/artifact-source/discover', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'local', location: '/tmp/target' }),
    });
  });

  it('includes runId when committing a configured artifact source', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        mode: 'preload',
        currentSource: 'preload',
        label: 'Artifacts',
        checkedAtMs: 1,
        remoteProvider: null,
        remoteLocation: null,
        pollIntervalMs: null,
        currentRun: {
          runId: 'runBeta',
          label: 'Local (runBeta)',
          updatedAtMs: 2,
          versionToken: 'beta',
        },
        pendingRun: null,
        supportsSwitch: false,
      }),
    );

    await configureArtifactSourceFromApi('local', '/tmp/target', 'runBeta');

    expect(fetchMock).toHaveBeenCalledWith('/api/artifact-source/configure', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'local',
        location: '/tmp/target',
        runId: 'runBeta',
      }),
    });
  });

  it('sends GCS impersonation options when the trimmed value is non-empty', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        sourceKind: 'gcs',
        locationDisplay: 'GCS b/p',
        candidates: [],
        needsSelection: false,
        discoveryError: null,
      }),
    );

    await discoverArtifactSourceFromApi('gcs', 'gs://b/p', {
      impersonatedServiceAccount: '  svc@p.iam.gserviceaccount.com  ',
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/artifact-source/discover', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'gcs',
        location: 'gs://b/p',
        options: { impersonatedServiceAccount: 'svc@p.iam.gserviceaccount.com' },
      }),
    });
  });

  it('omits options for GCS when impersonation is blank after trim', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        sourceKind: 'gcs',
        locationDisplay: 'GCS b/p',
        candidates: [],
        needsSelection: false,
        discoveryError: null,
      }),
    );

    await discoverArtifactSourceFromApi('gcs', 'gs://b/p', {
      impersonatedServiceAccount: '   ',
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/artifact-source/discover', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'gcs', location: 'gs://b/p' }),
    });
  });

  it('does not send options for local or S3 discover requests', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        sourceKind: 's3',
        locationDisplay: 'S3 x/y',
        candidates: [],
        needsSelection: false,
        discoveryError: null,
      }),
    );

    await discoverArtifactSourceFromApi('s3', 's3://x/y', {
      impersonatedServiceAccount: 'svc@p.iam.gserviceaccount.com',
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/artifact-source/discover', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 's3', location: 's3://x/y' }),
    });
  });

  it('includes GCS options on configure when impersonation is set', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        mode: 'remote',
        currentSource: 'remote',
        label: 'Artifacts',
        checkedAtMs: 1,
        remoteProvider: 'gcs',
        remoteLocation: 'GCS b/p',
        pollIntervalMs: null,
        currentRun: {
          runId: 'r1',
          label: 'GCS r1',
          updatedAtMs: 2,
          versionToken: 'v',
        },
        pendingRun: null,
        supportsSwitch: false,
      }),
    );

    await configureArtifactSourceFromApi('gcs', 'gs://b/p', 'r1', {
      impersonatedServiceAccount: 'svc@p.iam.gserviceaccount.com',
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/artifact-source/configure', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'gcs',
        location: 'gs://b/p',
        runId: 'r1',
        options: { impersonatedServiceAccount: 'svc@p.iam.gserviceaccount.com' },
      }),
    });
  });
});
