import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { Storage } from '@google-cloud/storage';
import { GoogleAuth, Impersonated } from 'google-auth-library';
import { Readable } from 'node:stream';
import {
  getDbtToolsMaxRemoteListingObjectsFromEnv,
  getDbtToolsMaxRemoteObjectBytesFromEnv,
  type DbtToolsRemoteSourceConfig,
} from '../config/dbt-tools-env';
import type { RemoteObjectMetadata } from './artifact-discovery';
import { readStreamWithByteCap } from './read-bytes-capped';

/** @internal Exported for unit tests (size guard on full buffer). */
export function assertRemoteObjectBytesWithinLimit(
  bytes: Uint8Array,
  maxBytes: number,
  key: string,
): void {
  if (bytes.byteLength > maxBytes) {
    throw new Error(`Remote object exceeds configured maximum size (${maxBytes} bytes): ${key}`);
  }
}

function listingExceededMessage(max: number, label: string): string {
  return `Remote listing exceeds configured maximum object count (${max}): ${label}`;
}

export interface RemoteObjectStoreClient {
  listObjects(bucket: string, prefix: string): Promise<RemoteObjectMetadata[]>;
  readObjectBytes(bucket: string, key: string): Promise<Uint8Array>;
}

class S3RemoteObjectStoreClient implements RemoteObjectStoreClient {
  private readonly client: S3Client;
  private readonly maxObjectBytes: number;
  private readonly maxListingObjects: number;

  constructor(
    config: DbtToolsRemoteSourceConfig,
    maxObjectBytes: number,
    maxListingObjects: number,
  ) {
    this.maxObjectBytes = maxObjectBytes;
    this.maxListingObjects = maxListingObjects;
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
    });
  }

  async listObjects(bucket: string, prefix: string): Promise<RemoteObjectMetadata[]> {
    const results: RemoteObjectMetadata[] = [];
    let continuationToken: string | undefined;
    const label = `s3://${bucket}/${prefix}`;

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
        if (results.length > this.maxListingObjects) {
          throw new Error(listingExceededMessage(this.maxListingObjects, label));
        }
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

    const body = response.Body;
    if (body == null) throw new Error(`Missing S3 object body for ${key}`);

    const label = `s3://${bucket}/${key}`;
    const streamBody = body as AsyncIterable<Uint8Array | Buffer> & {
      transformToWebStream?: () => ReadableStream<Uint8Array>;
      transformToByteArray?: () => Promise<Uint8Array>;
    };

    if (typeof streamBody[Symbol.asyncIterator] === 'function') {
      return readStreamWithByteCap(streamBody, this.maxObjectBytes, label);
    }

    if (typeof streamBody.transformToWebStream === 'function') {
      const web = streamBody.transformToWebStream();
      const nodeReadable = Readable.fromWeb(web, { highWaterMark: 64 * 1024 });
      try {
        return await readStreamWithByteCap(nodeReadable, this.maxObjectBytes, label);
      } finally {
        nodeReadable.destroy();
      }
    }

    if (typeof streamBody.transformToByteArray === 'function') {
      const bytes = await streamBody.transformToByteArray();
      if (bytes == null) throw new Error(`Missing S3 object body for ${key}`);
      assertRemoteObjectBytesWithinLimit(bytes, this.maxObjectBytes, label);
      return bytes;
    }

    throw new Error(`Unsupported S3 GetObject body stream for ${key}`);
  }
}

class GcsRemoteObjectStoreClient implements RemoteObjectStoreClient {
  private readonly config: DbtToolsRemoteSourceConfig;
  private readonly maxObjectBytes: number;
  private readonly maxListingObjects: number;
  private storagePromise: Promise<Storage> | undefined;

  constructor(
    config: DbtToolsRemoteSourceConfig,
    maxObjectBytes: number,
    maxListingObjects: number,
  ) {
    this.config = config;
    this.maxObjectBytes = maxObjectBytes;
    this.maxListingObjects = maxListingObjects;
  }

  private async getStorage(): Promise<Storage> {
    if (this.storagePromise === undefined) {
      this.storagePromise = this.createStorage();
    }
    return this.storagePromise;
  }

  private async createStorage(): Promise<Storage> {
    const { projectId } = this.config;
    if (
      this.config.impersonateServiceAccount == null ||
      this.config.impersonateServiceAccount === ''
    ) {
      return new Storage({ projectId });
    }

    const auth = new GoogleAuth({ projectId });
    const sourceClient = await auth.getClient();
    const authClient = new Impersonated({
      sourceClient,
      targetPrincipal: this.config.impersonateServiceAccount,
      delegates: [],
      targetScopes: ['https://www.googleapis.com/auth/devstorage.read_only'],
    });
    return new Storage({ projectId, authClient });
  }

  async listObjects(bucket: string, prefix: string): Promise<RemoteObjectMetadata[]> {
    const storage = await this.getStorage();
    const results: RemoteObjectMetadata[] = [];
    const label = `gs://${bucket}/${prefix}`;
    const prefixOpt = prefix === '' ? undefined : `${prefix}/`;

    let query: Record<string, unknown> = {
      prefix: prefixOpt,
      autoPaginate: false,
      maxResults: 1000,
    };

    while (true) {
      const [files, nextQuery] = await storage.bucket(bucket).getFiles(query);
      for (const file of files) {
        const updated = file.metadata.updated;
        if (!updated) continue;
        results.push({
          key: file.name,
          updatedAtMs: new Date(updated).getTime(),
          etag: file.metadata.etag,
          generation:
            file.metadata.generation == null ? undefined : String(file.metadata.generation),
        });
        if (results.length > this.maxListingObjects) {
          throw new Error(listingExceededMessage(this.maxListingObjects, label));
        }
      }
      if (nextQuery == null) break;
      query = { ...nextQuery, autoPaginate: false };
    }

    return results;
  }

  async readObjectBytes(bucket: string, key: string): Promise<Uint8Array> {
    const storage = await this.getStorage();
    const stream = storage.bucket(bucket).file(key).createReadStream();
    const label = `gs://${bucket}/${key}`;
    return readStreamWithByteCap(stream, this.maxObjectBytes, label);
  }
}

export function createRemoteObjectStoreClient(
  config: DbtToolsRemoteSourceConfig,
): RemoteObjectStoreClient {
  const maxObjectBytes = getDbtToolsMaxRemoteObjectBytesFromEnv();
  const maxListingObjects = getDbtToolsMaxRemoteListingObjectsFromEnv();
  return config.provider === 's3'
    ? new S3RemoteObjectStoreClient(config, maxObjectBytes, maxListingObjects)
    : new GcsRemoteObjectStoreClient(config, maxObjectBytes, maxListingObjects);
}
