import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtifactBundleResolutionError } from '../errors/artifact-bundle-resolution-error';
import { DBT_CATALOG_JSON, DBT_MANIFEST_JSON, DBT_RUN_RESULTS_JSON } from './artifact-filenames';
import { resolveDbtToolsArtifactBundlePaths } from './dbt-artifact-bundle';

const jsonBytes = new Uint8Array([123, 125]); // {}

const { mockReadObjectBytes } = vi.hoisted(() => ({
  mockReadObjectBytes: vi.fn(),
}));

vi.mock('./remote-object-store', () => ({
  createRemoteObjectStoreClient: vi.fn(() => ({
    readObjectBytes: mockReadObjectBytes,
    listObjects: vi.fn(async () => []),
  })),
}));

describe('resolveDbtToolsArtifactBundlePaths (remote read errors)', () => {
  beforeEach(() => {
    mockReadObjectBytes.mockReset();
  });

  it('throws ArtifactBundleResolutionError when required object is not found (GCS 404)', async () => {
    mockReadObjectBytes.mockImplementation(async (_bucket: string, key: string) => {
      if (key.endsWith(DBT_MANIFEST_JSON)) {
        throw Object.assign(new Error('No such object'), { code: 404 });
      }
      if (key.endsWith(DBT_RUN_RESULTS_JSON)) return jsonBytes;
      return jsonBytes;
    });

    try {
      await resolveDbtToolsArtifactBundlePaths({
        dbtTargetRaw: 'gs://my-bucket/prefix',
        cwd: '/tmp',
      });
      expect.fail('expected rejection');
    } catch (err) {
      expect(err).toBeInstanceOf(ArtifactBundleResolutionError);
      expect(String(err)).toMatch(/manifest\.json/);
    }
  });

  it('throws wrapped error when required read fails with permission (not 404)', async () => {
    mockReadObjectBytes.mockImplementation(async (_bucket: string, key: string) => {
      if (key.endsWith(DBT_MANIFEST_JSON)) {
        throw Object.assign(new Error('Permission denied'), { code: 403 });
      }
      return jsonBytes;
    });

    await expect(
      resolveDbtToolsArtifactBundlePaths({
        dbtTargetRaw: 'gs://my-bucket/prefix',
        cwd: '/tmp',
      }),
    ).rejects.toThrow(/Failed to read gs:\/\/my-bucket\/prefix\/manifest\.json: Permission denied/);
  });

  it('decodes HTML entities, adds VPC-SC hint, and sets RemoteArtifactReadError', async () => {
    mockReadObjectBytes.mockImplementation(async (_bucket: string, key: string) => {
      if (key.endsWith(DBT_MANIFEST_JSON)) {
        throw new Error(
          'Request is prohibited by organization&#39;s policy. vpcServiceControlsUniqueIdentifier: abc',
        );
      }
      return jsonBytes;
    });

    try {
      await resolveDbtToolsArtifactBundlePaths({
        dbtTargetRaw: 'gs://my-bucket/prefix',
        cwd: '/tmp',
      });
      expect.fail('expected rejection');
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).name).toBe('RemoteArtifactReadError');
      expect(String(err)).toContain("organization's policy");
      expect(String(err)).toContain('VPC Service Controls');
    }
  });

  it('ignores optional catalog read failure (non-404)', async () => {
    mockReadObjectBytes.mockImplementation(async (_bucket: string, key: string) => {
      if (key.endsWith(DBT_CATALOG_JSON)) {
        throw Object.assign(new Error('Forbidden'), { code: 403 });
      }
      return jsonBytes;
    });

    const paths = await resolveDbtToolsArtifactBundlePaths({
      dbtTargetRaw: 'gs://my-bucket/prefix',
      cwd: '/tmp',
    });
    expect(paths.manifest).toMatch(/manifest\.json$/);
    expect(paths.runResults).toMatch(/run_results\.json$/);
    expect(paths.catalog).toBeUndefined();
  });

  it('throws ArtifactBundleResolutionError when run_results is missing (S3 NoSuchKey)', async () => {
    mockReadObjectBytes.mockImplementation(async (_bucket: string, key: string) => {
      if (key.endsWith(DBT_RUN_RESULTS_JSON)) {
        throw Object.assign(new Error('The specified key does not exist.'), { name: 'NoSuchKey' });
      }
      return jsonBytes;
    });

    try {
      await resolveDbtToolsArtifactBundlePaths({
        dbtTargetRaw: 's3://my-bucket/prefix',
        cwd: '/tmp',
      });
      expect.fail('expected rejection');
    } catch (err) {
      expect(err).toBeInstanceOf(ArtifactBundleResolutionError);
      expect(String(err)).toMatch(/run_results\.json/);
    }
  });

  it('throws wrapped error for S3 access denied on manifest', async () => {
    mockReadObjectBytes.mockImplementation(async (_bucket: string, key: string) => {
      if (key.endsWith(DBT_MANIFEST_JSON)) {
        throw Object.assign(new Error('Access Denied'), {
          name: 'AccessDenied',
          $metadata: { httpStatusCode: 403 },
        });
      }
      return jsonBytes;
    });

    await expect(
      resolveDbtToolsArtifactBundlePaths({
        dbtTargetRaw: 's3://my-bucket/prefix',
        cwd: '/tmp',
      }),
    ).rejects.toThrow(/Failed to read s3:\/\/my-bucket\/prefix\/manifest\.json/);
  });
});
