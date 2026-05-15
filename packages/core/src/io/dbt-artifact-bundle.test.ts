import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ArtifactBundleResolutionError } from '../errors/artifact-bundle-resolution-error';
import {
  isRemoteObjectNotFoundError,
  parseDbtToolsArtifactTarget,
  resolveDbtToolsArtifactBundlePaths,
} from './dbt-artifact-bundle';
import { DBT_MANIFEST_JSON, DBT_RUN_RESULTS_JSON } from './artifact-filenames';

describe('isRemoteObjectNotFoundError', () => {
  it('detects S3 NoSuchKey', () => {
    expect(
      isRemoteObjectNotFoundError(Object.assign(new Error('x'), { name: 'NoSuchKey' }), 's3'),
    ).toBe(true);
  });

  it('detects S3 404 metadata', () => {
    expect(
      isRemoteObjectNotFoundError(
        Object.assign(new Error('x'), { name: 'NotFound', $metadata: { httpStatusCode: 404 } }),
        's3',
      ),
    ).toBe(true);
  });

  it('detects GCS numeric 404 code', () => {
    expect(
      isRemoteObjectNotFoundError(Object.assign(new Error('Not Found'), { code: 404 }), 'gcs'),
    ).toBe(true);
  });

  it('detects GCS string 404 code', () => {
    expect(
      isRemoteObjectNotFoundError(Object.assign(new Error('Not Found'), { code: '404' }), 'gcs'),
    ).toBe(true);
  });

  it('detects GCS API errors notFound reason', () => {
    expect(
      isRemoteObjectNotFoundError(
        Object.assign(new Error('No such object'), {
          errors: [{ reason: 'notFound' }],
        }),
        'gcs',
      ),
    ).toBe(true);
  });

  it('returns false for GCS 403', () => {
    expect(
      isRemoteObjectNotFoundError(Object.assign(new Error('Forbidden'), { code: 403 }), 'gcs'),
    ).toBe(false);
  });

  it('returns false for generic errors', () => {
    expect(isRemoteObjectNotFoundError(new Error('network'), 'gcs')).toBe(false);
  });
});

describe('parseDbtToolsArtifactTarget', () => {
  it('parses s3:// strictly', () => {
    expect(parseDbtToolsArtifactTarget('s3://b/prefix/run', '/tmp')).toMatchObject({
      kind: 'remote',
      provider: 's3',
      bucket: 'b',
      prefix: 'prefix/run',
    });
  });

  it('parses gs:// strictly', () => {
    expect(parseDbtToolsArtifactTarget('gs://b/pre', '/tmp')).toMatchObject({
      kind: 'remote',
      provider: 'gcs',
      bucket: 'b',
      prefix: 'pre',
    });
  });

  it('treats unschemed paths as local', () => {
    const r = parseDbtToolsArtifactTarget('my-bucket/pre', '/tmp/cwd');
    expect(r.kind).toBe('local');
    if (r.kind === 'local') {
      expect(r.resolvedPath).toContain('my-bucket');
    }
  });

  it('throws on empty target', () => {
    expect(() => parseDbtToolsArtifactTarget('  ', '/tmp')).toThrow(/required/i);
  });
});

describe('resolveDbtToolsArtifactBundlePaths (local)', () => {
  it('returns paths when manifest and run_results exist', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dbt-art-'));
    await fs.writeFile(path.join(dir, DBT_MANIFEST_JSON), '{}', 'utf8');
    await fs.writeFile(path.join(dir, DBT_RUN_RESULTS_JSON), '{}', 'utf8');

    const paths = await resolveDbtToolsArtifactBundlePaths({
      dbtTargetRaw: dir,
      cwd: '/tmp',
    });
    expect(paths.manifest).toBe(path.join(dir, DBT_MANIFEST_JSON));
    expect(paths.runResults).toBe(path.join(dir, DBT_RUN_RESULTS_JSON));
  });

  it('supports manifest-only requirements', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dbt-art-'));
    await fs.writeFile(path.join(dir, DBT_MANIFEST_JSON), '{}', 'utf8');

    const paths = await resolveDbtToolsArtifactBundlePaths({
      dbtTargetRaw: dir,
      cwd: '/tmp',
      requirements: { manifest: true, runResults: false },
    });
    expect(paths.manifest).toBe(path.join(dir, DBT_MANIFEST_JSON));
    expect(paths.runResults).toBe(path.join(dir, DBT_RUN_RESULTS_JSON));
  });

  it('supports run-results-only requirements', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dbt-art-'));
    await fs.writeFile(path.join(dir, DBT_RUN_RESULTS_JSON), '{}', 'utf8');

    const paths = await resolveDbtToolsArtifactBundlePaths({
      dbtTargetRaw: dir,
      cwd: '/tmp',
      requirements: { manifest: false, runResults: true },
    });
    expect(paths.manifest).toBe(path.join(dir, DBT_MANIFEST_JSON));
    expect(paths.runResults).toBe(path.join(dir, DBT_RUN_RESULTS_JSON));
  });

  it('throws ArtifactBundleResolutionError when manifest missing', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dbt-art-'));
    await fs.writeFile(path.join(dir, DBT_RUN_RESULTS_JSON), '{}', 'utf8');

    await expect(
      resolveDbtToolsArtifactBundlePaths({ dbtTargetRaw: dir, cwd: '/tmp' }),
    ).rejects.toThrow(ArtifactBundleResolutionError);
  });

  it('throws only for required files', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dbt-art-'));
    await fs.writeFile(path.join(dir, DBT_MANIFEST_JSON), '{}', 'utf8');

    await expect(
      resolveDbtToolsArtifactBundlePaths({
        dbtTargetRaw: dir,
        cwd: '/tmp',
        requirements: { manifest: false, runResults: true },
      }),
    ).rejects.toThrow(/run_results\.json/);
  });
});
