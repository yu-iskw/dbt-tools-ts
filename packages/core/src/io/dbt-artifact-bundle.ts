import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { getDbtToolsRemoteSourceConfigFromEnv } from '../config/dbt-tools-env';
import { ArtifactBundleResolutionError } from '../errors/artifact-bundle-resolution-error';
import { validateSafePath, resolveSafePath } from '../validation/input-validator';
import {
  DBT_CATALOG_JSON,
  DBT_MANIFEST_JSON,
  DBT_RUN_RESULTS_JSON,
  DBT_SOURCES_JSON,
} from './artifact-filenames';
import type { ArtifactPaths } from './artifact-loader';
import {
  joinObjectStorageKey,
  mergeRemoteSourceConfigWithParsedLocation,
  normalizeArtifactPrefix,
  type ParsedArtifactLocation,
} from './artifact-location';
import { createRemoteObjectStoreClient, type RemoteObjectStoreClient } from './remote-object-store';

export type DbtArtifactBundleRequirements = {
  manifest?: boolean;
  runResults?: boolean;
};

function parseStrictS3Uri(raw: string): { bucket: string; prefix: string } {
  const lower = raw.toLowerCase();
  if (!lower.startsWith('s3://')) {
    throw new Error(
      'S3 artifact targets must start with "s3://bucket/prefix" (scheme is required).',
    );
  }
  const without = raw.slice('s3://'.length);
  const slash = without.indexOf('/');
  if (slash === -1) {
    return { bucket: without, prefix: '' };
  }
  return {
    bucket: without.slice(0, slash),
    prefix: without.slice(slash + 1),
  };
}

function parseStrictGcsUri(raw: string): { bucket: string; prefix: string } {
  const lower = raw.toLowerCase();
  if (!lower.startsWith('gs://')) {
    throw new Error(
      'GCS artifact targets must start with "gs://bucket/prefix" (scheme is required).',
    );
  }
  const without = raw.slice('gs://'.length);
  const slash = without.indexOf('/');
  if (slash === -1) {
    return { bucket: without, prefix: '' };
  }
  return {
    bucket: without.slice(0, slash),
    prefix: without.slice(slash + 1),
  };
}

/**
 * Parse `--dbt-target`: `s3://` → S3, `gs://` → GCS, otherwise a local directory.
 * Unlike {@link parseArtifactSourceLocation} with `sourceKind: "s3"|"gcs"`, this
 * rejects unschemed `bucket/prefix` for cloud (strict URI contract for CLI).
 */
export function parseDbtToolsArtifactTarget(
  locationRaw: string,
  cwd: string,
): ParsedArtifactLocation {
  const trimmed = locationRaw.trim();
  if (trimmed === '') {
    throw new Error('dbt artifact target is required (empty string).');
  }

  const lower = trimmed.toLowerCase();
  if (lower.startsWith('s3://')) {
    const parsed = parseStrictS3Uri(trimmed);
    if (parsed.bucket.trim() === '') {
      throw new Error('S3 bucket name is empty.');
    }
    return {
      kind: 'remote',
      provider: 's3',
      bucket: parsed.bucket,
      prefix: normalizeArtifactPrefix(parsed.prefix),
    };
  }

  if (lower.startsWith('gs://')) {
    const parsed = parseStrictGcsUri(trimmed);
    if (parsed.bucket.trim() === '') {
      throw new Error('GCS bucket name is empty.');
    }
    return {
      kind: 'remote',
      provider: 'gcs',
      bucket: parsed.bucket,
      prefix: normalizeArtifactPrefix(parsed.prefix),
    };
  }

  validateSafePath(trimmed);
  const resolved = path.isAbsolute(trimmed)
    ? resolveSafePath(trimmed)
    : resolveSafePath(path.resolve(cwd, trimmed));
  return { kind: 'local', resolvedPath: resolved };
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveLocalBundle(
  dir: string,
  displayTarget: string,
  requirements: Required<DbtArtifactBundleRequirements>,
): Promise<ArtifactPaths> {
  const manifest = path.join(dir, DBT_MANIFEST_JSON);
  const runResults = path.join(dir, DBT_RUN_RESULTS_JSON);
  const catalog = path.join(dir, DBT_CATALOG_JSON);
  const sources = path.join(dir, DBT_SOURCES_JSON);

  const found: string[] = [];
  const missing: string[] = [];

  if (await pathExists(manifest)) found.push(DBT_MANIFEST_JSON);
  else if (requirements.manifest) missing.push(DBT_MANIFEST_JSON);

  if (await pathExists(runResults)) found.push(DBT_RUN_RESULTS_JSON);
  else if (requirements.runResults) missing.push(DBT_RUN_RESULTS_JSON);

  if (await pathExists(catalog)) found.push(DBT_CATALOG_JSON);
  if (await pathExists(sources)) found.push(DBT_SOURCES_JSON);

  if (missing.length > 0) {
    throw ArtifactBundleResolutionError.incomplete({
      target: displayTarget,
      provider: 'local',
      missing,
      found,
      required: [
        ...(requirements.manifest ? [DBT_MANIFEST_JSON] : []),
        ...(requirements.runResults ? [DBT_RUN_RESULTS_JSON] : []),
      ],
    });
  }

  return {
    manifest,
    runResults,
    ...(found.includes(DBT_CATALOG_JSON) ? { catalog } : {}),
    ...(found.includes(DBT_SOURCES_JSON) ? { sources } : {}),
  };
}

async function writeRemoteBytesToTemp(args: {
  bucket: string;
  client: RemoteObjectStoreClient;
  prefixNorm: string;
  displayTarget: string;
  provider: 's3' | 'gcs';
  requirements: Required<DbtArtifactBundleRequirements>;
}): Promise<ArtifactPaths> {
  const { bucket, client, prefixNorm, displayTarget, provider, requirements } = args;

  const relNames = [
    DBT_MANIFEST_JSON,
    DBT_RUN_RESULTS_JSON,
    DBT_CATALOG_JSON,
    DBT_SOURCES_JSON,
  ] as const;

  const keysTried = relNames.map((n) => joinObjectStorageKey(prefixNorm, n));
  const found: string[] = [];
  const missing: string[] = [];

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dbt-tools-artifacts-'));

  const writeIfPresent = async (
    relative: string,
    required: boolean,
  ): Promise<string | undefined> => {
    const key = joinObjectStorageKey(prefixNorm, relative);
    try {
      const bytes = await client.readObjectBytes(bucket, key);
      const filePath = path.join(dir, relative);
      await fs.writeFile(filePath, bytes);
      found.push(relative);
      return filePath;
    } catch {
      if (required) missing.push(relative);
      return undefined;
    }
  };

  const manifest = await writeIfPresent(DBT_MANIFEST_JSON, requirements.manifest);
  const runResults = await writeIfPresent(DBT_RUN_RESULTS_JSON, requirements.runResults);
  const catalog = await writeIfPresent(DBT_CATALOG_JSON, false);
  const sources = await writeIfPresent(DBT_SOURCES_JSON, false);

  if (missing.length > 0) {
    throw ArtifactBundleResolutionError.incomplete({
      target: displayTarget,
      provider,
      missing,
      found,
      keysTried,
      required: [
        ...(requirements.manifest ? [DBT_MANIFEST_JSON] : []),
        ...(requirements.runResults ? [DBT_RUN_RESULTS_JSON] : []),
      ],
    });
  }

  return {
    manifest: manifest ?? path.join(dir, DBT_MANIFEST_JSON),
    runResults: runResults ?? path.join(dir, DBT_RUN_RESULTS_JSON),
    ...(catalog != null ? { catalog } : {}),
    ...(sources != null ? { sources } : {}),
  };
}

/**
 * Resolve fixed dbt artifact filenames under a local directory or object prefix.
 */
export async function resolveDbtToolsArtifactBundlePaths(options: {
  /** Trimmed effective target (flag or env). */
  dbtTargetRaw: string;
  cwd?: string;
  requirements?: DbtArtifactBundleRequirements;
}): Promise<ArtifactPaths> {
  const cwd = options.cwd ?? process.cwd();
  const displayTarget = options.dbtTargetRaw.trim();
  const parsed = parseDbtToolsArtifactTarget(displayTarget, cwd);
  const requirements = {
    manifest: options.requirements?.manifest ?? true,
    runResults: options.requirements?.runResults ?? true,
  };

  if (parsed.kind === 'local') {
    return resolveLocalBundle(parsed.resolvedPath, displayTarget, requirements);
  }

  const env = getDbtToolsRemoteSourceConfigFromEnv();
  const merged = mergeRemoteSourceConfigWithParsedLocation(env, parsed);
  const client = await createRemoteObjectStoreClient(merged);
  const prefixNorm = normalizeArtifactPrefix(merged.prefix);

  return writeRemoteBytesToTemp({
    bucket: merged.bucket,
    client,
    prefixNorm,
    displayTarget,
    provider: parsed.provider,
    requirements,
  });
}
