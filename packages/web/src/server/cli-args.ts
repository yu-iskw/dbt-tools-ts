/** Pure CLI argument parsing for `dbt-tools-web` (testable without starting the server). */

export const USAGE = `
Usage: dbt-tools-web [options]

  --target <dir>   Path to dbt target directory (sets DBT_TOOLS_TARGET_DIR)
  --port   <n>     Port to listen on (default: 3000)
  --help           Show this help message
`.trimStart();

export type ParsedCli =
  | {
      kind: 'ok';
      targetDir: string | undefined;
      port: number;
    }
  | { kind: 'error'; message: string }
  | { kind: 'help' };

type MutableCliState = {
  targetDir: string | undefined;
  port: number;
};

type RequiredValue =
  | { ok: false; message: string }
  | { ok: true; value: string; nextIndex: number };

function readRequiredValue(argv: string[], i: number, flagDesc: string): RequiredValue {
  const next = argv[i + 1];
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

type Step = { status: 'advance'; nextIndex: number } | { status: 'done'; result: ParsedCli };

function consumeOne(argv: string[], i: number, state: MutableCliState): Step {
  const arg = argv.at(i)!;
  if (arg === '--help' || arg === '-h') {
    return { status: 'done', result: { kind: 'help' } };
  }
  // Backward compatibility: browser auto-open was removed (no child_process).
  if (arg === '--no-open') {
    return { status: 'advance', nextIndex: i + 1 };
  }
  if (arg === '--target' || arg === '-t') {
    const r = readRequiredValue(argv, i, '--target (or -t)');
    if (!r.ok) {
      return { status: 'done', result: { kind: 'error', message: r.message } };
    }
    state.targetDir = r.value;
    return { status: 'advance', nextIndex: r.nextIndex + 1 };
  }
  if (arg === '--port' || arg === '-p') {
    const r = readRequiredValue(argv, i, '--port (or -p)');
    if (!r.ok) {
      return { status: 'done', result: { kind: 'error', message: r.message } };
    }
    const p = parsePortString(r.value);
    if (p === null) {
      return {
        status: 'done',
        result: { kind: 'error', message: `Invalid port: ${r.value}` },
      };
    }
    state.port = p;
    return { status: 'advance', nextIndex: r.nextIndex + 1 };
  }
  if (arg.startsWith('-')) {
    return {
      status: 'done',
      result: { kind: 'error', message: `Unknown option: ${arg}` },
    };
  }
  return {
    status: 'done',
    result: { kind: 'error', message: `Unexpected argument: ${arg}` },
  };
}

export function parseCliArgs(argv: string[]): ParsedCli {
  const state: MutableCliState = {
    targetDir: undefined,
    port: 3000,
  };
  let i = 0;
  while (i < argv.length) {
    const step = consumeOne(argv, i, state);
    if (step.status === 'done') {
      return step.result;
    }
    i = step.nextIndex;
  }
  return {
    kind: 'ok',
    targetDir: state.targetDir,
    port: state.port,
  };
}
