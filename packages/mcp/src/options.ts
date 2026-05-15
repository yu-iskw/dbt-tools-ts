import {
  getDbtToolsDbtTargetFromEnv,
  resolveDbtToolsDbtTargetFromFlagOrEnv,
} from '@dbt-tools/core';

export interface McpServerOptions {
  dbtTarget: string;
  pollIntervalMs?: number;
  gcsProjectId?: string;
  gcsImpersonateServiceAccount?: string;
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

function parseNonNegativeInteger(raw: string, flag: string): number {
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

interface McpFlagScratch {
  dbtTarget?: string;
  pollIntervalMs?: number;
  gcsProjectId?: string;
  gcsImpersonateServiceAccount?: string;
}

const MCP_STRING_FLAGS: Record<
  string,
  keyof Pick<McpFlagScratch, 'dbtTarget' | 'gcsProjectId' | 'gcsImpersonateServiceAccount'>
> = {
  '--dbt-target': 'dbtTarget',
  '--gcs-project-id': 'gcsProjectId',
  '--gcs-impersonate-service-account': 'gcsImpersonateServiceAccount',
};

const MCP_INT_FLAGS: Record<string, keyof Pick<McpFlagScratch, 'pollIntervalMs'>> = {
  '--poll-interval-ms': 'pollIntervalMs',
};

function parseMcpFlagArgsIntoScratch(args: string[]): McpFlagScratch {
  const s: McpFlagScratch = {};
  for (let i = 0; i < args.length; ) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      throw new McpHelpRequested();
    }
    const strField = MCP_STRING_FLAGS[arg];
    if (strField != null) {
      const raw = readFlagValue(args, i, arg).trim();
      (s as Record<string, string | undefined>)[strField] = raw;
      i += 2;
      continue;
    }
    const intField = MCP_INT_FLAGS[arg];
    if (intField != null) {
      const raw = readFlagValue(args, i, arg);
      (s as Record<string, number | undefined>)[intField] = parseNonNegativeInteger(raw, arg);
      i += 2;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }
  return s;
}

export function parseMcpServerOptions(args: string[], env: Env = process.env): McpServerOptions {
  const scratch = parseMcpFlagArgsIntoScratch(args);
  const fromFlagOrTestEnv =
    scratch.dbtTarget && scratch.dbtTarget !== '' ? scratch.dbtTarget : targetFromEnv(env);
  const resolvedTarget = resolveDbtToolsDbtTargetFromFlagOrEnv(fromFlagOrTestEnv);

  return {
    dbtTarget: resolvedTarget,
    ...(scratch.pollIntervalMs !== undefined ? { pollIntervalMs: scratch.pollIntervalMs } : {}),
    ...(scratch.gcsProjectId !== undefined && scratch.gcsProjectId !== ''
      ? { gcsProjectId: scratch.gcsProjectId }
      : {}),
    ...(scratch.gcsImpersonateServiceAccount !== undefined &&
    scratch.gcsImpersonateServiceAccount !== ''
      ? { gcsImpersonateServiceAccount: scratch.gcsImpersonateServiceAccount }
      : {}),
  };
}

export function helpText(): string {
  return [
    'Usage: dbt-tools-mcp --dbt-target <path|s3://bucket/prefix|gs://bucket/prefix> [options]',
    '',
    'Options:',
    '  --dbt-target <target>             Local target directory, s3:// prefix, or gs:// prefix',
    '  --gcs-project-id <id>             Google Cloud project ID for the GCS client (gs:// targets only)',
    '  --gcs-impersonate-service-account <email>',
    '                                    Service account to impersonate for GCS (gs:// targets only)',
    '  --poll-interval-ms <ms>           Best-effort refresh polling interval',
    '  -h, --help                        Show this help message',
  ].join('\n');
}
