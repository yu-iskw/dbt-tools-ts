import {
  assertRemoteFlagsMatchTarget,
  entrypointRemoteHelpLines,
  normalizeEntrypointRemoteOptions,
  parseEntrypointRemoteArgv,
  resolveEntrypointDbtTarget,
  type EntrypointRemoteOptions,
} from '@dbt-tools/core';

export interface McpServerOptions extends EntrypointRemoteOptions {
  pollIntervalMs?: number;
}

export type McpRemoteClientFlagOptions = Pick<
  McpServerOptions,
  'gcsImpersonateServiceAccount' | 'gcsProjectId' | 's3Endpoint' | 's3Region'
>;

export { assertRemoteFlagsMatchTarget };

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

interface ParsedMcpArgv extends EntrypointRemoteOptions {
  pollIntervalMs?: number;
}

function partitionMcpArgv(args: string[]): { remoteArgs: string[]; pollIntervalMs?: number } {
  const remoteArgs: string[] = [];
  let pollIntervalMs: number | undefined;
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === undefined) continue;
    if (arg === '--poll-interval-ms') {
      pollIntervalMs = parsePositiveInteger(readFlagValue(args, i, arg), arg);
      i += 2;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      throw new McpHelpRequested();
    }
    if (arg === '--version' || arg === '-V') {
      throw new McpVersionRequested();
    }
    remoteArgs.push(arg);
    if (ENTRYPOINT_VALUE_FLAGS.has(arg)) {
      remoteArgs.push(readFlagValue(args, i, arg));
      i += 2;
    } else {
      i += 1;
    }
  }
  return { remoteArgs, pollIntervalMs };
}

const ENTRYPOINT_VALUE_FLAGS = new Set([
  '--dbt-target',
  '--gcs-project-id',
  '--gcs-impersonate-service-account',
  '--s3-region',
  '--s3-endpoint',
]);

export class McpVersionRequested extends Error {
  constructor() {
    super('');
    this.name = 'McpVersionRequested';
  }
}

function mcpOptionsFromParts(
  remote: EntrypointRemoteOptions,
  pollIntervalMs?: number,
  resolvedTarget?: string,
): McpServerOptions {
  return {
    ...(resolvedTarget != null ? { dbtTarget: resolvedTarget } : {}),
    ...(pollIntervalMs !== undefined ? { pollIntervalMs } : {}),
    ...(remote.gcsProjectId != null ? { gcsProjectId: remote.gcsProjectId } : {}),
    ...(remote.gcsImpersonateServiceAccount != null
      ? { gcsImpersonateServiceAccount: remote.gcsImpersonateServiceAccount }
      : {}),
    ...(remote.s3Region != null ? { s3Region: remote.s3Region } : {}),
    ...(remote.s3Endpoint != null ? { s3Endpoint: remote.s3Endpoint } : {}),
  };
}

export function parseMcpServerOptions(args: string[], env: Env = process.env): McpServerOptions {
  const { remoteArgs, pollIntervalMs } = partitionMcpArgv(args);
  const explicit = parseEntrypointRemoteArgv(remoteArgs);
  const resolvedTarget = resolveEntrypointDbtTarget(explicit, env);

  if (resolvedTarget != null) {
    assertRemoteFlagsMatchTarget(resolvedTarget, explicit);
  }

  const remote = normalizeEntrypointRemoteOptions(explicit);
  return mcpOptionsFromParts(remote, pollIntervalMs, resolvedTarget);
}

export function helpText(): string {
  return [
    'Usage: dbt-tools-mcp [--dbt-target <path|s3://bucket/prefix|gs://bucket/prefix>] [options]',
    '',
    'Options (CLI flags override the env vars below when both are set):',
    ...entrypointRemoteHelpLines(),
    '  --poll-interval-ms <ms>',
    '      MCP background refresh interval; 0 disables. No env equivalent (use args).',
    '  -V, --version',
    '      Print package version',
    '  -h, --help',
    '      Show this help',
    '',
    'Bucket and prefix always come from the --dbt-target URI (or DBT_TOOLS_DBT_TARGET).',
    'Remote credentials: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_PROFILE, GOOGLE_APPLICATION_CREDENTIALS.',
    'Debug: DBT_TOOLS_DEBUG=1 logs progress to stderr (safe for MCP; do not write to stdout).',
  ].join('\n');
}
