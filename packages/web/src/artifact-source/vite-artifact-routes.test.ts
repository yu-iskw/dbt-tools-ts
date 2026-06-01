import http from 'node:http';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  tryHandleArtifactSourceViteRequest,
  ARTIFACT_SOURCE_UNSUPPORTED_OPTIONS_ERROR,
} from './vite-artifact-routes';

import type { ArtifactSourceService } from './source-service';

function startRouteServer(service: Partial<ArtifactSourceService>) {
  const requestHandler: http.RequestListener = (req, res) => {
    void (async () => {
      const handled = await tryHandleArtifactSourceViteRequest(
        req,
        res,
        service as ArtifactSourceService,
      );
      if (!handled) {
        res.statusCode = 404;
        res.end('not handled');
      }
    })();
  };
  const server = http.createServer(requestHandler);

  return new Promise<http.Server>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function readJsonResponse(
  server: http.Server,
  path: string,
  init: {
    method?: string;
    body?: string;
  } = {},
) {
  const address = server.address();
  if (address == null || typeof address === 'string') {
    throw new Error('Server address unavailable');
  }
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    body: init.body,
  });
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

async function closeServer(server: http.Server | undefined) {
  if (server == null) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

describe('tryHandleArtifactSourceViteRequest', () => {
  let server: http.Server | undefined;

  afterEach(async () => {
    vi.restoreAllMocks();
    await closeServer(server);
    server = undefined;
  });

  it('returns discovery previews without mutating the active session', async () => {
    const discoverArtifactSource = vi.fn(async () => ({
      sourceKind: 'local' as const,
      locationDisplay: '/tmp/preview',
      discoveryError: null,
    }));
    const configureArtifactSource = vi.fn();

    server = await startRouteServer({
      discoverArtifactSource,
      configureArtifactSource,
    });

    const response = await readJsonResponse(server, '/api/artifact-source/discover', {
      method: 'POST',
      body: JSON.stringify({ type: 'local', location: '/tmp/preview' }),
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        sourceKind: 'local',
        locationDisplay: '/tmp/preview',
      }),
    );
    expect(discoverArtifactSource).toHaveBeenCalledWith('local', '/tmp/preview', undefined);
    expect(configureArtifactSource).not.toHaveBeenCalled();
  });

  it('passes runId through configure and returns 400 for invalid candidates', async () => {
    const configureArtifactSource = vi.fn(async () => {
      throw new Error('Unknown run id "missing-run"');
    });

    server = await startRouteServer({
      discoverArtifactSource: vi.fn(),
      configureArtifactSource,
    });

    const response = await readJsonResponse(server, '/api/artifact-source/configure', {
      method: 'POST',
      body: JSON.stringify({
        type: 'local',
        location: '/tmp/preview',
        runId: 'missing-run',
      }),
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'Unknown run id "missing-run"',
    });
    expect(configureArtifactSource).toHaveBeenCalledWith(
      'local',
      '/tmp/preview',
      'missing-run',
      undefined,
    );
  });

  it('rejects options for local artifact sources', async () => {
    const discoverArtifactSource = vi.fn();
    server = await startRouteServer({ discoverArtifactSource });

    const response = await readJsonResponse(server, '/api/artifact-source/discover', {
      method: 'POST',
      body: JSON.stringify({
        type: 'local',
        location: '/tmp',
        options: { impersonatedServiceAccount: 'x@y.iam.gserviceaccount.com' },
      }),
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: ARTIFACT_SOURCE_UNSUPPORTED_OPTIONS_ERROR,
    });
    expect(discoverArtifactSource).not.toHaveBeenCalled();
  });

  it('rejects options for S3 artifact sources', async () => {
    const discoverArtifactSource = vi.fn();
    server = await startRouteServer({ discoverArtifactSource });

    const response = await readJsonResponse(server, '/api/artifact-source/discover', {
      method: 'POST',
      body: JSON.stringify({
        type: 's3',
        location: 's3://b/p',
        options: {},
      }),
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: ARTIFACT_SOURCE_UNSUPPORTED_OPTIONS_ERROR,
    });
    expect(discoverArtifactSource).not.toHaveBeenCalled();
  });

  it('passes trimmed GCS impersonation options to discover', async () => {
    const discoverArtifactSource = vi.fn(async () => ({
      sourceKind: 'gcs' as const,
      locationDisplay: 'GCS b/p',
      discoveryError: null,
    }));

    server = await startRouteServer({ discoverArtifactSource });

    const response = await readJsonResponse(server, '/api/artifact-source/discover', {
      method: 'POST',
      body: JSON.stringify({
        type: 'gcs',
        location: 'gs://b/p',
        options: { impersonatedServiceAccount: '  svc@proj.iam.gserviceaccount.com  ' },
      }),
    });

    expect(response.status).toBe(200);
    expect(discoverArtifactSource).toHaveBeenCalledWith('gcs', 'gs://b/p', {
      impersonatedServiceAccount: 'svc@proj.iam.gserviceaccount.com',
    });
  });

  it('rejects options for local configure requests', async () => {
    const configureArtifactSource = vi.fn();
    server = await startRouteServer({ configureArtifactSource });

    const response = await readJsonResponse(server, '/api/artifact-source/configure', {
      method: 'POST',
      body: JSON.stringify({
        type: 'local',
        location: '/tmp',
        runId: 'run-1',
        options: { impersonatedServiceAccount: 'x@y.iam.gserviceaccount.com' },
      }),
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: ARTIFACT_SOURCE_UNSUPPORTED_OPTIONS_ERROR,
    });
    expect(configureArtifactSource).not.toHaveBeenCalled();
  });

  it('rejects options for S3 configure requests', async () => {
    const configureArtifactSource = vi.fn();
    server = await startRouteServer({ configureArtifactSource });

    const response = await readJsonResponse(server, '/api/artifact-source/configure', {
      method: 'POST',
      body: JSON.stringify({
        type: 's3',
        location: 's3://b/p',
        runId: 'run-1',
        options: {},
      }),
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: ARTIFACT_SOURCE_UNSUPPORTED_OPTIONS_ERROR,
    });
    expect(configureArtifactSource).not.toHaveBeenCalled();
  });

  it('passes trimmed GCS impersonation options to configure', async () => {
    const configureArtifactSource = vi.fn(async () => ({
      mode: 'remote' as const,
      currentSource: 'remote' as const,
      label: 'GCS',
      checkedAtMs: 1,
      remoteProvider: 'gcs' as const,
      remoteLocation: 'gs://b/p',
      pollIntervalMs: null,
      currentRun: {
        runId: 'r1',
        label: 'Run r1',
        updatedAtMs: 1,
        versionToken: 't',
      },
      pendingRun: null,
      supportsSwitch: false,
      missingOptionalArtifacts: {
        missingCatalog: false,
        missingSources: false,
      },
    }));

    server = await startRouteServer({ configureArtifactSource });

    const response = await readJsonResponse(server, '/api/artifact-source/configure', {
      method: 'POST',
      body: JSON.stringify({
        type: 'gcs',
        location: 'gs://b/p',
        runId: 'r1',
        options: { impersonatedServiceAccount: '  svc@proj.iam.gserviceaccount.com  ' },
      }),
    });

    expect(response.status).toBe(200);
    expect(configureArtifactSource).toHaveBeenCalledWith('gcs', 'gs://b/p', 'r1', {
      impersonatedServiceAccount: 'svc@proj.iam.gserviceaccount.com',
    });
  });

  it('refreshes remote discovery via POST /api/artifact-source/refresh', async () => {
    const refreshRemoteArtifactDiscovery = vi.fn(async () => ({
      mode: 'remote' as const,
      currentSource: 'remote' as const,
      label: 'Remote',
      checkedAtMs: 1,
      remoteProvider: 's3' as const,
      remoteLocation: 'S3 b/p',
      pollIntervalMs: 15_000,
      currentRun: null,
      pendingRun: null,
      supportsSwitch: false,
    }));

    server = await startRouteServer({ refreshRemoteArtifactDiscovery });

    const response = await readJsonResponse(server, '/api/artifact-source/refresh', {
      method: 'POST',
    });

    expect(response.status).toBe(200);
    expect(refreshRemoteArtifactDiscovery).toHaveBeenCalledTimes(1);
  });

  it('returns JSON when refresh throws', async () => {
    const refreshRemoteArtifactDiscovery = vi.fn(async () => {
      throw new Error('remote listing failed');
    });

    server = await startRouteServer({ refreshRemoteArtifactDiscovery });

    const response = await readJsonResponse(server, '/api/artifact-source/refresh', {
      method: 'POST',
    });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'remote listing failed' });
  });

  it('accepts a pending remote run via POST /api/artifact-source/accept-pending-run', async () => {
    const acceptPendingRemoteRun = vi.fn(async () => ({
      mode: 'remote' as const,
      currentSource: 'remote' as const,
      label: 'Remote',
      checkedAtMs: 1,
      remoteProvider: 's3' as const,
      remoteLocation: 'S3 b/p',
      pollIntervalMs: 15_000,
      currentRun: {
        runId: 'run-2',
        label: 'run-2',
        updatedAtMs: 2,
        versionToken: 'run-2',
      },
      pendingRun: null,
      supportsSwitch: false,
    }));

    server = await startRouteServer({ acceptPendingRemoteRun });

    const response = await readJsonResponse(server, '/api/artifact-source/accept-pending-run', {
      method: 'POST',
      body: JSON.stringify({ runId: 'run-2' }),
    });

    expect(response.status).toBe(200);
    expect(acceptPendingRemoteRun).toHaveBeenCalledWith('run-2');
  });
});
