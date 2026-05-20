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

  it('merges GCS request impersonation and inherits projectId from env when provider matches', () => {
    const merged = mergeRemoteSourceConfigWithParsedLocation(
      {
        provider: 'gcs',
        bucket: 'ignored',
        prefix: 'ignored',
        pollIntervalMs: 9_000,
        projectId: 'env-proj',
      },
      {
        kind: 'remote',
        provider: 'gcs',
        bucket: 'b',
        prefix: 'p',
      },
      { impersonatedServiceAccount: '  target@svc.iam.gserviceaccount.com  ' },
    );
    expect(merged).toEqual({
      provider: 'gcs',
      bucket: 'b',
      prefix: 'p',
      pollIntervalMs: 9_000,
      projectId: 'env-proj',
      impersonatedServiceAccount: 'target@svc.iam.gserviceaccount.com',
    });
  });

  it('applies clientOverrides projectId over env GCS projectId', () => {
    const merged = mergeRemoteSourceConfigWithParsedLocation(
      {
        provider: 'gcs',
        bucket: 'ignored',
        prefix: 'ignored',
        pollIntervalMs: 9_000,
        projectId: 'env-proj',
      },
      { kind: 'remote', provider: 'gcs', bucket: 'b', prefix: 'p' },
      undefined,
      { projectId: 'cli-proj' },
    );
    expect(merged).toMatchObject({
      provider: 'gcs',
      projectId: 'cli-proj',
    });
  });

  it('uses impersonatedServiceAccount from env GCS config when gcsRequestOptions omitted', () => {
    const merged = mergeRemoteSourceConfigWithParsedLocation(
      {
        provider: 'gcs',
        bucket: 'ignored',
        prefix: 'ignored',
        pollIntervalMs: 9_000,
        impersonatedServiceAccount: 'from-env@proj.iam.gserviceaccount.com',
      },
      { kind: 'remote', provider: 'gcs', bucket: 'b', prefix: 'p' },
    );
    expect(merged.impersonatedServiceAccount).toBe('from-env@proj.iam.gserviceaccount.com');
  });

  it('merges GCS impersonation principal from gcsRequestOptions', () => {
    const merged = mergeRemoteSourceConfigWithParsedLocation(
      {
        provider: 'gcs',
        bucket: 'ignored',
        prefix: 'ignored',
        pollIntervalMs: 9_000,
        projectId: 'env-proj',
      },
      { kind: 'remote', provider: 'gcs', bucket: 'b', prefix: 'p' },
      { impersonatedServiceAccount: 'svc@myorg.iam.gserviceaccount.com' },
    );
    expect(merged.impersonatedServiceAccount).toBe('svc@myorg.iam.gserviceaccount.com');
  });
});
