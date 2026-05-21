import { describe, expect, it } from 'vitest';

import { parseCliArgs, readWebPackageVersion, USAGE } from './cli-args';

describe('parseCliArgs', () => {
  it('returns help for --help and -h', () => {
    expect(parseCliArgs(['--help'])).toEqual({ kind: 'help' });
    expect(parseCliArgs(['-h'])).toEqual({ kind: 'help' });
  });

  it('returns version for --version and -V', () => {
    expect(parseCliArgs(['--version'])).toEqual({ kind: 'version' });
    expect(parseCliArgs(['-V'])).toEqual({ kind: 'version' });
  });

  it('defaults port 3000', () => {
    expect(parseCliArgs([])).toEqual({
      kind: 'ok',
      port: 3000,
      explicit: {},
      usedTargetAlias: false,
    });
  });

  it('accepts --no-open as a deprecated no-op', () => {
    expect(parseCliArgs(['--target', '/tmp/dbt', '--no-open'])).toEqual({
      kind: 'ok',
      port: 3000,
      explicit: { dbtTarget: '/tmp/dbt' },
      usedTargetAlias: true,
    });
  });

  it('parses -t and -p', () => {
    expect(parseCliArgs(['-t', './target', '-p', '8080'])).toEqual({
      kind: 'ok',
      port: 8080,
      explicit: { dbtTarget: './target' },
      usedTargetAlias: true,
    });
  });

  it('accepts remote client flags', () => {
    expect(
      parseCliArgs([
        '--dbt-target',
        'gs://bucket/prefix',
        '--gcs-impersonate-service-account',
        'reader@project.iam.gserviceaccount.com',
      ]),
    ).toEqual({
      kind: 'ok',
      port: 3000,
      explicit: {
        dbtTarget: 'gs://bucket/prefix',
        gcsImpersonateServiceAccount: 'reader@project.iam.gserviceaccount.com',
      },
      usedTargetAlias: false,
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

  it('rejects both --dbt-target and --target', () => {
    expect(parseCliArgs(['--dbt-target', './a', '--target', './b'])).toEqual({
      kind: 'error',
      message: 'Cannot use both --dbt-target and --target (or -t).',
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
    expect(USAGE).toContain('--dbt-target');
    expect(USAGE).toContain('--gcs-impersonate-service-account');
    expect(USAGE).toContain('--target');
    expect(USAGE).toContain('--port');
    expect(USAGE).toContain('--version');
    expect(USAGE).toContain('--help');
  });
});

describe('readWebPackageVersion', () => {
  it('returns a non-empty semver-like string', () => {
    expect(readWebPackageVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
