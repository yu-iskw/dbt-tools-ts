import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  DBT_CATALOG_JSON,
  DBT_MANIFEST_JSON,
  DBT_RUN_RESULTS_JSON,
  DBT_SOURCES_JSON,
} from '@dbt-tools/core';
import type { ArtifactSourceKind } from '@dbt-tools/core';
import type { ArtifactSourceService } from './sourceService';

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.setHeader('Content-Type', 'application/json');
  res.statusCode = statusCode;
  res.end(JSON.stringify(payload));
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
  const body = await readJsonBody(req);
  const runId = typeof body.runId === 'string' && body.runId.trim() !== '' ? body.runId : undefined;
  sendJson(res, 200, await service.switchToRun(runId));
}

async function respondArtifactConfigure(
  req: IncomingMessage,
  res: ServerResponse,
  service: ArtifactSourceService,
): Promise<void> {
  const body = await readJsonBody(req);
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
    sendJson(res, 400, {
      error: error instanceof Error ? error.message : 'Invalid configuration.',
    });
  }
}

async function respondArtifactDiscover(
  req: IncomingMessage,
  res: ServerResponse,
  service: ArtifactSourceService,
): Promise<void> {
  const body = await readJsonBody(req);
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
    sendJson(res, 400, {
      error: error instanceof Error ? error.message : 'Invalid configuration.',
    });
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
