/**
 * Node-only I/O: remote object stores (S3/GCS). Do not import from browser bundles.
 */
export type { RemoteObjectMetadata } from './io/artifact-discovery';
export {
  createRemoteObjectStoreClient,
  type RemoteObjectStoreClient,
} from './io/remote-object-store';
