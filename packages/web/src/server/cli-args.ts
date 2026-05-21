/** Pure CLI argument parsing for `dbt-tools-web` (testable without starting the server). */

import {
  argvElementAt,
  entrypointRemoteHelpLines,
  parseEntrypointRemoteArgv,
  type EntrypointRemoteOptions,
} from '@dbt-tools/core';

import { readWebPackageVersion } from './package-version';

export const USAGE = [
  'Usage: dbt-tools-web [options]',
  '',
  'Options (CLI flags override env when both are set):',
  ...entrypointRemoteHelpLines(),
  '  --target <dir>              Alias for local --dbt-target (sets DBT_TOOLS_TARGET_DIR)',
  '  --port <n>                  Port to listen on (default: 3000)',
  '  -V, --version               Print package version',
  '  -h, --help                  Show this help',
].join('\n');

export type ParsedCli =
  | {
      kind: 'ok';
      port: number;
      explicit: EntrypointRemoteOptions;
      /** True when `--target` / `-t` supplied the dbt target (local alias). */
      usedTargetAlias: boolean;
    }
  | { kind: 'error'; message: string }
  | { kind: 'help' }
  | { kind: 'version' };

type RequiredValue =
  | { ok: false; message: string }
  | { ok: true; value: string; nextIndex: number };

const ENTRYPOINT_VALUE_FLAGS = new Set([
  '--dbt-target',
  '--gcs-project-id',
  '--gcs-impersonate-service-account',
  '--s3-region',
  '--s3-endpoint',
]);

function readRequiredValue(argv: readonly string[], i: number, flagDesc: string): RequiredValue {
  const next = argvElementAt(argv, i + 1);
  if (!next || next.startsWith('-')) {
    return { ok: false, message: `Missing value for ${flagDesc}` };
  }
  return { ok: true, value: next, nextIndex: i + 1 };
}

function parsePortString(s: string): number | null {
  const parsed = Number.parseInt(s, 10);
  if (Number.isNaN(parsed) || parsed < 1 || parsed > 65535) {
    return null;
  }
  return parsed;
}

type WebPartitionBody = {
  remoteArgs: string[];
  port: number;
  targetAlias?: string;
};

function parseEarlyWebFlag(arg: string): ParsedCli | undefined {
  if (arg === '--help' || arg === '-h') {
    return { kind: 'help' };
  }
  if (arg === '--version' || arg === '-V') {
    return { kind: 'version' };
  }
  return undefined;
}

function advanceWebArgv(
  argv: readonly string[],
  i: number,
  arg: string,
  body: WebPartitionBody,
): ParsedCli | { nextIndex: number } {
  if (arg === '--no-open') {
    return { nextIndex: i + 1 };
  }
  if (arg === '--target' || arg === '-t') {
    const r = readRequiredValue(argv, i, '--target (or -t)');
    if (!r.ok) {
      return { kind: 'error', message: r.message };
    }
    body.targetAlias = r.value;
    return { nextIndex: r.nextIndex + 1 };
  }
  if (arg === '--port' || arg === '-p') {
    const r = readRequiredValue(argv, i, '--port (or -p)');
    if (!r.ok) {
      return { kind: 'error', message: r.message };
    }
    const p = parsePortString(r.value);
    if (p === null) {
      return { kind: 'error', message: `Invalid port: ${r.value}` };
    }
    body.port = p;
    return { nextIndex: r.nextIndex + 1 };
  }
  if (!arg.startsWith('-')) {
    return { kind: 'error', message: `Unexpected argument: ${arg}` };
  }
  if (!ENTRYPOINT_VALUE_FLAGS.has(arg)) {
    return { kind: 'error', message: `Unknown option: ${arg}` };
  }
  const value = argvElementAt(argv, i + 1);
  if (value == null || value.startsWith('-')) {
    return { kind: 'error', message: `${arg} requires a value.` };
  }
  body.remoteArgs.push(arg, value);
  return { nextIndex: i + 2 };
}

function partitionWebArgv(
  argv: readonly string[],
): ParsedCli | { remoteArgs: string[]; port: number; targetAlias?: string } {
  const body: WebPartitionBody = { remoteArgs: [], port: 3000 };
  let i = 0;
  while (i < argv.length) {
    const arg = argvElementAt(argv, i);
    if (arg === undefined) break;
    const early = parseEarlyWebFlag(arg);
    if (early !== undefined) {
      return early;
    }
    const step = advanceWebArgv(argv, i, arg, body);
    if ('kind' in step) {
      return step;
    }
    i = step.nextIndex;
  }
  return body;
}

export function parseCliArgs(argv: string[]): ParsedCli {
  const partitioned = partitionWebArgv(argv);
  if ('kind' in partitioned) {
    return partitioned;
  }

  const { remoteArgs, port, targetAlias } = partitioned;
  let explicit: EntrypointRemoteOptions;
  try {
    explicit = parseEntrypointRemoteArgv(remoteArgs);
  } catch (error) {
    return {
      kind: 'error',
      message: error instanceof Error ? error.message : String(error),
    };
  }

  let usedTargetAlias = false;
  if (targetAlias != null && explicit.dbtTarget == null) {
    explicit = { ...explicit, dbtTarget: targetAlias };
    usedTargetAlias = true;
  } else if (targetAlias != null && explicit.dbtTarget != null) {
    return {
      kind: 'error',
      message: 'Cannot use both --dbt-target and --target (or -t).',
    };
  }

  return {
    kind: 'ok',
    port,
    explicit,
    usedTargetAlias,
  };
}

/** @internal Exported for tests that assert version string shape. */
export { readWebPackageVersion };
