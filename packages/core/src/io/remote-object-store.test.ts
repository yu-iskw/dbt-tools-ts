import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGcsGetFiles, mockS3Send } = vi.hoisted(() => ({
  mockGcsGetFiles: vi.fn(),
  mockS3Send: vi.fn(),
}));

vi.mock('@aws-sdk/client-s3', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    S3Client: vi.fn(function S3Client(this: { send: typeof mockS3Send }) {
      this.send = mockS3Send;
    }),
  };
});

vi.mock('@google-cloud/storage', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    Storage: vi.fn(function Storage() {
      return {
        bucket: () => ({
          getFiles: mockGcsGetFiles,
          file: () => ({
            createReadStream: () => {
              throw new Error('GCS read not mocked in this test file');
            },
          }),
        }),
      };
    }),
  };
});

import {
  assertRemoteObjectBytesWithinLimit,
  createRemoteObjectStoreClient,
} from './remote-object-store';

function gcsFileStub(name: string) {
  return {
    name,
    metadata: {
      updated: '2020-01-01T00:00:00Z',
      etag: 'e1',
      generation: '1',
    },
  };
}

describe('createRemoteObjectStoreClient', () => {
  beforeEach(() => {
    mockS3Send.mockReset();
    mockGcsGetFiles.mockReset();
  });

  it('constructs an S3-backed client', () => {
    const client = createRemoteObjectStoreClient({
      provider: 's3',
      bucket: 'b',
      prefix: 'p',
      pollIntervalMs: 30_000,
      region: 'us-east-1',
    });
    expect(client).toBeDefined();
  });

  it('constructs a GCS-backed client without impersonation', () => {
    const client = createRemoteObjectStoreClient({
      provider: 'gcs',
      bucket: 'b',
      prefix: 'p',
      pollIntervalMs: 30_000,
      projectId: 'test-project',
    });
    expect(client).toBeDefined();
  });
});

describe('S3RemoteObjectStoreClient via mocked S3Client', () => {
  const prevListing = process.env.DBT_TOOLS_MAX_REMOTE_LISTING_OBJECTS;
  const prevBytes = process.env.DBT_TOOLS_MAX_REMOTE_OBJECT_BYTES;

  beforeEach(() => {
    mockS3Send.mockReset();
    delete process.env.DBT_TOOLS_MAX_REMOTE_LISTING_OBJECTS;
    delete process.env.DBT_TOOLS_MAX_REMOTE_OBJECT_BYTES;
  });

  afterEach(() => {
    if (prevListing === undefined) delete process.env.DBT_TOOLS_MAX_REMOTE_LISTING_OBJECTS;
    else process.env.DBT_TOOLS_MAX_REMOTE_LISTING_OBJECTS = prevListing;
    if (prevBytes === undefined) delete process.env.DBT_TOOLS_MAX_REMOTE_OBJECT_BYTES;
    else process.env.DBT_TOOLS_MAX_REMOTE_OBJECT_BYTES = prevBytes;
  });

  it('throws when listing exceeds DBT_TOOLS_MAX_REMOTE_LISTING_OBJECTS', async () => {
    process.env.DBT_TOOLS_MAX_REMOTE_LISTING_OBJECTS = '2';
    mockS3Send.mockResolvedValueOnce({
      Contents: [
        { Key: 'p/a.json', LastModified: new Date('2020-01-01') },
        { Key: 'p/b.json', LastModified: new Date('2020-01-02') },
        { Key: 'p/c.json', LastModified: new Date('2020-01-03') },
      ],
      IsTruncated: false,
    });
    const client = createRemoteObjectStoreClient({
      provider: 's3',
      bucket: 'bucket',
      prefix: 'p',
      pollIntervalMs: 30_000,
      region: 'us-east-1',
    });
    await expect(client.listObjects('bucket', 'p')).rejects.toThrow(
      /Remote listing exceeds configured maximum object count \(2\): s3:\/\/bucket\/p/,
    );
  });

  it('reads GetObject via transformToWebStream with byte cap', async () => {
    process.env.DBT_TOOLS_MAX_REMOTE_OBJECT_BYTES = '5';
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.enqueue(new Uint8Array([4, 5, 6]));
        controller.close();
      },
    });
    mockS3Send.mockResolvedValueOnce({
      Body: {
        transformToWebStream: () => stream,
      },
    });
    const client = createRemoteObjectStoreClient({
      provider: 's3',
      bucket: 'bucket',
      prefix: 'p',
      pollIntervalMs: 30_000,
      region: 'us-east-1',
    });
    await expect(client.readObjectBytes('bucket', 'key')).rejects.toThrow(
      /Object exceeds configured maximum size \(5 bytes\): s3:\/\/bucket\/key/,
    );
  });

  it('uses transformToByteArray when stream APIs are absent', async () => {
    process.env.DBT_TOOLS_MAX_REMOTE_OBJECT_BYTES = '9';
    mockS3Send.mockResolvedValueOnce({
      Body: {
        transformToByteArray: async () => new Uint8Array(10),
      },
    });
    const client = createRemoteObjectStoreClient({
      provider: 's3',
      bucket: 'bucket',
      prefix: 'p',
      pollIntervalMs: 30_000,
      region: 'us-east-1',
    });
    await expect(client.readObjectBytes('bucket', 'key')).rejects.toThrow(
      /Remote object exceeds configured maximum size \(9 bytes\): s3:\/\/bucket\/key/,
    );
  });
});

describe('GcsRemoteObjectStoreClient via mocked Storage', () => {
  const prevListing = process.env.DBT_TOOLS_MAX_REMOTE_LISTING_OBJECTS;

  beforeEach(() => {
    mockGcsGetFiles.mockReset();
    delete process.env.DBT_TOOLS_MAX_REMOTE_LISTING_OBJECTS;
  });

  afterEach(() => {
    if (prevListing === undefined) delete process.env.DBT_TOOLS_MAX_REMOTE_LISTING_OBJECTS;
    else process.env.DBT_TOOLS_MAX_REMOTE_LISTING_OBJECTS = prevListing;
  });

  it('throws when listing exceeds DBT_TOOLS_MAX_REMOTE_LISTING_OBJECTS', async () => {
    process.env.DBT_TOOLS_MAX_REMOTE_LISTING_OBJECTS = '2';
    mockGcsGetFiles.mockResolvedValueOnce([
      [gcsFileStub('p/a.json'), gcsFileStub('p/b.json'), gcsFileStub('p/c.json')],
      null,
    ]);
    const client = createRemoteObjectStoreClient({
      provider: 'gcs',
      bucket: 'bucket',
      prefix: 'p',
      pollIntervalMs: 30_000,
      projectId: 'test-project',
    });
    await expect(client.listObjects('bucket', 'p')).rejects.toThrow(
      /Remote listing exceeds configured maximum object count \(2\): gs:\/\/bucket\/p/,
    );
  });

  it('throws when listing exceeds cap across paginated getFiles responses', async () => {
    process.env.DBT_TOOLS_MAX_REMOTE_LISTING_OBJECTS = '2';
    mockGcsGetFiles
      .mockResolvedValueOnce([
        [gcsFileStub('p/a.json'), gcsFileStub('p/b.json')],
        { pageToken: 'next', autoPaginate: false },
      ])
      .mockResolvedValueOnce([[gcsFileStub('p/c.json')], null]);
    const client = createRemoteObjectStoreClient({
      provider: 'gcs',
      bucket: 'bucket',
      prefix: 'p',
      pollIntervalMs: 30_000,
      projectId: 'test-project',
    });
    await expect(client.listObjects('bucket', 'p')).rejects.toThrow(
      /Remote listing exceeds configured maximum object count \(2\): gs:\/\/bucket\/p/,
    );
    expect(mockGcsGetFiles).toHaveBeenCalledTimes(2);
  });
});

describe('assertRemoteObjectBytesWithinLimit', () => {
  it('throws when byte length exceeds the limit', () => {
    const bytes = new Uint8Array(10);
    expect(() => assertRemoteObjectBytesWithinLimit(bytes, 9, 'k')).toThrow(
      /exceeds configured maximum size \(9 bytes\): k/,
    );
  });

  it('allows objects at the limit', () => {
    const bytes = new Uint8Array(10);
    expect(() => assertRemoteObjectBytesWithinLimit(bytes, 10, 'k')).not.toThrow();
  });
});
