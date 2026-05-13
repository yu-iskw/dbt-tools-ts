import { describe, expect, it } from 'vitest';
import { parseCliArgs, USAGE } from './cli-args';

describe('parseCliArgs', () => {
  it('returns help for --help and -h', () => {
    expect(parseCliArgs(['--help'])).toEqual({ kind: 'help' });
    expect(parseCliArgs(['-h'])).toEqual({ kind: 'help' });
  });

  it('defaults port 3000', () => {
    expect(parseCliArgs([])).toEqual({
      kind: 'ok',
      targetDir: undefined,
      port: 3000,
    });
  });

  it('accepts --no-open as a deprecated no-op', () => {
    expect(parseCliArgs(['--target', '/tmp/dbt', '--no-open'])).toEqual({
      kind: 'ok',
      targetDir: '/tmp/dbt',
      port: 3000,
    });
  });

  it('parses -t and -p', () => {
    expect(parseCliArgs(['-t', './target', '-p', '8080'])).toEqual({
      kind: 'ok',
      targetDir: './target',
      port: 8080,
    });
  });

  it('rejects unknown flags', () => {
    const r = parseCliArgs(['--verbose']);
    expect(r).toEqual({ kind: 'error', message: 'Unknown option: --verbose' });
  });

  it('rejects positional arguments', () => {
    const r = parseCliArgs(['extra']);
    expect(r).toEqual({
      kind: 'error',
      message: 'Unexpected argument: extra',
    });
  });

  it('rejects --target without value', () => {
    expect(parseCliArgs(['--target'])).toEqual({
      kind: 'error',
      message: 'Missing value for --target (or -t)',
    });
    expect(parseCliArgs(['--target', '--port', '3000'])).toEqual({
      kind: 'error',
      message: 'Missing value for --target (or -t)',
    });
  });

  it('rejects --port without value', () => {
    expect(parseCliArgs(['--port'])).toEqual({
      kind: 'error',
      message: 'Missing value for --port (or -p)',
    });
  });

  it('rejects invalid port', () => {
    expect(parseCliArgs(['--port', '0'])).toEqual({
      kind: 'error',
      message: 'Invalid port: 0',
    });
    expect(parseCliArgs(['--port', '99999'])).toEqual({
      kind: 'error',
      message: 'Invalid port: 99999',
    });
    expect(parseCliArgs(['--port', 'nope'])).toEqual({
      kind: 'error',
      message: 'Invalid port: nope',
    });
  });
});

describe('USAGE', () => {
  it('mentions core flags', () => {
    expect(USAGE).toContain('--target');
    expect(USAGE).toContain('--port');
    expect(USAGE).toContain('--help');
  });
});
