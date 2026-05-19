import * as path from 'node:path';
import type { DbtToolsRemoteSourceConfig } from '../config/dbt-tools-env';
import { validateSafePath, resolveSafePath } from '../validation/input-validator';

export type ArtifactSourceKind = 'local' | 's3' | 'gcs';

/** Trim leading/trailing slashes for object-store key prefix handling. */
export function normalizeArtifactPrefix(prefix: string): string {
  const slash = 47; // U+002F
  let start = 0;
  let end = prefix.length;
  while (start < end && prefix.charCodeAt(start) === slash) {
    start += 1;
  }
  while (end > start && prefix.charCodeAt(end - 1) === slash) {
    end -= 1;
  }
  return prefix.slice(start, end);
}

export interface ParsedLocalArtifactLocation {
  readonly kind: 'local';
  /** Absolute resolved directory. */
  readonly resolvedPath: string;
}

export interface ParsedRemoteArtifactLocation {
  readonly kind: 'remote';
  readonly provider: 's3' | 'gcs';
  readonly bucket: string;
  readonly prefix: string;
}

export type ParsedArtifactLocation = ParsedLocalArtifactLocation | ParsedRemoteArtifactLocation;

function assertNonEmptyBucket(bucket: string): void {
  if (bucket.trim() === '') {
    throw new Error('Bucket name is empty.');
  }
}

/**
 * Join normalized prefix with a relative artifact path for object GET/list keys.
 */
export function joinObjectStorageKey(normalizedPrefix: string, relativePath: string): string {
  const rel = relativePath.replace(/^\/+/, '');
  if (normalizedPrefix === '') return rel;
  return `${normalizedPrefix}/${rel}`;
}

/**
 * Parse user-supplied location for the given source kind.
 * @param cwd - Used to resolve relative local paths (e.g. `process.cwd()`).
 */
export function parseArtifactSourceLocation(
  sourceKind: ArtifactSourceKind,
  locationRaw: string,
  cwd: string,
): ParsedArtifactLocation {
  const trimmed = locationRaw.trim();
  if (trimmed === '') {
    throw new Error('Location is required.');
  }

  if (sourceKind === 'local') {
    validateSafePath(trimmed);
    const resolved = path.isAbsolute(trimmed)
      ? resolveSafePath(trimmed)
      : resolveSafePath(path.resolve(cwd, trimmed));
    return { kind: 'local', resolvedPath: resolved };
  }

  if (sourceKind === 's3') {
    const parsed = parseS3Location(trimmed);
    assertNonEmptyBucket(parsed.bucket);
    return {
      kind: 'remote',
      provider: 's3',
      bucket: parsed.bucket,
      prefix: normalizeArtifactPrefix(parsed.prefix),
    };
  }

  const parsed = parseGcsLocation(trimmed);
  assertNonEmptyBucket(parsed.bucket);
  return {
    kind: 'remote',
    provider: 'gcs',
    bucket: parsed.bucket,
    prefix: normalizeArtifactPrefix(parsed.prefix),
  };
}

function parseS3Location(raw: string): { bucket: string; prefix: string } {
  if (raw.toLowerCase().startsWith('s3://')) {
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
  const slash = raw.indexOf('/');
  if (slash === -1) {
    return { bucket: raw, prefix: '' };
  }
  return { bucket: raw.slice(0, slash), prefix: raw.slice(slash + 1) };
}

function parseGcsLocation(raw: string): { bucket: string; prefix: string } {
  if (raw.toLowerCase().startsWith('gs://')) {
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
  const slash = raw.indexOf('/');
  if (slash === -1) {
    return { bucket: raw, prefix: '' };
  }
  return { bucket: raw.slice(0, slash), prefix: raw.slice(slash + 1) };
}

const DEFAULT_REMOTE_POLL_MS = 30_000;

/** Request-time GCS-only options (web artifact-source); not part of env JSON. */
export interface GcsArtifactSourceRequestOptions {
  impersonatedServiceAccount?: string;
}

/** CLI/UI overrides applied on top of env-based remote config when merging. */
export interface RemoteSourceClientOverrides {
  projectId?: string;
  region?: string;
  endpoint?: string;
  forcePathStyle?: boolean;
}

function resolveGcsImpersonationPrincipal(
  gcsRequestOptions: GcsArtifactSourceRequestOptions | undefined,
  envGcs: DbtToolsRemoteSourceConfig | undefined,
): string | undefined {
  const fromRequest = gcsRequestOptions?.impersonatedServiceAccount?.trim();
  if (fromRequest != null && fromRequest !== '') {
    return fromRequest;
  }
  const fromEnv = envGcs?.impersonatedServiceAccount?.trim();
  if (fromEnv != null && fromEnv !== '') {
    return fromEnv;
  }
  return undefined;
}

/**
 * Build {@link DbtToolsRemoteSourceConfig} for SDK clients using UI-provided
 * bucket/prefix while inheriting poll interval and provider-specific options
 * from optional env-based config when the provider matches.
 */
export function mergeRemoteSourceConfigWithParsedLocation(
  envConfig: DbtToolsRemoteSourceConfig | undefined,
  parsed: ParsedRemoteArtifactLocation,
  gcsRequestOptions?: GcsArtifactSourceRequestOptions,
  clientOverrides?: RemoteSourceClientOverrides,
): DbtToolsRemoteSourceConfig {
  const pollIntervalMs =
    envConfig?.pollIntervalMs != null && envConfig.pollIntervalMs >= 0
      ? envConfig.pollIntervalMs
      : DEFAULT_REMOTE_POLL_MS;

  if (parsed.provider === 's3') {
    const envS3 = envConfig?.provider === 's3' ? envConfig : undefined;
    return {
      provider: 's3',
      bucket: parsed.bucket,
      prefix: parsed.prefix,
      pollIntervalMs,
      region: clientOverrides?.region ?? envS3?.region,
      endpoint: clientOverrides?.endpoint ?? envS3?.endpoint,
      forcePathStyle: clientOverrides?.forcePathStyle ?? envS3?.forcePathStyle,
    };
  }

  const envGcs = envConfig?.provider === 'gcs' ? envConfig : undefined;
  const impersonationPrincipal = resolveGcsImpersonationPrincipal(gcsRequestOptions, envGcs);
  return {
    provider: 'gcs',
    bucket: parsed.bucket,
    prefix: parsed.prefix,
    pollIntervalMs,
    projectId: clientOverrides?.projectId ?? envGcs?.projectId,
    ...(impersonationPrincipal != null
      ? { impersonatedServiceAccount: impersonationPrincipal }
      : {}),
  };
}
