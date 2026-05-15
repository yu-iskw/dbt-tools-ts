/**
 * Canonical dbt-tools configuration via `DBT_TOOLS_*` environment variables.
 * Legacy `DBT_*` names remain supported with one-time deprecation warnings.
 */

import { normalizeSlashAffixes } from '../io/normalize-prefix';

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

/** Shared hint for CLI, MCP, and other entrypoints when `--dbt-target` / env is missing. */
export const DBT_TOOLS_DBT_TARGET_REQUIRED_HINT =
  'Pass --dbt-target <path|s3://bucket/prefix|gs://bucket/prefix> or set DBT_TOOLS_DBT_TARGET in the environment.';

/**
 * Effective dbt artifact root: explicit flag wins, then `DBT_TOOLS_DBT_TARGET`.
 * @throws when both are empty or unset
 */
export function resolveDbtToolsDbtTargetFromFlagOrEnv(flag?: string): string {
  const fromFlag = flag?.trim();
  if (fromFlag != null && fromFlag !== '') {
    return fromFlag;
  }
  const fromEnv = getDbtToolsDbtTargetFromEnv()?.trim();
  if (fromEnv != null && fromEnv !== '') {
    return fromEnv;
  }
  throw new Error(`dbt artifact target is required. ${DBT_TOOLS_DBT_TARGET_REQUIRED_HINT}`);
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
  /** Service account email to impersonate (GCS client only). */
  impersonateServiceAccount?: string;
}

/** Optional GCS client auth overrides (CLI/MCP); merged after env JSON for `gs://` targets. */
export interface GcsAuthOverrides {
  projectId?: string;
  impersonateServiceAccount?: string;
}

/**
 * Trim and drop empty GCS auth fields. Used by CLI and MCP so flag/env shaping stays consistent.
 */
export function normalizeGcsAuthOverrides(input: {
  projectId?: string;
  impersonateServiceAccount?: string;
}): GcsAuthOverrides | undefined {
  const projectId = trimEnv(input.projectId);
  const impersonateServiceAccount = trimEnv(input.impersonateServiceAccount);
  if (projectId === undefined && impersonateServiceAccount === undefined) return undefined;
  return {
    ...(projectId !== undefined ? { projectId } : {}),
    ...(impersonateServiceAccount !== undefined ? { impersonateServiceAccount } : {}),
  };
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
      prefix: normalizeSlashAffixes(prefix),
      pollIntervalMs:
        typeof parsed.pollIntervalMs === 'number' && parsed.pollIntervalMs > 0
          ? Math.floor(parsed.pollIntervalMs)
          : DEFAULT_REMOTE_POLL_INTERVAL_MS,
      region: trimEnv(parsed.region),
      endpoint: trimEnv(parsed.endpoint),
      forcePathStyle: parsed.forcePathStyle === true,
      projectId: trimEnv(parsed.projectId),
      impersonateServiceAccount: trimEnv(parsed.impersonateServiceAccount),
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

const DEFAULT_MAX_REMOTE_OBJECT_BYTES = 512 * 1024 * 1024;
const ABSOLUTE_MAX_REMOTE_OBJECT_BYTES_CAP = 2 * 1024 * 1024 * 1024;

/**
 * Maximum size (bytes) for a single remote object read (S3 `GetObject` / GCS download)
 * when loading artifacts. Reads `DBT_TOOLS_MAX_REMOTE_OBJECT_BYTES` as a decimal integer;
 * invalid, empty, or unset values fall back to **512 MiB**. Values above **2 GiB** are
 * clamped to limit accidental misconfiguration.
 */
export function getDbtToolsMaxRemoteObjectBytesFromEnv(): number {
  const raw = trimEnv(process.env.DBT_TOOLS_MAX_REMOTE_OBJECT_BYTES);
  if (raw === undefined) return DEFAULT_MAX_REMOTE_OBJECT_BYTES;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_MAX_REMOTE_OBJECT_BYTES;
  return Math.min(n, ABSOLUTE_MAX_REMOTE_OBJECT_BYTES_CAP);
}

const DEFAULT_MAX_REMOTE_LISTING_OBJECTS = 50_000;
const ABSOLUTE_MAX_REMOTE_LISTING_OBJECTS_CAP = 500_000;

/**
 * Maximum number of object keys returned from a single S3/GCS prefix listing
 * (discovery). Reads `DBT_TOOLS_MAX_REMOTE_LISTING_OBJECTS` as a decimal integer;
 * invalid or unset values default to **50_000**; values above **500_000** are clamped.
 */
export function getDbtToolsMaxRemoteListingObjectsFromEnv(): number {
  const raw = trimEnv(process.env.DBT_TOOLS_MAX_REMOTE_LISTING_OBJECTS);
  if (raw === undefined) return DEFAULT_MAX_REMOTE_LISTING_OBJECTS;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_MAX_REMOTE_LISTING_OBJECTS;
  return Math.min(n, ABSOLUTE_MAX_REMOTE_LISTING_OBJECTS_CAP);
}
