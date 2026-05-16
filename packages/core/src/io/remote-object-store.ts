import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { Storage } from '@google-cloud/storage';
import { GoogleAuth, Impersonated } from 'google-auth-library';
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
  private readonly projectId: string | undefined;
  private readonly impersonatedServiceAccount: string | undefined;
  private storagePromise: Promise<Storage> | null = null;

  constructor(config: DbtToolsRemoteSourceConfig, options?: GcsRemoteObjectStoreOptions) {
    this.projectId = config.projectId;
    this.impersonatedServiceAccount = options?.impersonatedServiceAccount;
  }

  private getStorage(): Promise<Storage> {
    if (this.storagePromise == null) {
      this.storagePromise = this.initStorage();
    }
    return this.storagePromise;
  }

  private async initStorage(): Promise<Storage> {
    if (this.impersonatedServiceAccount != null) {
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const sourceClient = await auth.getClient();
      const impersonated = new Impersonated({
        sourceClient,
        targetPrincipal: this.impersonatedServiceAccount,
        targetScopes: ['https://www.googleapis.com/auth/cloud-platform'],
        lifetime: 3600,
      });
      // Use Impersonated only to call IAM generateAccessToken — not as authClient
      // (Impersonated is not supported with REST-based clients like @google-cloud/storage)
      const tokenResponse = await impersonated.getAccessToken();
      if (!tokenResponse.token) {
        throw new Error('Failed to obtain impersonated access token for GCS');
      }
      return new Storage({ projectId: this.projectId, token: tokenResponse.token });
    }
    return new Storage({ projectId: this.projectId });
  }

  async listObjects(bucket: string, prefix: string): Promise<RemoteObjectMetadata[]> {
    const storage = await this.getStorage();
    const [files] = await storage.bucket(bucket).getFiles({
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
    const storage = await this.getStorage();
    const [bytes] = await storage.bucket(bucket).file(key).download();
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
