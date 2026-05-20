import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as coreSafeFs from '@dbt-tools/core';
import {
  mkdtempSyncValidated,
  resolveJoinedSafe,
  rmSyncValidated,
  writeValidatedUtf8Sync,
} from '@dbt-tools/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ArtifactSourceDiscoveryResult,
  ArtifactSourceStatus,
} from '../services/artifact-source-api';

// Hoist the mock so it applies before module imports.
vi.mock('../artifact-source/source-service', () => {
  class ArtifactSourceService {
    async getStatus(): Promise<ArtifactSourceStatus> {
      return {
        mode: 'none',
        currentSource: null,
        label: 'Waiting for artifacts',
        remoteProvider: null,
        remoteLocation: null,
        pollIntervalMs: null,
        currentRun: null,
        pendingRun: null,
        supportsSwitch: false,
        checkedAtMs: 0,
      };
    }
    async getCurrentArtifacts() {
      return {
        source: 'preload' as const,
        manifestBytes: new TextEncoder().encode('{"manifest":true}'),
        runResultsBytes: new TextEncoder().encode('{"run_results":true}'),
        catalogBytes: new TextEncoder().encode('{"catalog":true}'),
        sourcesBytes: new TextEncoder().encode('{"sources":true}'),
      };
    }
    async switchToRun() {
      return this.getStatus();
    }
    async discoverArtifactSource(): Promise<ArtifactSourceDiscoveryResult> {
      return {
        sourceKind: 'local',
        locationDisplay: '/tmp/mock',
        discoveryError: null,
      };
    }
    async configureArtifactSource() {
      return this.getStatus();
    }
  }
  return { ArtifactSourceService };
});

function httpGet(url: string): Promise<{ status: number; body: string; contentType: string }> {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let body = '';
        res.on('data', (chunk: Buffer) => {
          body += chunk.toString();
        });
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 0,
            body,
            contentType: res.headers['content-type'] ?? '',
          }),
        );
      })
      .on('error', reject);
  });
}

describe('resolveStaticPath', () => {
  // Import the real module (ArtifactSourceService is mocked above).
  let resolveStaticPath: (urlPath: string) => string;
  let DIST_DIR: string;

  beforeEach(async () => {
    const mod = await import('./serve');
    resolveStaticPath = mod.resolveStaticPath;
    // Derive DIST_DIR the same way serve.ts does: two levels above src/server/
    // In the test context __dirname = src/server, so DIST_DIR = web/dist
    DIST_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../dist');
  });

  it('maps root to DIST_DIR (caller handles directory → index.html fallback)', () => {
    const result = resolveStaticPath('/');
    // path.join(DIST_DIR, "/") may include a trailing separator; strip it.
    expect(path.resolve(result)).toBe(path.resolve(DIST_DIR));
  });

  it('maps a file path within dist', () => {
    const result = resolveStaticPath('/assets/main.js');
    expect(path.resolve(result)).toBe(path.resolve(DIST_DIR, 'assets', 'main.js'));
  });

  it('blocks path traversal by falling back to index.html', () => {
    // A traversal attempt that tries to escape DIST_DIR
    const result = resolveStaticPath('/../../../etc/passwd');
    expect(result).toBe(path.join(DIST_DIR, 'index.html'));
  });

  it('strips query strings before resolving', () => {
    const result = resolveStaticPath('/foo.js?v=123');
    expect(result).toBe(path.join(DIST_DIR, 'foo.js'));
  });

  it('decodes percent-encoded characters', () => {
    const result = resolveStaticPath('/my%20file.js');
    expect(result).toBe(path.join(DIST_DIR, 'my file.js'));
  });
});

describe('startServer', () => {
  let srv: http.Server | undefined;
  let listenPort: number;
  let listenHost: string;

  beforeEach(async () => {
    const { LISTEN_HOST, startServer } = await import('./serve');
    listenHost = LISTEN_HOST;

    // Intercept http.createServer to capture the server instance so we can
    // close it after each test.
    const origCreate = http.createServer.bind(http);
    const spy = vi.spyOn(http, 'createServer').mockImplementation(((
      handler?: http.RequestListener,
    ) => {
      const s = origCreate(handler);
      srv = s;
      return s;
    }) as typeof http.createServer);

    await startServer(0);
    spy.mockRestore();

    listenPort = (srv!.address() as { port: number }).port;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (srv) {
      await new Promise<void>((r) => srv!.close(() => r()));
      srv = undefined;
    }
  });

  it('listens on LISTEN_HOST with a non-zero port', () => {
    const addr = srv!.address();
    expect(addr).not.toBeNull();
    expect(typeof addr).toBe('object');
    const a = addr as { address: string; port: number };
    expect(a.address).toBe(listenHost);
    expect(a.port).toBeGreaterThan(0);
    expect(listenPort).toBe(a.port);
  });

  it('returns 404 JSON for unhandled /api routes', async () => {
    const { status, body, contentType } = await httpGet(
      `http://${listenHost}:${listenPort}/api/health`,
    );
    expect(status).toBe(404);
    expect(contentType).toContain('application/json');
    expect(JSON.parse(body) as { error: string }).toEqual({
      error: 'not_found',
    });
  });

  it('handles GET /api/artifact-source and returns JSON with mode=none', async () => {
    const { status, body, contentType } = await httpGet(
      `http://${listenHost}:${listenPort}/api/artifact-source`,
    );
    expect(status).toBe(200);
    expect(contentType).toContain('application/json');
    const parsed = JSON.parse(body) as ArtifactSourceStatus;
    expect(parsed.mode).toBe('none');
  });

  it('serves optional catalog and sources artifact routes', async () => {
    const catalogResponse = await httpGet(`http://${listenHost}:${listenPort}/api/catalog.json`);
    const sourcesResponse = await httpGet(`http://${listenHost}:${listenPort}/api/sources.json`);

    expect(catalogResponse.status).toBe(200);
    expect(catalogResponse.contentType).toContain('application/json');
    expect(catalogResponse.body).toContain('catalog');
    expect(sourcesResponse.status).toBe(200);
    expect(sourcesResponse.body).toContain('sources');
  });

  it('serves index.html as the SPA fallback for unknown paths', async () => {
    // Create a temp directory with a minimal index.html and point DIST_DIR to it.
    const tmpDir = mkdtempSyncValidated(path.join(os.tmpdir(), 'dbt-serve-fallback-'));
    writeValidatedUtf8Sync(resolveJoinedSafe(tmpDir, 'index.html'), '<!DOCTYPE html>SPA');

    const distRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../dist');
    const distRootResolved = path.resolve(distRoot);

    function mapDistToTmp(p: Buffer | URL | string): string {
      const resolved = path.resolve(String(p));
      if (resolved === distRootResolved) {
        return tmpDir;
      }
      const prefix = `${distRootResolved}${path.sep}`;
      if (resolved.startsWith(prefix)) {
        return path.join(tmpDir, path.relative(distRootResolved, resolved));
      }
      return String(p);
    }

    // Patch safe-fs helpers to redirect resolved dist/ reads to tmpDir.
    const origExistsValidated = coreSafeFs.existsValidated;
    const origStatValidatedSync = coreSafeFs.statValidatedSync;
    const origCreateReadStreamValidated = coreSafeFs.createReadStreamValidated;

    vi.spyOn(coreSafeFs, 'existsValidated').mockImplementation((p) => {
      return origExistsValidated(mapDistToTmp(p));
    });
    vi.spyOn(coreSafeFs, 'statValidatedSync').mockImplementation((p) => {
      return origStatValidatedSync(mapDistToTmp(p));
    });
    vi.spyOn(coreSafeFs, 'createReadStreamValidated').mockImplementation((p) => {
      return origCreateReadStreamValidated(mapDistToTmp(p));
    });

    const { status, body } = await httpGet(`http://${listenHost}:${listenPort}/unknown-route`);

    rmSyncValidated(tmpDir, { recursive: true, force: true });

    expect(status).toBe(200);
    expect(body).toContain('SPA');
  });
});
