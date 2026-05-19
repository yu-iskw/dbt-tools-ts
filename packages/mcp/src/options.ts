import { getDbtToolsDbtTargetFromEnv, parseDbtToolsArtifactTarget } from '@dbt-tools/core';

export interface McpServerOptions {
  dbtTarget: string;
  pollIntervalMs?: number;
  gcsProjectId?: string;
  gcsImpersonateServiceAccount?: string;
  s3Region?: string;
  s3Endpoint?: string;
}

export class McpHelpRequested extends Error {
  constructor() {
    super(helpText());
    this.name = 'McpHelpRequested';
  }
}

type Env = Record<string, string | undefined>;

function readFlagValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (value == null || value.startsWith('--')) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function parsePositiveInteger(raw: string, flag: string): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${flag} must be a non-negative integer.`);
  }
  return parsed;
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

function hasRemoteClientFlags(options: {
  gcsProjectId?: string;
  gcsImpersonateServiceAccount?: string;
  s3Region?: string;
  s3Endpoint?: string;
}): boolean {
  return (
    options.gcsProjectId != null ||
    options.gcsImpersonateServiceAccount != null ||
    options.s3Region != null ||
    options.s3Endpoint != null
  );
}

export function assertRemoteFlagsMatchTarget(
  dbtTarget: string,
  options: {
    gcsProjectId?: string;
    gcsImpersonateServiceAccount?: string;
    s3Region?: string;
    s3Endpoint?: string;
  },
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

interface ParsedMcpArgv {
  dbtTarget?: string;
  pollIntervalMs?: number;
  gcsProjectId?: string;
  gcsImpersonateServiceAccount?: string;
  s3Region?: string;
  s3Endpoint?: string;
}

function parseMcpArgvFlags(args: string[]): ParsedMcpArgv {
  const parsed: ParsedMcpArgv = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--dbt-target') {
      parsed.dbtTarget = readFlagValue(args, i, arg).trim();
      i += 1;
      continue;
    }
    if (arg === '--poll-interval-ms') {
      parsed.pollIntervalMs = parsePositiveInteger(readFlagValue(args, i, arg), arg);
      i += 1;
      continue;
    }
    if (arg === '--gcs-project-id') {
      parsed.gcsProjectId = readFlagValue(args, i, arg).trim();
      i += 1;
      continue;
    }
    if (arg === '--gcs-impersonate-service-account') {
      parsed.gcsImpersonateServiceAccount = readFlagValue(args, i, arg).trim();
      i += 1;
      continue;
    }
    if (arg === '--s3-region') {
      parsed.s3Region = readFlagValue(args, i, arg).trim();
      i += 1;
      continue;
    }
    if (arg === '--s3-endpoint') {
      parsed.s3Endpoint = readFlagValue(args, i, arg).trim();
      i += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      throw new McpHelpRequested();
    }
    throw new Error(`Unknown option: ${arg}`);
  }
  return parsed;
}

function mcpOptionsFromParsedArgv(parsed: ParsedMcpArgv, resolvedTarget: string): McpServerOptions {
  const { pollIntervalMs, gcsProjectId, gcsImpersonateServiceAccount, s3Region, s3Endpoint } =
    parsed;
  return {
    dbtTarget: resolvedTarget,
    ...(pollIntervalMs !== undefined ? { pollIntervalMs } : {}),
    ...(gcsProjectId !== undefined && gcsProjectId !== '' ? { gcsProjectId } : {}),
    ...(gcsImpersonateServiceAccount !== undefined && gcsImpersonateServiceAccount !== ''
      ? { gcsImpersonateServiceAccount }
      : {}),
    ...(s3Region !== undefined && s3Region !== '' ? { s3Region } : {}),
    ...(s3Endpoint !== undefined && s3Endpoint !== '' ? { s3Endpoint } : {}),
  };
}

export function parseMcpServerOptions(args: string[], env: Env = process.env): McpServerOptions {
  const parsed = parseMcpArgvFlags(args);
  const resolvedTarget =
    parsed.dbtTarget != null && parsed.dbtTarget !== '' ? parsed.dbtTarget : targetFromEnv(env);
  if (resolvedTarget == null) {
    throw new Error(
      'dbt artifact target is required. Pass --dbt-target <path|s3://bucket/prefix|gs://bucket/prefix> or set DBT_TOOLS_DBT_TARGET.',
    );
  }

  assertRemoteFlagsMatchTarget(resolvedTarget, {
    gcsProjectId: parsed.gcsProjectId,
    gcsImpersonateServiceAccount: parsed.gcsImpersonateServiceAccount,
    s3Region: parsed.s3Region,
    s3Endpoint: parsed.s3Endpoint,
  });

  return mcpOptionsFromParsedArgv(parsed, resolvedTarget);
}

export function helpText(): string {
  return [
    'Usage: dbt-tools-mcp --dbt-target <path|s3://bucket/prefix|gs://bucket/prefix> [options]',
    '',
    'Options (CLI flags override the env vars below when both are set):',
    '  --dbt-target <target>',
    '      Artifact root (local path, s3://, or gs://).',
    '      Env: DBT_TOOLS_DBT_TARGET',
    '  --poll-interval-ms <ms>',
    '      MCP background refresh interval; 0 disables. No env equivalent (use args).',
    '  --gcs-project-id <id>',
    '      GCS client project (gs:// targets only).',
    '      Env: DBT_TOOLS_GCS_PROJECT_ID',
    '  --gcs-impersonate-service-account <email>',
    '      GCS impersonation principal (gs:// targets only).',
    '      Env: DBT_TOOLS_GCS_IMPERSONATE_SERVICE_ACCOUNT',
    '      Policy: DBT_TOOLS_GCS_IMPERSONATION_ALLOWLIST, DBT_TOOLS_GCS_IMPERSONATION_ALLOWED_SUFFIXES',
    '  --s3-region <region>',
    '      S3 region (s3:// targets only).',
    '      Env: DBT_TOOLS_S3_REGION (credentials may also use AWS_REGION)',
    '  --s3-endpoint <url>',
    '      S3-compatible endpoint (s3:// targets only).',
    '      Env: DBT_TOOLS_S3_ENDPOINT',
    '  -h, --help',
    '      Show this help',
    '',
    'Bucket and prefix always come from the --dbt-target URI (or DBT_TOOLS_DBT_TARGET).',
    'Remote credentials: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_PROFILE, GOOGLE_APPLICATION_CREDENTIALS.',
  ].join('\n');
}
