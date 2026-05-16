import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { Storage } from '@google-cloud/storage';
import type { DbtToolsRemoteSourceConfig } from '../config/dbt-tools-env';
import type { RemoteObjectMetadata } from './artifact-discovery';

export interface RemoteObjectStoreClient {
  listObjects(bucket: string, prefix: string): Promise<RemoteObjectMetadata[]>;
  readObjectBytes(bucket: string, key: string): Promise<Uint8Array>;
}

export interface GcsRemoteObjectStoreOptions {
  impersonatedServiceAccount?: string;
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

    return results;
  }

  async readObjectBytes(bucket: string, key: string): Promise<Uint8Array> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    const bytes = await response.Body?.transformToByteArray();
    if (bytes == null) throw new Error(`Missing S3 object body for ${key}`);
    return bytes;
  }
}

class GcsRemoteObjectStoreClient implements RemoteObjectStoreClient {
  private readonly storage: Storage;

  constructor(config: DbtToolsRemoteSourceConfig, options?: GcsRemoteObjectStoreOptions) {
    this.storage = new Storage({
      projectId: config.projectId,
      ...(options?.impersonatedServiceAccount
        ? { impersonatedServiceAccount: options.impersonatedServiceAccount }
        : {}),
    });
  }

  async listObjects(bucket: string, prefix: string): Promise<RemoteObjectMetadata[]> {
    const [files] = await this.storage.bucket(bucket).getFiles({
      prefix: prefix === '' ? undefined : `${prefix}/`,
      autoPaginate: true,
    });

    return files.flatMap((file) => {
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
  }

  async readObjectBytes(bucket: string, key: string): Promise<Uint8Array> {
    const [bytes] = await this.storage.bucket(bucket).file(key).download();
    return bytes;
  }
}

export function createRemoteObjectStoreClient(
  config: DbtToolsRemoteSourceConfig,
  gcsOptions?: GcsRemoteObjectStoreOptions,
): RemoteObjectStoreClient {
  return config.provider === 's3'
    ? new S3RemoteObjectStoreClient(config)
    : new GcsRemoteObjectStoreClient(config, gcsOptions);
}
