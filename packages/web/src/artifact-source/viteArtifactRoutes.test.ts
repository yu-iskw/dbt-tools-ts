import http from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArtifactSourceService } from './sourceService';
import {
  resetArtifactPostTokenWarnStateForTests,
  tryHandleArtifactSourceViteRequest,
} from './viteArtifactRoutes';

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

  beforeEach(() => {
    resetArtifactPostTokenWarnStateForTests();
  });

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
    expect(discoverArtifactSource).toHaveBeenCalledWith('local', '/tmp/preview');
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
    expect(configureArtifactSource).toHaveBeenCalledWith('local', '/tmp/preview', 'missing-run');
  });

  it('returns 413 when the JSON body exceeds the size cap', async () => {
    const prevToken = process.env.DBT_TOOLS_WEB_API_TOKEN;
    const prevRequire = process.env.DBT_TOOLS_WEB_REQUIRE_POST_TOKEN;
    delete process.env.DBT_TOOLS_WEB_API_TOKEN;
    delete process.env.DBT_TOOLS_WEB_REQUIRE_POST_TOKEN;
    try {
      const pad = 'x'.repeat(260 * 1024);
      const payload = JSON.stringify({ type: 'local', location: '/tmp', pad });
      expect(Buffer.byteLength(payload, 'utf8')).toBeGreaterThan(256 * 1024);

      server = await startRouteServer({
        discoverArtifactSource: vi.fn(),
        configureArtifactSource: vi.fn(),
      });

      const response = await readJsonResponse(server, '/api/artifact-source/discover', {
        method: 'POST',
        body: payload,
      });
      expect(response.status).toBe(413);
      expect(typeof response.body.error).toBe('string');
      expect(response.body.error).toMatch(/exceeds maximum size/i);
    } finally {
      if (prevToken === undefined) delete process.env.DBT_TOOLS_WEB_API_TOKEN;
      else process.env.DBT_TOOLS_WEB_API_TOKEN = prevToken;
      if (prevRequire === undefined) delete process.env.DBT_TOOLS_WEB_REQUIRE_POST_TOKEN;
      else process.env.DBT_TOOLS_WEB_REQUIRE_POST_TOKEN = prevRequire;
    }
  });

  it('returns 400 for invalid JSON bodies', async () => {
    const prevToken = process.env.DBT_TOOLS_WEB_API_TOKEN;
    const prevRequire = process.env.DBT_TOOLS_WEB_REQUIRE_POST_TOKEN;
    delete process.env.DBT_TOOLS_WEB_API_TOKEN;
    delete process.env.DBT_TOOLS_WEB_REQUIRE_POST_TOKEN;
    try {
      server = await startRouteServer({
        discoverArtifactSource: vi.fn(),
        configureArtifactSource: vi.fn(),
      });

      const response = await readJsonResponse(server, '/api/artifact-source/discover', {
        method: 'POST',
        body: '{not-json',
      });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Request body must be valid JSON.' });
    } finally {
      if (prevToken === undefined) delete process.env.DBT_TOOLS_WEB_API_TOKEN;
      else process.env.DBT_TOOLS_WEB_API_TOKEN = prevToken;
      if (prevRequire === undefined) delete process.env.DBT_TOOLS_WEB_REQUIRE_POST_TOKEN;
      else process.env.DBT_TOOLS_WEB_REQUIRE_POST_TOKEN = prevRequire;
    }
  });

  it('returns 400 when JSON parses but is not a plain object', async () => {
    const prevToken = process.env.DBT_TOOLS_WEB_API_TOKEN;
    const prevRequire = process.env.DBT_TOOLS_WEB_REQUIRE_POST_TOKEN;
    delete process.env.DBT_TOOLS_WEB_API_TOKEN;
    delete process.env.DBT_TOOLS_WEB_REQUIRE_POST_TOKEN;
    try {
      server = await startRouteServer({
        discoverArtifactSource: vi.fn(),
        configureArtifactSource: vi.fn(),
      });

      const response = await readJsonResponse(server, '/api/artifact-source/discover', {
        method: 'POST',
        body: '[]',
      });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Request body must be a JSON object.' });
    } finally {
      if (prevToken === undefined) delete process.env.DBT_TOOLS_WEB_API_TOKEN;
      else process.env.DBT_TOOLS_WEB_API_TOKEN = prevToken;
      if (prevRequire === undefined) delete process.env.DBT_TOOLS_WEB_REQUIRE_POST_TOKEN;
      else process.env.DBT_TOOLS_WEB_REQUIRE_POST_TOKEN = prevRequire;
    }
  });

  it('requires x-dbt-tools-api-token when DBT_TOOLS_WEB_REQUIRE_POST_TOKEN=1 and DBT_TOOLS_WEB_API_TOKEN is set', async () => {
    const prevToken = process.env.DBT_TOOLS_WEB_API_TOKEN;
    const prevRequire = process.env.DBT_TOOLS_WEB_REQUIRE_POST_TOKEN;
    process.env.DBT_TOOLS_WEB_API_TOKEN = 'expected-secret';
    process.env.DBT_TOOLS_WEB_REQUIRE_POST_TOKEN = '1';
    try {
      const discoverArtifactSource = vi.fn(async () => ({
        sourceKind: 'local' as const,
        locationDisplay: '/tmp/preview',
        candidates: [],
        needsSelection: false,
        discoveryError: null,
      }));

      server = await startRouteServer({
        discoverArtifactSource,
        configureArtifactSource: vi.fn(),
      });

      const address = server.address();
      if (address == null || typeof address === 'string') {
        throw new Error('Server address unavailable');
      }

      const unauthorized = await fetch(
        `http://127.0.0.1:${address.port}/api/artifact-source/discover`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'local', location: '/tmp/preview' }),
        },
      );
      expect(unauthorized.status).toBe(401);
      expect((await unauthorized.json()) as Record<string, unknown>).toEqual({
        error: 'Unauthorized',
      });
      expect(discoverArtifactSource).not.toHaveBeenCalled();

      const ok = await fetch(`http://127.0.0.1:${address.port}/api/artifact-source/discover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-dbt-tools-api-token': 'expected-secret',
        },
        body: JSON.stringify({ type: 'local', location: '/tmp/preview' }),
      });
      expect(ok.status).toBe(200);
      expect(discoverArtifactSource).toHaveBeenCalledOnce();
    } finally {
      if (prevToken === undefined) delete process.env.DBT_TOOLS_WEB_API_TOKEN;
      else process.env.DBT_TOOLS_WEB_API_TOKEN = prevToken;
      if (prevRequire === undefined) delete process.env.DBT_TOOLS_WEB_REQUIRE_POST_TOKEN;
      else process.env.DBT_TOOLS_WEB_REQUIRE_POST_TOKEN = prevRequire;
    }
  });

  it('allows POST without header when token is set but require flag is unset and warns once', async () => {
    const prevToken = process.env.DBT_TOOLS_WEB_API_TOKEN;
    const prevRequire = process.env.DBT_TOOLS_WEB_REQUIRE_POST_TOKEN;
    process.env.DBT_TOOLS_WEB_API_TOKEN = 'expected-secret';
    delete process.env.DBT_TOOLS_WEB_REQUIRE_POST_TOKEN;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const discoverArtifactSource = vi.fn(async () => ({
        sourceKind: 'local' as const,
        locationDisplay: '/tmp/preview',
        candidates: [],
        needsSelection: false,
        discoveryError: null,
      }));

      server = await startRouteServer({
        discoverArtifactSource,
        configureArtifactSource: vi.fn(),
      });

      const first = await readJsonResponse(server, '/api/artifact-source/discover', {
        method: 'POST',
        body: JSON.stringify({ type: 'local', location: '/tmp/preview' }),
      });
      expect(first.status).toBe(200);
      expect(discoverArtifactSource).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]?.[0]).toContain('DBT_TOOLS_WEB_REQUIRE_POST_TOKEN');

      const second = await readJsonResponse(server, '/api/artifact-source/discover', {
        method: 'POST',
        body: JSON.stringify({ type: 'local', location: '/tmp/preview' }),
      });
      expect(second.status).toBe(200);
      expect(discoverArtifactSource).toHaveBeenCalledTimes(2);
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
      if (prevToken === undefined) delete process.env.DBT_TOOLS_WEB_API_TOKEN;
      else process.env.DBT_TOOLS_WEB_API_TOKEN = prevToken;
      if (prevRequire === undefined) delete process.env.DBT_TOOLS_WEB_REQUIRE_POST_TOKEN;
      else process.env.DBT_TOOLS_WEB_REQUIRE_POST_TOKEN = prevRequire;
    }
  });
});
