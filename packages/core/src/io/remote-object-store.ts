import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { Storage } from '@google-cloud/storage';
import { GoogleAuth, Impersonated } from 'google-auth-library';

import {
  dbtToolsDebugLog,
  dbtToolsDebugLogPhase,
  dbtToolsDebugNow,
} from '../debug/dbt-tools-debug-log.js';

import type { RemoteObjectMetadata } from './artifact-discovery';
import type { DbtToolsRemoteSourceConfig } from '../config/dbt-tools-env';

/** Default max bytes per remote object read (64 MiB). */
export const DEFAULT_MAX_REMOTE_OBJECT_BYTES = 64 * 1024 * 1024;

/** Cache key for reusing SDK clients; must include provider to avoid s3/gcs collisions. */
export function remoteObjectStoreClientCacheKey(
  provider: 'gcs' | 's3',
  bucket: string,
  prefix: string,
): string {
  return `${provider}\0${bucket}\0${prefix}`;
}

export function assertRemoteObjectWithinByteLimit(
  bytes: Uint8Array,
  key: string,
  maxBytes: number = DEFAULT_MAX_REMOTE_OBJECT_BYTES,
): void {
  if (bytes.byteLength > maxBytes) {
    throw new Error(
      `Remote object "${key}" is ${bytes.byteLength} bytes (limit ${maxBytes}). ` +
        'Use a narrower artifact prefix or a smaller run.',
    );
  }
}

export interface RemoteObjectStoreClient {
  listObjects(bucket: string, prefix: string): Promise<RemoteObjectMetadata[]>;
  readObjectBytes(bucket: string, key: string): Promise<Uint8Array>;
}

class S3RemoteObjectStoreClient implements RemoteObjectStoreClient {
  private readonly client: S3Client;

  constructor(config: DbtToolsRemoteSourceConfig) {
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
    });
  }

  async listObjects(bucket: string, prefix: string): Promise<RemoteObjectMetadata[]> {
    const startedAt = dbtToolsDebugNow();
    dbtToolsDebugLog(`S3 listObjects start bucket=${bucket} prefix=${prefix || '(root)'}`);
    const results: RemoteObjectMetadata[] = [];
    let continuationToken: string | undefined;

    do {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix === '' ? undefined : `${prefix}/`,
          ContinuationToken: continuationToken,
        }),
      );

      for (const object of response.Contents ?? []) {
        if (!object.Key || !object.LastModified) continue;
        results.push({
          key: object.Key,
          updatedAtMs: object.LastModified.getTime(),
          etag: object.ETag ?? undefined,
        });
      }

      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);

    dbtToolsDebugLogPhase('S3 listObjects done', startedAt, `objects=${results.length}`);
    return results;
  }

  async readObjectBytes(bucket: string, key: string): Promise<Uint8Array> {
    const startedAt = dbtToolsDebugNow();
    dbtToolsDebugLog(`S3 readObject start bucket=${bucket} key=${key}`);
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    const bytes = await response.Body?.transformToByteArray();
    if (bytes == null) throw new Error(`Missing S3 object body for ${key}`);
    assertRemoteObjectWithinByteLimit(bytes, key);
    dbtToolsDebugLogPhase('S3 readObject done', startedAt, `bytes=${bytes.byteLength}`);
    return bytes;
  }
}

class GcsRemoteObjectStoreClient implements RemoteObjectStoreClient {
  constructor(private readonly storage: Storage) {}

  async listObjects(bucket: string, prefix: string): Promise<RemoteObjectMetadata[]> {
    const startedAt = dbtToolsDebugNow();
    dbtToolsDebugLog(`GCS listObjects start bucket=${bucket} prefix=${prefix || '(root)'}`);
    const [files] = await this.storage.bucket(bucket).getFiles({
      prefix: prefix === '' ? undefined : `${prefix}/`,
      autoPaginate: true,
    });

    const results = files.flatMap((file) => {
      const updated = file.metadata.updated;
      if (!updated) return [];
      return [
        {
          key: file.name,
          updatedAtMs: new Date(updated).getTime(),
          etag: file.metadata.etag,
          generation:
            file.metadata.generation == null ? undefined : String(file.metadata.generation),
        },
      ];
    });
    dbtToolsDebugLogPhase('GCS listObjects done', startedAt, `objects=${results.length}`);
    return results;
  }

  async readObjectBytes(bucket: string, key: string): Promise<Uint8Array> {
    const startedAt = dbtToolsDebugNow();
    dbtToolsDebugLog(`GCS readObject start bucket=${bucket} key=${key}`);
    const [bytes] = await this.storage.bucket(bucket).file(key).download();
    assertRemoteObjectWithinByteLimit(bytes, key);
    dbtToolsDebugLogPhase('GCS readObject done', startedAt, `bytes=${bytes.byteLength}`);
    return bytes;
  }
}

async function createGcsStorage(config: DbtToolsRemoteSourceConfig): Promise<Storage> {
  const startedAt = dbtToolsDebugNow();
  const targetPrincipal = config.impersonatedServiceAccount?.trim();
  if (targetPrincipal == null || targetPrincipal === '') {
    dbtToolsDebugLog(`GCS client create projectId=${config.projectId ?? '(default)'}`);
    const storage = new Storage({
      projectId: config.projectId,
    });
    dbtToolsDebugLogPhase('GCS client ready', startedAt);
    return storage;
  }

  dbtToolsDebugLog(`GCS impersonation start principal=${targetPrincipal}`);
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const sourceClient = await auth.getClient();
  const impersonatedClient = new Impersonated({
    sourceClient,
    targetPrincipal,
    delegates: [],
    targetScopes: ['https://www.googleapis.com/auth/devstorage.read_only'],
  });
  const storage = new Storage({
    projectId: config.projectId,
    authClient: impersonatedClient,
  });
  dbtToolsDebugLogPhase('GCS client ready (impersonated)', startedAt);
  return storage;
}

export async function createRemoteObjectStoreClient(
  config: DbtToolsRemoteSourceConfig,
): Promise<RemoteObjectStoreClient> {
  const startedAt = dbtToolsDebugNow();
  dbtToolsDebugLog(`remote client create provider=${config.provider} bucket=${config.bucket}`);
  if (config.provider === 's3') {
    const client = new S3RemoteObjectStoreClient(config);
    dbtToolsDebugLogPhase('remote client ready', startedAt, 'provider=s3');
    return client;
  }
  const storage = await createGcsStorage(config);
  dbtToolsDebugLogPhase('remote client ready', startedAt, 'provider=gcs');
  return new GcsRemoteObjectStoreClient(storage);
}
