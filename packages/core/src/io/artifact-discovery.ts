import * as path from 'node:path';
import fs from 'node:fs/promises';
import {
  DBT_CATALOG_JSON,
  DBT_MANIFEST_JSON,
  DBT_RUN_RESULTS_JSON,
  DBT_SOURCES_JSON,
} from './artifact-filenames';
import { normalizeArtifactPrefix } from './artifact-location';

/** Synthetic run id for artifacts at the location root (not under a subdirectory). */
export const ARTIFACT_RUN_ID_CURRENT = 'current';

export interface ListedArtifactObject {
  /** Path relative to the artifact location root (POSIX, no leading slash). */
  relativePath: string;
  updatedAtMs: number;
  etag?: string;
  generation?: string;
}

export interface ResolvedArtifactCandidate {
  runId: string;
  /** Relative paths from location root (POSIX). */
  manifestRelative: string;
  runResultsRelative: string;
  catalogRelative?: string;
  sourcesRelative?: string;
  updatedAtMs: number;
  versionToken: string;
  hasCatalog: boolean;
  hasSources: boolean;
}

export type MissingRequiredBasename = typeof DBT_MANIFEST_JSON | typeof DBT_RUN_RESULTS_JSON;

export interface ArtifactDiscoveryFailure {
  readonly code: 'MISSING_REQUIRED_PAIR';
  readonly message: string;
  readonly missingBasenames: MissingRequiredBasename[];
}

export type ArtifactDiscoveryResult =
  | { readonly ok: true; readonly candidates: ResolvedArtifactCandidate[] }
  | { readonly ok: false; readonly failure: ArtifactDiscoveryFailure };

function basenamePosix(rel: string): string {
  const i = rel.lastIndexOf('/');
  return i === -1 ? rel : rel.slice(i + 1);
}

function dirnamePosix(rel: string): string {
  const i = rel.lastIndexOf('/');
  return i === -1 ? '.' : rel.slice(0, i);
}

function isSupportedBasename(name: string): boolean {
  return (
    name === DBT_MANIFEST_JSON ||
    name === DBT_RUN_RESULTS_JSON ||
    name === DBT_CATALOG_JSON ||
    name === DBT_SOURCES_JSON
  );
}

/**
 * Non-recursive layout: only the location root and immediate subdirectories
 * may contain artifact files (at most one `/` in the relative path).
 */
export function isAllowedArtifactRelativePath(relativePath: string): boolean {
  const norm = relativePath.replace(/^\/+/, '');
  if (norm === '' || norm.includes('//')) return false;
  const segments = norm.split('/');
  if (segments.length > 2) return false;
  if (segments.length === 1) return isSupportedBasename(segments[0]!);
  return isSupportedBasename(segments[1]!);
}

function runIdForRelativePath(relativePath: string): string {
  const dir = dirnamePosix(relativePath);
  return dir === '.' ? ARTIFACT_RUN_ID_CURRENT : dir;
}

function versionTokenForParts(
  parts: Array<Pick<ListedArtifactObject, 'relativePath' | 'updatedAtMs' | 'etag' | 'generation'>>,
): string {
  return parts
    .map((p) => [p.relativePath, p.updatedAtMs, p.etag ?? '', p.generation ?? ''].join(':'))
    .join('|');
}

function buildMissingRequiredMessage(missing: MissingRequiredBasename[]): string {
  if (missing.length === 0) {
    return (
      'No complete dbt artifact pair found: require manifest.json and ' +
      'run_results.json in the same location root or immediate subdirectory.'
    );
  }
  const list = missing.join(', ');
  return `Missing required artifact(s): ${list}. Both manifest.json and run_results.json are required in the same candidate set.`;
}

type RunArtifactParts = {
  manifest?: ListedArtifactObject;
  runResults?: ListedArtifactObject;
  catalog?: ListedArtifactObject;
  sources?: ListedArtifactObject;
};

function filterListedForDiscovery(objects: ListedArtifactObject[]): ListedArtifactObject[] {
  return objects.filter(
    (o) =>
      isAllowedArtifactRelativePath(o.relativePath) &&
      isSupportedBasename(basenamePosix(o.relativePath)),
  );
}

function groupListedByRunId(filtered: ListedArtifactObject[]): Map<string, RunArtifactParts> {
  const grouped = new Map<string, RunArtifactParts>();
  for (const object of filtered) {
    const runId = runIdForRelativePath(object.relativePath);
    const fileName = basenamePosix(object.relativePath);
    const current = grouped.get(runId) ?? {};

    if (fileName === DBT_MANIFEST_JSON) current.manifest = object;
    if (fileName === DBT_RUN_RESULTS_JSON) current.runResults = object;
    if (fileName === DBT_CATALOG_JSON) current.catalog = object;
    if (fileName === DBT_SOURCES_JSON) current.sources = object;

    grouped.set(runId, current);
  }
  return grouped;
}

function buildResolvedCandidates(
  grouped: Map<string, RunArtifactParts>,
): ResolvedArtifactCandidate[] {
  const candidates: ResolvedArtifactCandidate[] = [];
  for (const [runId, parts] of grouped) {
    if (parts.manifest == null || parts.runResults == null) continue;
    const catalog = parts.catalog;
    const sources = parts.sources;
    candidates.push({
      runId,
      manifestRelative: parts.manifest.relativePath,
      runResultsRelative: parts.runResults.relativePath,
      ...(catalog != null ? { catalogRelative: catalog.relativePath } : {}),
      ...(sources != null ? { sourcesRelative: sources.relativePath } : {}),
      updatedAtMs: Math.max(parts.manifest.updatedAtMs, parts.runResults.updatedAtMs),
      versionToken: versionTokenForParts(
        [parts.manifest, parts.runResults, catalog, sources].filter(
          (p): p is ListedArtifactObject => p != null,
        ),
      ),
      hasCatalog: catalog != null,
      hasSources: sources != null,
    });
  }
  candidates.sort((left, right) => {
    if (right.updatedAtMs !== left.updatedAtMs) {
      return right.updatedAtMs - left.updatedAtMs;
    }
    return left.runId.localeCompare(right.runId);
  });
  return candidates;
}

function noCandidatesFailure(filtered: ListedArtifactObject[]): ArtifactDiscoveryResult {
  const sawManifest = filtered.some((o) => basenamePosix(o.relativePath) === DBT_MANIFEST_JSON);
  const sawRunResults = filtered.some(
    (o) => basenamePosix(o.relativePath) === DBT_RUN_RESULTS_JSON,
  );

  const missingBasenames: MissingRequiredBasename[] = [];
  if (!sawManifest) missingBasenames.push(DBT_MANIFEST_JSON);
  if (!sawRunResults) missingBasenames.push(DBT_RUN_RESULTS_JSON);

  if (missingBasenames.length === 0) {
    return {
      ok: false,
      failure: {
        code: 'MISSING_REQUIRED_PAIR',
        message: buildMissingRequiredMessage([]),
        missingBasenames: [],
      },
    };
  }

  return {
    ok: false,
    failure: {
      code: 'MISSING_REQUIRED_PAIR',
      message: buildMissingRequiredMessage(missingBasenames),
      missingBasenames,
    },
  };
}

/**
 * Turn flat listed objects (relative paths) into valid candidate sets that
 * each include manifest.json + run_results.json.
 */
export function discoverArtifactCandidates(
  objects: ListedArtifactObject[],
): ArtifactDiscoveryResult {
  const filtered = filterListedForDiscovery(objects);
  const grouped = groupListedByRunId(filtered);
  const candidates = buildResolvedCandidates(grouped);

  if (candidates.length > 0) {
    return { ok: true, candidates };
  }

  return noCandidatesFailure(filtered);
}

function toRelativeKey(key: string, prefix: string): string | null {
  const normalizedKey = key.replace(/^\/+/, '');
  const normalizedPrefix = normalizeArtifactPrefix(prefix);
  if (normalizedPrefix === '') return normalizedKey;
  if (normalizedKey === normalizedPrefix) return '';
  if (normalizedKey.startsWith(`${normalizedPrefix}/`)) {
    return normalizedKey.slice(normalizedPrefix.length + 1);
  }
  return null;
}

/** Object-store listing row (S3/GCS). */
export interface RemoteObjectMetadata {
  key: string;
  updatedAtMs: number;
  etag?: string;
  generation?: string;
}

/**
 * Map full object keys under a prefix to {@link ListedArtifactObject} entries.
 */
export function remoteKeysToListedArtifacts(
  objects: RemoteObjectMetadata[],
  prefix: string,
): ListedArtifactObject[] {
  const out: ListedArtifactObject[] = [];
  for (const object of objects) {
    const relativeKey = toRelativeKey(object.key, prefix);
    if (relativeKey == null || relativeKey === '') continue;
    out.push({
      relativePath: relativeKey,
      updatedAtMs: object.updatedAtMs,
      etag: object.etag,
      generation: object.generation,
    });
  }
  return out;
}

/**
 * List immediate artifact files under a local directory (non-recursive beyond one subdirectory).
 */
export interface DiscoveredArtifactRunPaths {
  runId: string;
  manifestKey: string;
  runResultsKey: string;
  catalogKey?: string;
  sourcesKey?: string;
  updatedAtMs: number;
  versionToken: string;
}

export async function discoverLocalArtifactRunPaths(resolvedDirAbs: string): Promise<{
  discovery: ArtifactDiscoveryResult;
  runs: DiscoveredArtifactRunPaths[];
}> {
  const listed = await listLocalArtifactObjects(resolvedDirAbs);
  const discovery = discoverArtifactCandidates(listed);
  if (!discovery.ok) {
    return { discovery, runs: [] };
  }
  const runs: DiscoveredArtifactRunPaths[] = discovery.candidates.map((c) => ({
    runId: c.runId,
    manifestKey: path.join(resolvedDirAbs, c.manifestRelative),
    runResultsKey: path.join(resolvedDirAbs, c.runResultsRelative),
    ...(c.catalogRelative != null
      ? { catalogKey: path.join(resolvedDirAbs, c.catalogRelative) }
      : {}),
    ...(c.sourcesRelative != null
      ? { sourcesKey: path.join(resolvedDirAbs, c.sourcesRelative) }
      : {}),
    updatedAtMs: c.updatedAtMs,
    versionToken: c.versionToken,
  }));
  return { discovery, runs };
}

async function listedFromSubdirArtifacts(
  subDirAbs: string,
  dirSegment: string,
): Promise<ListedArtifactObject[]> {
  let subEntries;
  try {
    subEntries = await fs.readdir(subDirAbs, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: ListedArtifactObject[] = [];
  for (const subEntry of subEntries) {
    const subName = String(subEntry.name);
    if (!subEntry.isFile() || !isSupportedBasename(subName)) continue;
    const full = path.join(subDirAbs, subName);
    try {
      const stat = await fs.stat(full);
      out.push({
        relativePath: `${dirSegment}/${subName}`.replace(/\\/g, '/'),
        updatedAtMs: stat.mtimeMs,
      });
    } catch {
      /* skip */
    }
  }
  return out;
}

export async function listLocalArtifactObjects(
  resolvedDirAbs: string,
): Promise<ListedArtifactObject[]> {
  const entries = await fs.readdir(resolvedDirAbs, { withFileTypes: true });
  const results: ListedArtifactObject[] = [];

  for (const entry of entries) {
    const name = entry.name;
    if (entry.isFile() && isSupportedBasename(name)) {
      const full = path.join(resolvedDirAbs, name);
      const stat = await fs.stat(full);
      results.push({
        relativePath: name,
        updatedAtMs: stat.mtimeMs,
      });
    } else if (entry.isDirectory()) {
      const sub = path.join(resolvedDirAbs, name);
      results.push(...(await listedFromSubdirArtifacts(sub, name)));
    }
  }

  return results;
}

export interface OptionalArtifactWarnings {
  missingCatalog: boolean;
  missingSources: boolean;
}

export function optionalWarningsForCandidate(
  candidate: ResolvedArtifactCandidate,
): OptionalArtifactWarnings {
  return {
    missingCatalog: !candidate.hasCatalog,
    missingSources: !candidate.hasSources,
  };
}
