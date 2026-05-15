import { describe, expect, it } from 'vitest';
import { McpHelpRequested, helpText, parseMcpServerOptions } from './options.js';

describe('parseMcpServerOptions', () => {
  it('uses --dbt-target and numeric polling options', () => {
    expect(
      parseMcpServerOptions(['--dbt-target', 's3://bucket/prefix', '--poll-interval-ms', '30000']),
    ).toEqual({
      dbtTarget: 's3://bucket/prefix',
      pollIntervalMs: 30000,
    });
  });

  it('rejects removed --max-cached-runs flag', () => {
    expect(() =>
      parseMcpServerOptions(['--dbt-target', 's3://bucket/prefix', '--max-cached-runs', '1'], {}),
    ).toThrow(/Unknown option/);
  });

  it('falls back to DBT_TOOLS_DBT_TARGET when the flag is omitted', () => {
    expect(parseMcpServerOptions([], { DBT_TOOLS_DBT_TARGET: './target' })).toEqual({
      dbtTarget: './target',
    });
  });

  it('throws when no target is available', () => {
    expect(() => parseMcpServerOptions([], {})).toThrow(/dbt artifact target is required/i);
  });

  it('parses GCS auth flags', () => {
    expect(
      parseMcpServerOptions([
        '--dbt-target',
        'gs://bucket/prefix',
        '--gcs-project-id',
        'my-gcp-project',
        '--gcs-impersonate-service-account',
        'svc@my-gcp-project.iam.gserviceaccount.com',
      ]),
    ).toEqual({
      dbtTarget: 'gs://bucket/prefix',
      gcsProjectId: 'my-gcp-project',
      gcsImpersonateServiceAccount: 'svc@my-gcp-project.iam.gserviceaccount.com',
    });
  });

  it('help text documents GCS options once and omits removed cache flag', () => {
    const text = helpText();
    expect((text.match(/--gcs-project-id/g) ?? []).length).toBe(1);
    expect(text).toContain('--gcs-impersonate-service-account');
    expect(text).not.toContain('--max-cached-runs');
  });

  it('uses a typed signal for help output', () => {
    expect(() => parseMcpServerOptions(['--help'], {})).toThrow(McpHelpRequested);
  });
});
