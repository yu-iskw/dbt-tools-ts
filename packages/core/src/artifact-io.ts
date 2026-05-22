/**
 * Node-only I/O: remote object stores (S3/GCS). Do not import from browser bundles.
 */
export type { RemoteObjectMetadata } from './io/artifact-discovery';
export {
  assertRemoteObjectWithinByteLimit,
  createRemoteObjectStoreClient,
  DEFAULT_MAX_REMOTE_OBJECT_BYTES,
  remoteObjectStoreClientCacheKey,
  type RemoteObjectStoreClient,
} from './io/remote-object-store';
