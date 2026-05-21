/**
 * Shared CLI flags for dbt-tools entrypoints (MCP, web): artifact root and remote client settings.
 */

import { parseDbtToolsArtifactTarget } from '../io/dbt-artifact-bundle';
import { getDbtToolsDbtTargetFromEnv } from './dbt-tools-env';

export interface EntrypointRemoteOptions {
  dbtTarget?: string;
  gcsProjectId?: string;
  gcsImpersonateServiceAccount?: string;
  s3Region?: string;
  s3Endpoint?: string;
}

export type EntrypointRemoteClientFlagOptions = Pick<
  EntrypointRemoteOptions,
  'gcsImpersonateServiceAccount' | 'gcsProjectId' | 's3Endpoint' | 's3Region'
>;

type Env = Record<string, string | undefined>;

function readFlagValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (value == null || value.startsWith('--')) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function targetFromEnv(env: Env): string | undefined {
  const saved = process.env.DBT_TOOLS_DBT_TARGET;
  try {
    if (env.DBT_TOOLS_DBT_TARGET === undefined) {
      delete process.env.DBT_TOOLS_DBT_TARGET;
    } else {
      process.env.DBT_TOOLS_DBT_TARGET = env.DBT_TOOLS_DBT_TARGET;
    }
    return getDbtToolsDbtTargetFromEnv();
  } finally {
    if (saved === undefined) {
      delete process.env.DBT_TOOLS_DBT_TARGET;
    } else {
      process.env.DBT_TOOLS_DBT_TARGET = saved;
    }
  }
}

function hasRemoteClientFlags(options: EntrypointRemoteClientFlagOptions): boolean {
  return (
    options.gcsProjectId != null ||
    options.gcsImpersonateServiceAccount != null ||
    options.s3Region != null ||
    options.s3Endpoint != null
  );
}

export function assertRemoteFlagsMatchTarget(
  dbtTarget: string,
  options: EntrypointRemoteClientFlagOptions,
  cwd: string = process.cwd(),
): void {
  if (!hasRemoteClientFlags(options)) return;

  const parsed = parseDbtToolsArtifactTarget(dbtTarget, cwd);
  if (parsed.kind === 'local') {
    throw new Error(
      'Remote client flags require an s3:// or gs:// --dbt-target (or a remote DBT_TOOLS_DBT_TARGET).',
    );
  }

  const hasGcsFlags = options.gcsProjectId != null || options.gcsImpersonateServiceAccount != null;
  const hasS3Flags = options.s3Region != null || options.s3Endpoint != null;

  if (parsed.provider === 'gcs' && hasS3Flags) {
    throw new Error('--s3-region and --s3-endpoint are only valid for s3:// targets.');
  }
  if (parsed.provider === 's3' && hasGcsFlags) {
    throw new Error(
      '--gcs-project-id and --gcs-impersonate-service-account are only valid for gs:// targets.',
    );
  }
}

interface ParsedEntrypointArgv {
  dbtTarget?: string;
  gcsProjectId?: string;
  gcsImpersonateServiceAccount?: string;
  s3Region?: string;
  s3Endpoint?: string;
}

function applyStringFlag(
  flag: string,
  args: string[],
  index: number,
  assign: (value: string) => void,
): void {
  assign(readFlagValue(args, index, flag).trim());
}

const ENTRYPOINT_STRING_FLAGS: Array<{
  flag: string;
  assign: (parsed: ParsedEntrypointArgv, value: string) => void;
}> = [
  {
    flag: '--dbt-target',
    assign: (parsed, value) => {
      parsed.dbtTarget = value;
    },
  },
  {
    flag: '--gcs-project-id',
    assign: (parsed, value) => {
      parsed.gcsProjectId = value;
    },
  },
  {
    flag: '--gcs-impersonate-service-account',
    assign: (parsed, value) => {
      parsed.gcsImpersonateServiceAccount = value;
    },
  },
  {
    flag: '--s3-region',
    assign: (parsed, value) => {
      parsed.s3Region = value;
    },
  },
  {
    flag: '--s3-endpoint',
    assign: (parsed, value) => {
      parsed.s3Endpoint = value;
    },
  },
];

/** Options set explicitly on argv (no env fallback). */
export function parseEntrypointRemoteArgv(args: string[]): EntrypointRemoteOptions {
  const parsed: ParsedEntrypointArgv = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === undefined) continue;
    const stringFlag = ENTRYPOINT_STRING_FLAGS.find((entry) => entry.flag === arg);
    if (stringFlag != null) {
      applyStringFlag(stringFlag.flag, args, i, (value) => {
        stringFlag.assign(parsed, value);
      });
      i += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }
  return normalizeEntrypointRemoteOptions(parsed);
}

function nonEmptyOption(value: string | undefined): string | undefined {
  return value !== undefined && value !== '' ? value : undefined;
}

/** Drop empty strings; used for argv-only and resolved option objects. */
export function normalizeEntrypointRemoteOptions(
  options: EntrypointRemoteOptions,
): EntrypointRemoteOptions {
  const dbtTarget = nonEmptyOption(options.dbtTarget);
  const gcsProjectId = nonEmptyOption(options.gcsProjectId);
  const gcsImpersonateServiceAccount = nonEmptyOption(options.gcsImpersonateServiceAccount);
  const s3Region = nonEmptyOption(options.s3Region);
  const s3Endpoint = nonEmptyOption(options.s3Endpoint);
  return {
    ...(dbtTarget != null ? { dbtTarget } : {}),
    ...(gcsProjectId != null ? { gcsProjectId } : {}),
    ...(gcsImpersonateServiceAccount != null ? { gcsImpersonateServiceAccount } : {}),
    ...(s3Region != null ? { s3Region } : {}),
    ...(s3Endpoint != null ? { s3Endpoint } : {}),
  };
}

/** Effective dbt target: explicit `--dbt-target` wins, else `DBT_TOOLS_DBT_TARGET`. */
export function resolveEntrypointDbtTarget(
  explicit: EntrypointRemoteOptions,
  env: Env = process.env,
): string | undefined {
  const fromFlag = explicit.dbtTarget?.trim();
  if (fromFlag != null && fromFlag !== '') {
    return fromFlag;
  }
  return targetFromEnv(env);
}

/** Merge argv explicit options with resolved dbt target for workspace / validation. */
export function resolveEntrypointRemoteOptions(
  explicit: EntrypointRemoteOptions,
  env: Env = process.env,
  cwd: string = process.cwd(),
): EntrypointRemoteOptions {
  const resolvedTarget = resolveEntrypointDbtTarget(explicit, env);
  if (resolvedTarget != null) {
    assertRemoteFlagsMatchTarget(resolvedTarget, explicit, cwd);
  }
  return normalizeEntrypointRemoteOptions({
    ...explicit,
    ...(resolvedTarget != null ? { dbtTarget: resolvedTarget } : {}),
  });
}

/** Apply only argv-provided flags to env (flags override env when both are set at parse time). */
export function applyEntrypointRemoteOptionsToEnv(
  explicit: EntrypointRemoteOptions,
  env: Env = process.env,
): void {
  const normalized = normalizeEntrypointRemoteOptions(explicit);
  if (normalized.dbtTarget != null) {
    env.DBT_TOOLS_DBT_TARGET = normalized.dbtTarget;
  }
  if (normalized.gcsProjectId != null) {
    env.DBT_TOOLS_GCS_PROJECT_ID = normalized.gcsProjectId;
  }
  if (normalized.gcsImpersonateServiceAccount != null) {
    env.DBT_TOOLS_GCS_IMPERSONATE_SERVICE_ACCOUNT = normalized.gcsImpersonateServiceAccount;
  }
  if (normalized.s3Region != null) {
    env.DBT_TOOLS_S3_REGION = normalized.s3Region;
  }
  if (normalized.s3Endpoint != null) {
    env.DBT_TOOLS_S3_ENDPOINT = normalized.s3Endpoint;
  }
}

export function entrypointRemoteHelpLines(): string[] {
  return [
    '  --dbt-target <target>',
    '      Artifact root (local path, s3://, or gs://). Env: DBT_TOOLS_DBT_TARGET',
    '  --gcs-project-id <id>',
    '      GCS client project (gs:// targets only). Env: DBT_TOOLS_GCS_PROJECT_ID',
    '  --gcs-impersonate-service-account <email>',
    '      GCS impersonation principal (gs:// targets only). Env: DBT_TOOLS_GCS_IMPERSONATE_SERVICE_ACCOUNT',
    '  --s3-region <region>',
    '      S3 region (s3:// targets only). Env: DBT_TOOLS_S3_REGION',
    '  --s3-endpoint <url>',
    '      S3-compatible endpoint (s3:// targets only). Env: DBT_TOOLS_S3_ENDPOINT',
  ];
}
