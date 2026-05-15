import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  DBT_CATALOG_JSON,
  DBT_MANIFEST_JSON,
  DBT_RUN_RESULTS_JSON,
  DBT_SOURCES_JSON,
  readStreamWithByteCap,
} from '@dbt-tools/core';
import type { ArtifactSourceKind } from '@dbt-tools/core';
import type { ArtifactSourceService } from './sourceService';

/** Cap for JSON bodies on Vite dev artifact POST routes (switch/configure/discover). */
const MAX_ARTIFACT_API_JSON_BYTES = 256 * 1024;

const WEB_API_TOKEN_ENV = 'DBT_TOOLS_WEB_API_TOKEN';
const WEB_REQUIRE_POST_TOKEN_ENV = 'DBT_TOOLS_WEB_REQUIRE_POST_TOKEN';

let warnedTokenWithoutRequire = false;

/** @internal Vitest-only: resets one-shot stderr warning deduplication. */
export function resetArtifactPostTokenWarnStateForTests(): void {
  warnedTokenWithoutRequire = false;
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * When POST enforcement is active, returns the expected token; otherwise `undefined`.
 * Emits the one-time warning when a token is set without `DBT_TOOLS_WEB_REQUIRE_POST_TOKEN=1`.
 */
function artifactPostEnforcedToken(): string | undefined {
  const token = process.env[WEB_API_TOKEN_ENV]?.trim();
  const requirePost = process.env[WEB_REQUIRE_POST_TOKEN_ENV]?.trim() === '1';
  if (token && !requirePost && !warnedTokenWithoutRequire) {
    warnedTokenWithoutRequire = true;
    console.warn(
      '[dbt-tools-web] DBT_TOOLS_WEB_API_TOKEN is set but POST enforcement is disabled. ' +
        `Set ${WEB_REQUIRE_POST_TOKEN_ENV}=1 to require the x-dbt-tools-api-token header on artifact POST routes ` +
        '(the bundled browser UI does not send it unless a reverse proxy injects the header). See AGENTS.md Security posture.',
    );
  }
  return token && requirePost ? token : undefined;
}

class ArtifactApiPayloadTooLargeError extends Error {
  constructor(public readonly limitBytes: number) {
    super(`Request body exceeds maximum size (${limitBytes} bytes).`);
    this.name = 'ArtifactApiPayloadTooLargeError';
  }
}

class ArtifactApiInvalidJsonError extends Error {
  constructor(message = 'Request body must be valid JSON.') {
    super(message);
    this.name = 'ArtifactApiInvalidJsonError';
  }
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  let bytes: Uint8Array;
  try {
    bytes = await readStreamWithByteCap(
      request as AsyncIterable<Buffer | Uint8Array | string>,
      MAX_ARTIFACT_API_JSON_BYTES,
      'artifact API POST body',
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    if (
      msg.startsWith(
        `Object exceeds configured maximum size (${MAX_ARTIFACT_API_JSON_BYTES} bytes):`,
      )
    ) {
      throw new ArtifactApiPayloadTooLargeError(MAX_ARTIFACT_API_JSON_BYTES);
    }
    throw error;
  }
  if (bytes.byteLength === 0) return {};
  const raw = Buffer.from(bytes).toString('utf8');
  if (raw.trim() === '') return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new ArtifactApiInvalidJsonError();
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ArtifactApiInvalidJsonError('Request body must be a JSON object.');
  }
  return parsed as Record<string, unknown>;
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.setHeader('Content-Type', 'application/json');
  res.statusCode = statusCode;
  res.end(JSON.stringify(payload));
}

function assertArtifactApiToken(req: IncomingMessage, res: ServerResponse): boolean {
  const expected = artifactPostEnforcedToken();
  if (expected === undefined) return true;
  const got = req.headers['x-dbt-tools-api-token'];
  const raw = Array.isArray(got) ? got[0] : got;
  if (!timingSafeStringEqual(raw ?? '', expected)) {
    sendJson(res, 401, { error: 'Unauthorized' });
    return false;
  }
  return true;
}

async function readArtifactPostJson(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<Record<string, unknown> | null> {
  if (!assertArtifactApiToken(req, res)) return null;
  try {
    return await readJsonBody(req);
  } catch (error) {
    if (error instanceof ArtifactApiPayloadTooLargeError) {
      sendJson(res, 413, { error: error.message });
      req.destroy();
      return null;
    }
    if (error instanceof ArtifactApiInvalidJsonError) {
      sendJson(res, 400, { error: error.message });
      return null;
    }
    throw error;
  }
}

function currentArtifactBytes(
  pathname: string,
  current: Awaited<ReturnType<ArtifactSourceService['getCurrentArtifacts']>>,
): Uint8Array | null {
  if (current == null) return null;
  if (pathname.endsWith(DBT_MANIFEST_JSON)) return current.manifestBytes;
  if (pathname.endsWith(DBT_RUN_RESULTS_JSON)) return current.runResultsBytes;
  if (pathname.endsWith(DBT_CATALOG_JSON)) return current.catalogBytes ?? null;
  if (pathname.endsWith(DBT_SOURCES_JSON)) return current.sourcesBytes ?? null;
  return null;
}

const CURRENT_ARTIFACT_PATHS = new Set([
  `/api/${DBT_MANIFEST_JSON}`,
  `/api/artifacts/current/${DBT_MANIFEST_JSON}`,
  `/api/${DBT_RUN_RESULTS_JSON}`,
  `/api/artifacts/current/${DBT_RUN_RESULTS_JSON}`,
  `/api/${DBT_CATALOG_JSON}`,
  `/api/artifacts/current/${DBT_CATALOG_JSON}`,
  `/api/${DBT_SOURCES_JSON}`,
  `/api/artifacts/current/${DBT_SOURCES_JSON}`,
]);

function requestPathname(req: IncomingMessage): string | null {
  return req.url?.split('?')[0] ?? null;
}

function isArtifactStatusRequest(req: IncomingMessage, pathname: string): boolean {
  return req.method === 'GET' && pathname === '/api/artifact-source';
}

function isArtifactSwitchRequest(req: IncomingMessage, pathname: string): boolean {
  return req.method === 'POST' && pathname === '/api/artifact-source/switch';
}

function isArtifactConfigureRequest(req: IncomingMessage, pathname: string): boolean {
  return req.method === 'POST' && pathname === '/api/artifact-source/configure';
}

function isArtifactDiscoverRequest(req: IncomingMessage, pathname: string): boolean {
  return req.method === 'POST' && pathname === '/api/artifact-source/discover';
}

function isCurrentArtifactRequest(req: IncomingMessage, pathname: string): boolean {
  return req.method === 'GET' && CURRENT_ARTIFACT_PATHS.has(pathname);
}

function sendArtifactSourceBadRequest(res: ServerResponse, error: unknown): void {
  sendJson(res, 400, {
    error: error instanceof Error ? error.message : 'Invalid configuration.',
  });
}

async function respondArtifactStatus(
  res: ServerResponse,
  service: ArtifactSourceService,
): Promise<void> {
  sendJson(res, 200, await service.getStatus());
}

async function respondArtifactSwitch(
  req: IncomingMessage,
  res: ServerResponse,
  service: ArtifactSourceService,
): Promise<void> {
  const body = await readArtifactPostJson(req, res);
  if (body == null) return;
  const runId = typeof body.runId === 'string' && body.runId.trim() !== '' ? body.runId : undefined;
  sendJson(res, 200, await service.switchToRun(runId));
}

async function respondArtifactConfigure(
  req: IncomingMessage,
  res: ServerResponse,
  service: ArtifactSourceService,
): Promise<void> {
  const body = await readArtifactPostJson(req, res);
  if (body == null) return;
  const typeRaw = body.type;
  const locationRaw = body.location;
  const runIdRaw = body.runId;
  const location = typeof locationRaw === 'string' ? locationRaw.trim() : '';
  const runId = typeof runIdRaw === 'string' ? runIdRaw.trim() : undefined;
  if (typeRaw !== 'local' && typeRaw !== 's3' && typeRaw !== 'gcs') {
    sendJson(res, 400, {
      error: 'Invalid or missing type (expected local, s3, or gcs).',
    });
    return;
  }
  try {
    const status = await service.configureArtifactSource(
      typeRaw as ArtifactSourceKind,
      location,
      runId,
    );
    sendJson(res, 200, status);
  } catch (error) {
    sendArtifactSourceBadRequest(res, error);
  }
}

async function respondArtifactDiscover(
  req: IncomingMessage,
  res: ServerResponse,
  service: ArtifactSourceService,
): Promise<void> {
  const body = await readArtifactPostJson(req, res);
  if (body == null) return;
  const typeRaw = body.type;
  const locationRaw = body.location;
  const location = typeof locationRaw === 'string' ? locationRaw.trim() : '';
  if (typeRaw !== 'local' && typeRaw !== 's3' && typeRaw !== 'gcs') {
    sendJson(res, 400, {
      error: 'Invalid or missing type (expected local, s3, or gcs).',
    });
    return;
  }
  try {
    const discovery = await service.discoverArtifactSource(typeRaw as ArtifactSourceKind, location);
    sendJson(res, 200, discovery);
  } catch (error) {
    sendArtifactSourceBadRequest(res, error);
  }
}

async function respondCurrentArtifactBytes(
  pathname: string,
  res: ServerResponse,
  service: ArtifactSourceService,
): Promise<void> {
  const current = await service.getCurrentArtifacts();
  const bytes = currentArtifactBytes(pathname, current);
  if (bytes == null) {
    res.statusCode = 404;
    res.end();
    return;
  }

  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 200;
  res.end(Buffer.from(bytes));
}

/**
 * Vite middleware handler for artifact-source HTTP routes. Returns `true` when
 * the request was fully handled (response ended).
 */
export async function tryHandleArtifactSourceViteRequest(
  req: IncomingMessage,
  res: ServerResponse,
  service: ArtifactSourceService,
): Promise<boolean> {
  const pathname = requestPathname(req);
  if (!pathname) return false;

  if (isArtifactStatusRequest(req, pathname)) {
    await respondArtifactStatus(res, service);
    return true;
  }

  if (isArtifactSwitchRequest(req, pathname)) {
    await respondArtifactSwitch(req, res, service);
    return true;
  }

  if (isArtifactConfigureRequest(req, pathname)) {
    await respondArtifactConfigure(req, res, service);
    return true;
  }

  if (isArtifactDiscoverRequest(req, pathname)) {
    await respondArtifactDiscover(req, res, service);
    return true;
  }

  if (isCurrentArtifactRequest(req, pathname)) {
    await respondCurrentArtifactBytes(pathname, res, service);
    return true;
  }

  return false;
}
