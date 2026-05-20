import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ArtifactBundleResolutionError } from '../errors/artifact-bundle-resolution-error';

import { DBT_MANIFEST_JSON, DBT_RUN_RESULTS_JSON } from './artifact-filenames';
import {
  parseDbtToolsArtifactTarget,
  resolveDbtToolsArtifactBundlePaths,
} from './dbt-artifact-bundle';
import { mkdtempValidated, resolveJoinedSafe, writeValidatedUtf8 } from './safe-fs';

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
    const dir = await mkdtempValidated(path.join(os.tmpdir(), 'dbt-art-'));
    await writeValidatedUtf8(resolveJoinedSafe(dir, DBT_MANIFEST_JSON), '{}');
    await writeValidatedUtf8(resolveJoinedSafe(dir, DBT_RUN_RESULTS_JSON), '{}');

    const paths = await resolveDbtToolsArtifactBundlePaths({
      dbtTargetRaw: dir,
      cwd: '/tmp',
    });
    expect(paths.manifest).toBe(path.join(dir, DBT_MANIFEST_JSON));
    expect(paths.runResults).toBe(path.join(dir, DBT_RUN_RESULTS_JSON));
  });

  it('supports manifest-only requirements', async () => {
    const dir = await mkdtempValidated(path.join(os.tmpdir(), 'dbt-art-'));
    await writeValidatedUtf8(resolveJoinedSafe(dir, DBT_MANIFEST_JSON), '{}');

    const paths = await resolveDbtToolsArtifactBundlePaths({
      dbtTargetRaw: dir,
      cwd: '/tmp',
      requirements: { manifest: true, runResults: false },
    });
    expect(paths.manifest).toBe(path.join(dir, DBT_MANIFEST_JSON));
    expect(paths.runResults).toBe(path.join(dir, DBT_RUN_RESULTS_JSON));
  });

  it('supports run-results-only requirements', async () => {
    const dir = await mkdtempValidated(path.join(os.tmpdir(), 'dbt-art-'));
    await writeValidatedUtf8(resolveJoinedSafe(dir, DBT_RUN_RESULTS_JSON), '{}');

    const paths = await resolveDbtToolsArtifactBundlePaths({
      dbtTargetRaw: dir,
      cwd: '/tmp',
      requirements: { manifest: false, runResults: true },
    });
    expect(paths.manifest).toBe(path.join(dir, DBT_MANIFEST_JSON));
    expect(paths.runResults).toBe(path.join(dir, DBT_RUN_RESULTS_JSON));
  });

  it('throws ArtifactBundleResolutionError when manifest missing', async () => {
    const dir = await mkdtempValidated(path.join(os.tmpdir(), 'dbt-art-'));
    await writeValidatedUtf8(resolveJoinedSafe(dir, DBT_RUN_RESULTS_JSON), '{}');

    await expect(
      resolveDbtToolsArtifactBundlePaths({ dbtTargetRaw: dir, cwd: '/tmp' }),
    ).rejects.toThrow(ArtifactBundleResolutionError);
  });

  it('throws only for required files', async () => {
    const dir = await mkdtempValidated(path.join(os.tmpdir(), 'dbt-art-'));
    await writeValidatedUtf8(resolveJoinedSafe(dir, DBT_MANIFEST_JSON), '{}');

    await expect(
      resolveDbtToolsArtifactBundlePaths({
        dbtTargetRaw: dir,
        cwd: '/tmp',
        requirements: { manifest: false, runResults: true },
      }),
    ).rejects.toThrow(/run_results\.json/);
  });
});
