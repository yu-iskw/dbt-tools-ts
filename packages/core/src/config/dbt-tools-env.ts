/**
 * Canonical dbt-tools configuration via `DBT_TOOLS_*` environment variables.
 * Legacy `DBT_*` names remain supported with one-time deprecation warnings.
 */

const warnedDeprecatedKeys = new Set<string>();

/** @internal Vitest-only: clears deprecation warning deduplication. */
export function resetDbtToolsEnvDeprecationWarningsForTests(): void {
  warnedDeprecatedKeys.clear();
}

function warnDeprecatedOnce(legacyKey: string, canonicalKey: string): void {
  if (warnedDeprecatedKeys.has(legacyKey)) return;
  warnedDeprecatedKeys.add(legacyKey);
  console.warn(
    `[dbt-tools] The environment variable ${legacyKey} is deprecated; use ${canonicalKey} instead.`,
  );
}

function trimEnv(value: string | undefined): string | undefined {
  const t = value?.trim();
  return t === '' ? undefined : t;
}

const SLASH = 47;

/**
 * Removes leading and trailing `/` in linear time. Used for object-storage
 * prefix normalization; avoids polynomial-time regex on untrusted JSON/env input.
 */
function trimAffixSlashes(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && value.charCodeAt(start) === SLASH) {
    start += 1;
  }
  while (end > start && value.charCodeAt(end - 1) === SLASH) {
    end -= 1;
  }
  return value.slice(start, end);
}

/**
 * Directory containing dbt artifacts (typically the dbt `target/` folder).
 * Precedence: `DBT_TOOLS_TARGET_DIR`, then `DBT_TARGET_DIR`, then `DBT_TARGET`.
 */
export function getDbtToolsTargetDirFromEnv(): string | undefined {
  const canon = trimEnv(process.env.DBT_TOOLS_TARGET_DIR);
  if (canon !== undefined) return canon;

  const dir = trimEnv(process.env.DBT_TARGET_DIR);
  if (dir !== undefined) {
    warnDeprecatedOnce('DBT_TARGET_DIR', 'DBT_TOOLS_TARGET_DIR');
    return dir;
  }

  const target = trimEnv(process.env.DBT_TARGET);
  if (target !== undefined) {
    warnDeprecatedOnce('DBT_TARGET', 'DBT_TOOLS_TARGET_DIR');
    return target;
  }

  return undefined;
}

/**
 * Default `--dbt-target` when the CLI flag is omitted: local directory or
 * `s3://bucket/prefix` / `gs://bucket/prefix` (trimmed; empty treated as unset).
 */
export function getDbtToolsDbtTargetFromEnv(): string | undefined {
  return trimEnv(process.env.DBT_TOOLS_DBT_TARGET);
}

/** Granular remote client settings from `DBT_TOOLS_GCS_*` / `DBT_TOOLS_S3_*` (MCP, CLI). */
export interface DbtToolsRemoteClientEnv {
  gcsRequestOptions?: { impersonatedServiceAccount?: string };
  remoteClientOverrides?: {
    projectId?: string;
    region?: string;
    endpoint?: string;
    forcePathStyle?: boolean;
  };
}

/**
 * Optional per-field remote client env (preferred over `DBT_TOOLS_REMOTE_SOURCE` JSON for MCP).
 * CLI flags passed into {@link ArtifactWorkspace} override these when both are set.
 */
export function getDbtToolsRemoteClientEnvFromEnv(): DbtToolsRemoteClientEnv {
  const projectId = trimEnv(process.env.DBT_TOOLS_GCS_PROJECT_ID);
  const impersonate = trimEnv(process.env.DBT_TOOLS_GCS_IMPERSONATE_SERVICE_ACCOUNT);
  const region = trimEnv(process.env.DBT_TOOLS_S3_REGION);
  const endpoint = trimEnv(process.env.DBT_TOOLS_S3_ENDPOINT);

  const remoteClientOverrides =
    projectId != null || region != null || endpoint != null
      ? {
          ...(projectId != null ? { projectId } : {}),
          ...(region != null ? { region } : {}),
          ...(endpoint != null ? { endpoint } : {}),
        }
      : undefined;

  const gcsRequestOptions =
    impersonate != null ? { impersonatedServiceAccount: impersonate } : undefined;

  if (remoteClientOverrides == null && gcsRequestOptions == null) {
    return {};
  }
  return {
    ...(gcsRequestOptions != null ? { gcsRequestOptions } : {}),
    ...(remoteClientOverrides != null ? { remoteClientOverrides } : {}),
  };
}

/** Server-side debug logging when value is exactly `"1"`. */
export function isDbtToolsDebugEnabled(): boolean {
  const canon = process.env.DBT_TOOLS_DEBUG;
  if (canon !== undefined) {
    return canon === '1';
  }
  if (process.env.DBT_DEBUG === '1') {
    warnDeprecatedOnce('DBT_DEBUG', 'DBT_TOOLS_DEBUG');
    return true;
  }
  return false;
}

/**
 * File watch + auto-reload (Vite dev). Disabled only when the active variable is `"0"`.
 * Default when unset: enabled (matches legacy `DBT_WATCH` semantics).
 */
export function isDbtToolsWatchEnabled(): boolean {
  const canon = process.env.DBT_TOOLS_WATCH;
  if (canon !== undefined) {
    return canon.trim() !== '0';
  }
  if (process.env.DBT_WATCH !== undefined) {
    warnDeprecatedOnce('DBT_WATCH', 'DBT_TOOLS_WATCH');
    return process.env.DBT_WATCH.trim() !== '0';
  }
  return true;
}

const DEFAULT_RELOAD_DEBOUNCE_MS = 300;
const DEFAULT_REMOTE_POLL_INTERVAL_MS = 30_000;

export type DbtToolsRemoteSourceProvider = 's3' | 'gcs';

export interface DbtToolsRemoteSourceConfig {
  provider: DbtToolsRemoteSourceProvider;
  bucket: string;
  prefix: string;
  pollIntervalMs: number;
  region?: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  projectId?: string;
  /**
   * GCS only: optional service account to impersonate using the ambient
   * Google credential (e.g. user ADC or workload identity).
   */
  impersonatedServiceAccount?: string;
}

function parseNonNegativeInt(raw: string): number {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_RELOAD_DEBOUNCE_MS;
}

/** Debounce for artifact reload notifications (ms). */
export function getDbtToolsReloadDebounceMs(): number {
  const canon = trimEnv(process.env.DBT_TOOLS_RELOAD_DEBOUNCE_MS);
  if (canon !== undefined) {
    return parseNonNegativeInt(canon);
  }
  const leg = trimEnv(process.env.DBT_RELOAD_DEBOUNCE_MS);
  if (leg !== undefined) {
    warnDeprecatedOnce('DBT_RELOAD_DEBOUNCE_MS', 'DBT_TOOLS_RELOAD_DEBOUNCE_MS');
    return parseNonNegativeInt(leg);
  }
  return DEFAULT_RELOAD_DEBOUNCE_MS;
}

/**
 * Parse `DBT_TOOLS_REMOTE_SOURCE` JSON (without reading `process.env`).
 * Returns `undefined` when JSON is invalid or required fields are missing.
 */
export function parseDbtToolsRemoteSourceConfigJson(
  rawJson: string,
): DbtToolsRemoteSourceConfig | undefined {
  try {
    const parsed = JSON.parse(rawJson) as Partial<DbtToolsRemoteSourceConfig>;
    if (parsed.provider !== 's3' && parsed.provider !== 'gcs') {
      console.warn("[dbt-tools] DBT_TOOLS_REMOTE_SOURCE provider must be 's3' or 'gcs'.");
      return undefined;
    }
    const bucket = trimEnv(parsed.bucket);
    const prefix = trimEnv(parsed.prefix);
    if (bucket === undefined || prefix === undefined) {
      console.warn(
        '[dbt-tools] DBT_TOOLS_REMOTE_SOURCE must include non-empty bucket and prefix values.',
      );
      return undefined;
    }

    return {
      provider: parsed.provider,
      bucket,
      prefix: trimAffixSlashes(prefix),
      pollIntervalMs:
        typeof parsed.pollIntervalMs === 'number' && parsed.pollIntervalMs > 0
          ? Math.floor(parsed.pollIntervalMs)
          : DEFAULT_REMOTE_POLL_INTERVAL_MS,
      region: trimEnv(parsed.region),
      endpoint: trimEnv(parsed.endpoint),
      forcePathStyle: parsed.forcePathStyle === true,
      projectId: trimEnv(parsed.projectId),
      impersonatedServiceAccount: trimEnv(parsed.impersonatedServiceAccount),
    };
  } catch (error) {
    console.warn('[dbt-tools] Failed to parse DBT_TOOLS_REMOTE_SOURCE as JSON.', error);
    return undefined;
  }
}

/**
 * Optional remote artifact source configuration for managed object storage.
 * Expected format:
 * {
 *   "provider": "s3" | "gcs",
 *   "bucket": "bucket-name",
 *   "prefix": "path/to/runs",
 *   "pollIntervalMs": 30000
 * }
 */
export function getDbtToolsRemoteSourceConfigFromEnv(): DbtToolsRemoteSourceConfig | undefined {
  const raw = trimEnv(process.env.DBT_TOOLS_REMOTE_SOURCE);
  if (raw === undefined) return undefined;
  return parseDbtToolsRemoteSourceConfigJson(raw);
}

/**
 * Base URL for the dbt-tools web app (deep links from CLI). No trailing slash required.
 * Example: `http://127.0.0.1:5173` or `https://dbt-tools.example.com/app`
 */
export function getDbtToolsWebBaseUrlFromEnv(): string | undefined {
  const u = trimEnv(process.env.DBT_TOOLS_WEB_BASE_URL);
  return u === undefined ? undefined : u.replace(/\/$/, '');
}
