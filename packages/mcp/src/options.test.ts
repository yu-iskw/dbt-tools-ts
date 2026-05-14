import { describe, expect, it } from 'vitest';
import { McpHelpRequested, parseMcpServerOptions } from './options.js';

describe('parseMcpServerOptions', () => {
  it('uses --dbt-target and numeric polling options', () => {
    expect(
      parseMcpServerOptions([
        '--dbt-target',
        's3://bucket/prefix',
        '--poll-interval-ms',
        '30000',
        '--max-cached-runs',
        '1',
      ]),
    ).toEqual({
      dbtTarget: 's3://bucket/prefix',
      pollIntervalMs: 30000,
      maxCachedRuns: 1,
    });
  });

  it('falls back to DBT_TOOLS_DBT_TARGET when the flag is omitted', () => {
    expect(parseMcpServerOptions([], { DBT_TOOLS_DBT_TARGET: './target' })).toEqual({
      dbtTarget: './target',
    });
  });

  it('throws when no target is available', () => {
    expect(() => parseMcpServerOptions([], {})).toThrow(/dbt artifact target is required/i);
  });

  it('uses a typed signal for help output', () => {
    expect(() => parseMcpServerOptions(['--help'], {})).toThrow(McpHelpRequested);
  });
});
