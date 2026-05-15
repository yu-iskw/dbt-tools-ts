import { describe, expect, it } from 'vitest';
import {
  joinObjectStorageKey,
  mergeRemoteSourceConfigWithParsedLocation,
  normalizeArtifactPrefix,
  parseArtifactSourceLocation,
} from './artifact-location';

describe('normalizeArtifactPrefix', () => {
  it('trims leading and trailing slashes', () => {
    expect(normalizeArtifactPrefix('/a/b/')).toBe('a/b');
    expect(normalizeArtifactPrefix('///x///')).toBe('x');
  });

  it('returns empty when only slashes', () => {
    expect(normalizeArtifactPrefix('///')).toBe('');
  });

  it('leaves middle segments unchanged when no outer slashes', () => {
    expect(normalizeArtifactPrefix('a/b')).toBe('a/b');
  });

  it('preserves internal slash runs', () => {
    expect(normalizeArtifactPrefix('//a//b//')).toBe('a//b');
  });

  it('returns empty for empty input', () => {
    expect(normalizeArtifactPrefix('')).toBe('');
  });

  it('handles long leading and trailing slash runs in linear time', () => {
    const n = 10_000;
    const inner = 'path/segment';
    const prefix = `${'/'.repeat(n)}${inner}${'/'.repeat(n)}`;
    expect(normalizeArtifactPrefix(prefix)).toBe(inner);
  });
});

describe('parseArtifactSourceLocation', () => {
  it('parses s3:// URL', () => {
    const r = parseArtifactSourceLocation('s3', 's3://my-bucket/path/to/arts', '/tmp');
    expect(r).toEqual({
      kind: 'remote',
      provider: 's3',
      bucket: 'my-bucket',
      prefix: 'path/to/arts',
    });
  });

  it('parses gcs bucket/prefix without scheme', () => {
    const r = parseArtifactSourceLocation('gcs', 'mybucket/prefix/here', '/tmp');
    expect(r).toEqual({
      kind: 'remote',
      provider: 'gcs',
      bucket: 'mybucket',
      prefix: 'prefix/here',
    });
  });

  it('throws on empty location', () => {
    expect(() => parseArtifactSourceLocation('local', '   ', '/tmp')).toThrow(/required/i);
  });
});

describe('joinObjectStorageKey', () => {
  it('joins prefix and relative', () => {
    expect(joinObjectStorageKey('a/b', 'manifest.json')).toBe('a/b/manifest.json');
  });
});

describe('mergeRemoteSourceConfigWithParsedLocation', () => {
  it('inherits S3 options from env when provider matches', () => {
    const merged = mergeRemoteSourceConfigWithParsedLocation(
      {
        provider: 's3',
        bucket: 'ignored',
        prefix: 'ignored',
        pollIntervalMs: 12_000,
        region: 'us-west-2',
        endpoint: 'http://localhost:9000',
        forcePathStyle: true,
      },
      {
        kind: 'remote',
        provider: 's3',
        bucket: 'b',
        prefix: 'p',
      },
    );
    expect(merged).toMatchObject({
      provider: 's3',
      bucket: 'b',
      prefix: 'p',
      pollIntervalMs: 12_000,
      region: 'us-west-2',
      endpoint: 'http://localhost:9000',
      forcePathStyle: true,
    });
  });

  it('merges gcs project and impersonation from env when provider matches', () => {
    const merged = mergeRemoteSourceConfigWithParsedLocation(
      {
        provider: 'gcs',
        bucket: 'ignored',
        prefix: 'ignored',
        pollIntervalMs: 5000,
        projectId: 'from-env',
        impersonateServiceAccount: 'env@x.iam.gserviceaccount.com',
      },
      {
        kind: 'remote',
        provider: 'gcs',
        bucket: 'real-bucket',
        prefix: 'real/prefix',
      },
    );
    expect(merged).toEqual({
      provider: 'gcs',
      bucket: 'real-bucket',
      prefix: 'real/prefix',
      pollIntervalMs: 5000,
      projectId: 'from-env',
      impersonateServiceAccount: 'env@x.iam.gserviceaccount.com',
    });
  });

  it('lets gcs auth overrides beat env json for project and impersonation', () => {
    const merged = mergeRemoteSourceConfigWithParsedLocation(
      {
        provider: 'gcs',
        bucket: 'ignored',
        prefix: 'ignored',
        pollIntervalMs: 9000,
        projectId: 'env-project',
        impersonateServiceAccount: 'env@x.iam.gserviceaccount.com',
      },
      {
        kind: 'remote',
        provider: 'gcs',
        bucket: 'b',
        prefix: 'p',
      },
      { projectId: 'flag-project', impersonateServiceAccount: 'flag@y.iam.gserviceaccount.com' },
    );
    expect(merged).toMatchObject({
      bucket: 'b',
      prefix: 'p',
      pollIntervalMs: 9000,
      projectId: 'flag-project',
      impersonateServiceAccount: 'flag@y.iam.gserviceaccount.com',
    });
  });

  it('ignores gcs overrides for s3 parsed target', () => {
    const merged = mergeRemoteSourceConfigWithParsedLocation(
      {
        provider: 'gcs',
        bucket: 'ignored',
        prefix: 'ignored',
        pollIntervalMs: 8000,
        projectId: 'env-only',
        impersonateServiceAccount: 'env@x.iam.gserviceaccount.com',
      },
      {
        kind: 'remote',
        provider: 's3',
        bucket: 'sb',
        prefix: 'sp',
      },
      {
        projectId: 'should-not-apply',
        impersonateServiceAccount: 'nope@x.iam.gserviceaccount.com',
      },
    );
    expect(merged).toEqual({
      provider: 's3',
      bucket: 'sb',
      prefix: 'sp',
      pollIntervalMs: 8000,
      region: undefined,
      endpoint: undefined,
      forcePathStyle: undefined,
    });
  });
});
