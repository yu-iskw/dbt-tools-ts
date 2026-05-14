import { getDbtToolsDbtTargetFromEnv } from '@dbt-tools/core';

export interface McpServerOptions {
  dbtTarget: string;
  pollIntervalMs?: number;
  maxCachedRuns?: number;
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

export function parseMcpServerOptions(args: string[], env: Env = process.env): McpServerOptions {
  let dbtTarget: string | undefined;
  let pollIntervalMs: number | undefined;
  let maxCachedRuns: number | undefined;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--dbt-target') {
      dbtTarget = readFlagValue(args, i, arg).trim();
      i += 1;
    } else if (arg === '--poll-interval-ms') {
      pollIntervalMs = parsePositiveInteger(readFlagValue(args, i, arg), arg);
      i += 1;
    } else if (arg === '--max-cached-runs') {
      maxCachedRuns = parsePositiveInteger(readFlagValue(args, i, arg), arg);
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      throw new McpHelpRequested();
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  const resolvedTarget = dbtTarget && dbtTarget !== '' ? dbtTarget : targetFromEnv(env);
  if (resolvedTarget == null) {
    throw new Error(
      'dbt artifact target is required. Pass --dbt-target <path|s3://bucket/prefix|gs://bucket/prefix> or set DBT_TOOLS_DBT_TARGET.',
    );
  }

  return {
    dbtTarget: resolvedTarget,
    ...(pollIntervalMs !== undefined ? { pollIntervalMs } : {}),
    ...(maxCachedRuns !== undefined ? { maxCachedRuns } : {}),
  };
}

export function helpText(): string {
  return [
    'Usage: dbt-tools-mcp --dbt-target <path|s3://bucket/prefix|gs://bucket/prefix> [options]',
    '',
    'Options:',
    '  --dbt-target <target>       Local target directory, s3:// prefix, or gs:// prefix',
    '  --poll-interval-ms <ms>     Best-effort refresh polling interval',
    '  --max-cached-runs <count>   Reserved cache bound; first release keeps one selected run',
    '  -h, --help                  Show this help message',
  ].join('\n');
}
