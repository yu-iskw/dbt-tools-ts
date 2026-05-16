import http from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ArtifactSourceService } from './sourceService';
import { tryHandleArtifactSourceViteRequest } from './viteArtifactRoutes';

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
      candidates: [
        {
          runId: 'run-a',
          label: 'Local (run-a)',
          updatedAtMs: 1,
          versionToken: 'a',
        },
      ],
      needsSelection: false,
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

  it('rejects options for local artifact source on discover with 400', async () => {
    const discoverArtifactSource = vi.fn();
    server = await startRouteServer({ discoverArtifactSource });

    const response = await readJsonResponse(server, '/api/artifact-source/discover', {
      method: 'POST',
      body: JSON.stringify({
        type: 'local',
        location: '/tmp/preview',
        options: { impersonatedServiceAccount: 'sa@project.iam.gserviceaccount.com' },
      }),
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error:
        'Service account impersonation is only supported for Google Cloud Storage. Options are not supported for local or S3 artifact sources.',
    });
    expect(discoverArtifactSource).not.toHaveBeenCalled();
  });

  it('rejects options for s3 artifact source on discover with 400', async () => {
    const discoverArtifactSource = vi.fn();
    server = await startRouteServer({ discoverArtifactSource });

    const response = await readJsonResponse(server, '/api/artifact-source/discover', {
      method: 'POST',
      body: JSON.stringify({
        type: 's3',
        location: 's3://bucket/prefix',
        options: { impersonatedServiceAccount: 'sa@project.iam.gserviceaccount.com' },
      }),
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error:
        'Service account impersonation is only supported for Google Cloud Storage. Options are not supported for local or S3 artifact sources.',
    });
    expect(discoverArtifactSource).not.toHaveBeenCalled();
  });

  it('passes trimmed impersonatedServiceAccount to discoverArtifactSource for gcs', async () => {
    const discoverArtifactSource = vi.fn(async () => ({
      sourceKind: 'gcs' as const,
      locationDisplay: 'GCS bucket/prefix',
      candidates: [],
      needsSelection: false,
      discoveryError: null,
    }));
    server = await startRouteServer({ discoverArtifactSource });

    const response = await readJsonResponse(server, '/api/artifact-source/discover', {
      method: 'POST',
      body: JSON.stringify({
        type: 'gcs',
        location: 'gs://bucket/prefix',
        options: { impersonatedServiceAccount: '  sa@project.iam.gserviceaccount.com  ' },
      }),
    });

    expect(response.status).toBe(200);
    expect(discoverArtifactSource).toHaveBeenCalledWith('gcs', 'gs://bucket/prefix', {
      impersonatedServiceAccount: 'sa@project.iam.gserviceaccount.com',
    });
  });

  it('passes trimmed impersonatedServiceAccount to configureArtifactSource for gcs', async () => {
    const configureArtifactSource = vi.fn(async () => ({
      mode: 'remote',
      currentSource: 'remote',
      label: 'GCS bucket/prefix',
      checkedAtMs: 1,
      remoteProvider: 'gcs',
      remoteLocation: 'gs://bucket/prefix',
      pollIntervalMs: null,
      currentRun: { runId: 'run-1', label: 'run-1', updatedAtMs: 1, versionToken: 'v1' },
      pendingRun: null,
      supportsSwitch: false,
    }));
    server = await startRouteServer({ configureArtifactSource });

    const response = await readJsonResponse(server, '/api/artifact-source/configure', {
      method: 'POST',
      body: JSON.stringify({
        type: 'gcs',
        location: 'gs://bucket/prefix',
        runId: 'run-1',
        options: { impersonatedServiceAccount: 'sa@project.iam.gserviceaccount.com' },
      }),
    });

    expect(response.status).toBe(200);
    expect(configureArtifactSource).toHaveBeenCalledWith('gcs', 'gs://bucket/prefix', 'run-1', {
      impersonatedServiceAccount: 'sa@project.iam.gserviceaccount.com',
    });
  });

  it('rejects options for local artifact source on configure with 400', async () => {
    const configureArtifactSource = vi.fn();
    server = await startRouteServer({ configureArtifactSource });

    const response = await readJsonResponse(server, '/api/artifact-source/configure', {
      method: 'POST',
      body: JSON.stringify({
        type: 'local',
        location: '/tmp/preview',
        options: { impersonatedServiceAccount: 'sa@project.iam.gserviceaccount.com' },
      }),
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error:
        'Service account impersonation is only supported for Google Cloud Storage. Options are not supported for local or S3 artifact sources.',
    });
    expect(configureArtifactSource).not.toHaveBeenCalled();
  });
});
