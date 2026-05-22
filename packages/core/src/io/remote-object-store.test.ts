import { describe, expect, it } from 'vitest';

import {
  assertRemoteObjectWithinByteLimit,
  DEFAULT_MAX_REMOTE_OBJECT_BYTES,
  remoteObjectStoreClientCacheKey,
} from './remote-object-store';

describe('remote-object-store', () => {
  describe('remoteObjectStoreClientCacheKey', () => {
    it('distinguishes provider for the same bucket and prefix', () => {
      const s3 = remoteObjectStoreClientCacheKey({
        provider: 's3',
        bucket: 'artifacts',
        prefix: 'runs/prod',
        pollIntervalMs: 0,
      });
      const gcs = remoteObjectStoreClientCacheKey({
        provider: 'gcs',
        bucket: 'artifacts',
        prefix: 'runs/prod',
        pollIntervalMs: 0,
      });
      expect(s3).not.toBe(gcs);
    });

    it('distinguishes S3 region and endpoint for the same bucket and prefix', () => {
      const west = remoteObjectStoreClientCacheKey({
        provider: 's3',
        bucket: 'artifacts',
        prefix: 'runs/prod',
        pollIntervalMs: 0,
        region: 'us-west-2',
      });
      const east = remoteObjectStoreClientCacheKey({
        provider: 's3',
        bucket: 'artifacts',
        prefix: 'runs/prod',
        pollIntervalMs: 0,
        region: 'us-east-1',
        endpoint: 'https://s3.example.com',
        forcePathStyle: true,
      });
      expect(west).not.toBe(east);
    });

    it('distinguishes GCS project and impersonation for the same bucket and prefix', () => {
      const defaultProject = remoteObjectStoreClientCacheKey({
        provider: 'gcs',
        bucket: 'artifacts',
        prefix: 'runs/prod',
        pollIntervalMs: 0,
      });
      const impersonated = remoteObjectStoreClientCacheKey({
        provider: 'gcs',
        bucket: 'artifacts',
        prefix: 'runs/prod',
        pollIntervalMs: 0,
        projectId: 'my-project',
        impersonatedServiceAccount: 'reader@my-project.iam.gserviceaccount.com',
      });
      expect(defaultProject).not.toBe(impersonated);
    });
  });

  describe('assertRemoteObjectWithinByteLimit', () => {
    it('allows objects at the limit', () => {
      const bytes = new Uint8Array(DEFAULT_MAX_REMOTE_OBJECT_BYTES);
      expect(() => assertRemoteObjectWithinByteLimit(bytes, 'manifest.json')).not.toThrow();
    });

    it('rejects objects over the limit', () => {
      const bytes = new Uint8Array(DEFAULT_MAX_REMOTE_OBJECT_BYTES + 1);
      expect(() => assertRemoteObjectWithinByteLimit(bytes, 'run_results.json')).toThrow(
        /Remote object "run_results.json"/,
      );
    });

    it('honors a custom max bytes', () => {
      const bytes = new Uint8Array(10);
      expect(() => assertRemoteObjectWithinByteLimit(bytes, 'x', 9)).toThrow(/limit 9/);
    });
  });
});
