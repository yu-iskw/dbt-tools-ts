import { describe, expect, it } from 'vitest';

import {
  assertRemoteObjectWithinByteLimit,
  DEFAULT_MAX_REMOTE_OBJECT_BYTES,
  remoteObjectStoreClientCacheKey,
} from './remote-object-store';

describe('remote-object-store', () => {
  describe('remoteObjectStoreClientCacheKey', () => {
    it('distinguishes provider for the same bucket and prefix', () => {
      const s3 = remoteObjectStoreClientCacheKey('s3', 'artifacts', 'runs/prod');
      const gcs = remoteObjectStoreClientCacheKey('gcs', 'artifacts', 'runs/prod');
      expect(s3).not.toBe(gcs);
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
