import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createReadStreamValidated,
  existsValidated,
  getObjectProperty,
  realpathValidatedSync,
  statValidatedSync,
} from '@dbt-tools/core';

import { ArtifactSourceService } from '../artifact-source/source-service.js';
import { tryHandleArtifactSourceViteRequest } from '../artifact-source/vite-artifact-routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, '../../dist');

let DIST_ROOT_REAL: string;
try {
  DIST_ROOT_REAL = realpathValidatedSync(DIST_DIR);
} catch {
  DIST_ROOT_REAL = path.resolve(DIST_DIR);
}

const INDEX_HTML = path.join(DIST_DIR, 'index.html');

/** Loopback host used for listen and advertised URLs (IPv4; avoids localhost → ::1 mismatch). */
export const LISTEN_HOST = '127.0.0.1';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain',
};

function isContainedUnderRoot(root: string, candidateResolved: string): boolean {
  const rel = path.relative(root, candidateResolved);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Path safe for `fs.*`: validate relative to logical `DIST_DIR`, then rebuild with
 * `path.join(DIST_ROOT_REAL, rel)` + `realpathSync` so CodeQL `js/path-injection` sees a guarded join.
 */
function toSafeAbsoluteUnderDist(candidatePath: string): string {
  const resolvedInput = path.resolve(candidatePath);
  const rel = path.relative(DIST_DIR, resolvedInput);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return INDEX_HTML;
  }
  const underReal = path.join(DIST_ROOT_REAL, rel);
  try {
    const canonical = realpathValidatedSync(underReal);
    return isContainedUnderRoot(DIST_ROOT_REAL, canonical) ? canonical : INDEX_HTML;
  } catch {
    return underReal;
  }
}

/**
 * URL path → filesystem path under dist (traversal + symlink escape). Symlinked `DIST_DIR` uses logical containment first.
 */
export function resolveStaticPath(urlPath: string): string {
  const safe = urlPath.startsWith('/') ? urlPath : `/${urlPath}`;
  const pathOnly = safe.split('?')[0] ?? '/';
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathOnly);
  } catch {
    return INDEX_HTML;
  }

  const relativeSegment = decoded.replace(/^\/+/, '') || '.';
  const resolved = path.resolve(DIST_DIR, relativeSegment);

  if (!isContainedUnderRoot(DIST_DIR, resolved)) {
    return INDEX_HTML;
  }

  try {
    const canonical = realpathValidatedSync(resolved);
    if (!isContainedUnderRoot(DIST_ROOT_REAL, canonical)) {
      return INDEX_HTML;
    }
    return canonical;
  } catch {
    return resolved;
  }
}

function requestPathname(req: http.IncomingMessage): string {
  return (req.url ?? '/').split('?')[0] ?? '/';
}

/** 500 body, or destroy if a response was already started (e.g. mid-stream read failure). */
function sendInternalError(res: http.ServerResponse, destroyIfPartial: boolean): void {
  if (!res.headersSent) {
    res.statusCode = 500;
    res.end('Internal server error');
  } else if (destroyIfPartial) {
    res.destroy();
  }
}

function sendFileWithOptionalSpaFallback(
  primaryPath: string,
  res: http.ServerResponse,
  allowSpaFallback: boolean,
): void {
  const safePath = toSafeAbsoluteUnderDist(primaryPath);
  const stream = createReadStreamValidated(safePath);
  stream.on('error', () => {
    stream.destroy();
    if (allowSpaFallback && !res.headersSent) {
      sendFileWithOptionalSpaFallback(INDEX_HTML, res, false);
      return;
    }
    sendInternalError(res, true);
  });

  const ext = path.extname(safePath).toLowerCase();
  const mime =
    (getObjectProperty(MIME as Record<string, unknown>, ext) as string | undefined) ??
    'application/octet-stream';
  res.setHeader('Content-Type', mime);
  res.statusCode = 200;
  stream.pipe(res);
}

function serveStaticFile(filePath: string, res: http.ServerResponse): void {
  const safeResolved = toSafeAbsoluteUnderDist(filePath);
  const safeIndex = toSafeAbsoluteUnderDist(INDEX_HTML);
  let target = safeResolved;
  if (!existsValidated(target) || statValidatedSync(target).isDirectory()) {
    target = safeIndex;
  }
  const allowSpaFallback = safeResolved !== safeIndex;
  sendFileWithOptionalSpaFallback(target, res, allowSpaFallback);
}

function sendApiNotFound(res: http.ServerResponse): void {
  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ error: 'not_found' }));
}

export function startServer(port: number): Promise<void> {
  const service = new ArtifactSourceService();

  const server = http.createServer((req, res) => {
    void (async () => {
      try {
        const handled = await tryHandleArtifactSourceViteRequest(req, res, service);
        if (handled) return;

        const pathname = requestPathname(req);
        if (pathname === '/api' || pathname.startsWith('/api/')) {
          sendApiNotFound(res);
          return;
        }

        serveStaticFile(resolveStaticPath(req.url ?? '/'), res);
      } catch {
        sendInternalError(res, false);
        console.error('[dbt-tools-web] request failed');
      }
    })();
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, LISTEN_HOST, () => {
      resolve();
    });
  });
}
