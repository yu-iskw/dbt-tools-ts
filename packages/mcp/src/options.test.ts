import { describe, expect, it } from 'vitest';

import {
  assertRemoteFlagsMatchTarget,
  McpHelpRequested,
  parseMcpServerOptions,
} from './options.js';

describe('parseMcpServerOptions', () => {
  it('uses --dbt-target and remote client flags for S3', () => {
    expect(
      parseMcpServerOptions([
        '--dbt-target',
        's3://bucket/prefix',
        '--poll-interval-ms',
        '30000',
        '--s3-region',
        'ap-northeast-1',
        '--s3-endpoint',
        'https://s3.local',
      ]),
    ).toEqual({
      dbtTarget: 's3://bucket/prefix',
      pollIntervalMs: 30000,
      s3Region: 'ap-northeast-1',
      s3Endpoint: 'https://s3.local',
    });
  });

  it('parses GCS remote flags', () => {
    expect(
      parseMcpServerOptions([
        '--dbt-target',
        'gs://bucket/prefix',
        '--gcs-project-id',
        'my-project',
        '--gcs-impersonate-service-account',
        'reader@my-project.iam.gserviceaccount.com',
      ]),
    ).toEqual({
      dbtTarget: 'gs://bucket/prefix',
      gcsProjectId: 'my-project',
      gcsImpersonateServiceAccount: 'reader@my-project.iam.gserviceaccount.com',
    });
  });

  it('falls back to DBT_TOOLS_DBT_TARGET when the flag is omitted', () => {
    expect(parseMcpServerOptions([], { DBT_TOOLS_DBT_TARGET: './target' })).toEqual({
      dbtTarget: './target',
    });
  });

  it('allows missing target when no env is set', () => {
    expect(parseMcpServerOptions([], {})).toEqual({});
  });

  it('allows GCS remote flags without a startup target', () => {
    expect(
      parseMcpServerOptions([
        '--gcs-project-id',
        'my-project',
        '--gcs-impersonate-service-account',
        'reader@my-project.iam.gserviceaccount.com',
      ]),
    ).toEqual({
      gcsProjectId: 'my-project',
      gcsImpersonateServiceAccount: 'reader@my-project.iam.gserviceaccount.com',
    });
  });

  it('throws for unknown flags', () => {
    expect(() => parseMcpServerOptions(['--max-cached-runs', '1'], {})).toThrow(/Unknown option/i);
  });

  it('parses cache sizing flags and env overrides', () => {
    expect(
      parseMcpServerOptions(['--max-cached-targets', '3', '--cache-ttl-ms', '60000'], {}),
    ).toEqual({
      maxCachedTargets: 3,
      cacheTtlMs: 60000,
    });
    expect(
      parseMcpServerOptions([], {
        DBT_TOOLS_MAX_CACHED_TARGETS: '0',
        DBT_TOOLS_CACHE_TTL_MS: '120000',
      }),
    ).toEqual({
      maxCachedTargets: 0,
      cacheTtlMs: 120000,
    });
  });

  it('throws when remote flags are used with a local target', () => {
    expect(() =>
      parseMcpServerOptions(['--dbt-target', './target', '--gcs-project-id', 'p'], {}),
    ).toThrow(/Remote client flags require/i);
  });

  it('throws when S3 flags are used with a GCS target', () => {
    expect(() =>
      parseMcpServerOptions(['--dbt-target', 'gs://b/p', '--s3-region', 'us-east-1'], {}),
    ).toThrow(/only valid for s3/i);
  });

  it('throws when GCS flags are used with an S3 target', () => {
    expect(() =>
      parseMcpServerOptions(['--dbt-target', 's3://b/p', '--gcs-project-id', 'p'], {}),
    ).toThrow(/only valid for gs/i);
  });

  it('uses a typed signal for help output', () => {
    expect(() => parseMcpServerOptions(['--help'], {})).toThrow(McpHelpRequested);
  });
});

describe('McpVersionRequested', () => {
  it('is thrown for --version', async () => {
    const { McpVersionRequested } = await import('./options.js');
    expect(() => parseMcpServerOptions(['--version'], {})).toThrow(McpVersionRequested);
  });
});

describe('assertRemoteFlagsMatchTarget', () => {
  it('allows GCS flags on gs:// targets', () => {
    expect(() => assertRemoteFlagsMatchTarget('gs://b/p', { gcsProjectId: 'proj' })).not.toThrow();
  });

  it('rejects GCS flags when the runtime target is s3://', () => {
    expect(() => assertRemoteFlagsMatchTarget('s3://b/p', { gcsProjectId: 'proj' })).toThrow(
      /only valid for gs/i,
    );
  });
});
