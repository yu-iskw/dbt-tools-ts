import { describe, expect, it } from 'vitest';

import {
  applyEntrypointRemoteOptionsToEnv,
  assertRemoteFlagsMatchTarget,
  parseEntrypointRemoteArgv,
  resolveEntrypointDbtTarget,
  resolveEntrypointRemoteOptions,
} from './entrypoint-options';

describe('parseEntrypointRemoteArgv', () => {
  it('parses --dbt-target and S3 remote flags', () => {
    expect(
      parseEntrypointRemoteArgv([
        '--dbt-target',
        's3://bucket/prefix',
        '--s3-region',
        'ap-northeast-1',
        '--s3-endpoint',
        'https://s3.local',
      ]),
    ).toEqual({
      dbtTarget: 's3://bucket/prefix',
      s3Region: 'ap-northeast-1',
      s3Endpoint: 'https://s3.local',
    });
  });

  it('parses GCS remote flags', () => {
    expect(
      parseEntrypointRemoteArgv([
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

  it('throws for unknown flags', () => {
    expect(() => parseEntrypointRemoteArgv(['--max-cached-runs', '1'])).toThrow(/Unknown option/i);
  });
});

describe('resolveEntrypointRemoteOptions', () => {
  it('falls back to DBT_TOOLS_DBT_TARGET when the flag is omitted', () => {
    expect(resolveEntrypointRemoteOptions({}, { DBT_TOOLS_DBT_TARGET: './target' })).toEqual({
      dbtTarget: './target',
    });
  });

  it('allows missing target when no env is set', () => {
    expect(resolveEntrypointRemoteOptions({}, {})).toEqual({});
  });

  it('allows GCS remote flags without a startup target', () => {
    expect(
      resolveEntrypointRemoteOptions(
        parseEntrypointRemoteArgv([
          '--gcs-project-id',
          'my-project',
          '--gcs-impersonate-service-account',
          'reader@my-project.iam.gserviceaccount.com',
        ]),
      ),
    ).toEqual({
      gcsProjectId: 'my-project',
      gcsImpersonateServiceAccount: 'reader@my-project.iam.gserviceaccount.com',
    });
  });

  it('throws when remote flags are used with a local target', () => {
    expect(() =>
      resolveEntrypointRemoteOptions(
        parseEntrypointRemoteArgv(['--dbt-target', './target', '--gcs-project-id', 'p']),
        {},
      ),
    ).toThrow(/Remote client flags require/i);
  });

  it('throws when S3 flags are used with a GCS target', () => {
    expect(() =>
      resolveEntrypointRemoteOptions(
        parseEntrypointRemoteArgv(['--dbt-target', 'gs://b/p', '--s3-region', 'us-east-1']),
        {},
      ),
    ).toThrow(/only valid for s3/i);
  });

  it('throws when GCS flags are used with an S3 target', () => {
    expect(() =>
      resolveEntrypointRemoteOptions(
        parseEntrypointRemoteArgv(['--dbt-target', 's3://b/p', '--gcs-project-id', 'p']),
        {},
      ),
    ).toThrow(/only valid for gs/i);
  });
});

describe('resolveEntrypointDbtTarget', () => {
  it('prefers explicit --dbt-target over env', () => {
    expect(
      resolveEntrypointDbtTarget({ dbtTarget: './flag' }, { DBT_TOOLS_DBT_TARGET: './env' }),
    ).toBe('./flag');
  });
});

describe('applyEntrypointRemoteOptionsToEnv', () => {
  it('sets env vars only for explicit argv options', () => {
    const env: Record<string, string | undefined> = {
      DBT_TOOLS_DBT_TARGET: 'old',
      DBT_TOOLS_GCS_PROJECT_ID: 'keep',
    };
    applyEntrypointRemoteOptionsToEnv(
      parseEntrypointRemoteArgv([
        '--dbt-target',
        'gs://b/p',
        '--gcs-impersonate-service-account',
        'sa@test.iam.gserviceaccount.com',
      ]),
      env,
    );
    expect(env.DBT_TOOLS_DBT_TARGET).toBe('gs://b/p');
    expect(env.DBT_TOOLS_GCS_IMPERSONATE_SERVICE_ACCOUNT).toBe('sa@test.iam.gserviceaccount.com');
    expect(env.DBT_TOOLS_GCS_PROJECT_ID).toBe('keep');
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
