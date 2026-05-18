import { describe, expect, it } from 'vitest';
import {
  discoverLatestArtifactRuns,
  toRemoteArtifactRun,
  type RemoteObjectMetadata,
} from './discovery';

describe('discoverLatestArtifactRuns', () => {
  it('returns a complete run at the prefix root', () => {
    const objects: RemoteObjectMetadata[] = [
      {
        key: 'prod/runs/2026-03-29T13-00-00Z/manifest.json',
        updatedAtMs: 200,
        etag: 'm2',
      },
      {
        key: 'prod/runs/2026-03-29T13-00-00Z/run_results.json',
        updatedAtMs: 205,
        etag: 'r2',
      },
    ];

    expect(discoverLatestArtifactRuns(objects, 'prod/runs/2026-03-29T13-00-00Z')).toMatchObject([
      {
        runId: 'current',
        manifestKey: 'prod/runs/2026-03-29T13-00-00Z/manifest.json',
        runResultsKey: 'prod/runs/2026-03-29T13-00-00Z/run_results.json',
      },
    ]);
  });

  it('ignores artifact files in subdirectories under the prefix', () => {
    const objects: RemoteObjectMetadata[] = [
      {
        key: 'prod/runs/2026-03-29T12-00-00Z/manifest.json',
        updatedAtMs: 100,
      },
      {
        key: 'prod/runs/2026-03-29T12-00-00Z/run_results.json',
        updatedAtMs: 101,
      },
    ];

    expect(discoverLatestArtifactRuns(objects, 'prod/runs')).toEqual([]);
  });

  it('supports a direct prefix pair as the current run', () => {
    const objects: RemoteObjectMetadata[] = [
      {
        key: 'prod/runs/manifest.json',
        updatedAtMs: 100,
      },
      {
        key: 'prod/runs/run_results.json',
        updatedAtMs: 120,
      },
    ];

    const [run] = discoverLatestArtifactRuns(objects, 'prod/runs');
    expect(run?.runId).toBe('current');
    expect(toRemoteArtifactRun('gcs', run!)).toMatchObject({
      runId: 'current',
      label: 'GCS current',
    });
  });

  it('rejects partial uploads at the prefix root', () => {
    const objects: RemoteObjectMetadata[] = [
      {
        key: 'prod/runs/manifest.json',
        updatedAtMs: 100,
      },
    ];

    expect(discoverLatestArtifactRuns(objects, 'prod/runs')).toEqual([]);
  });

  it('includes optional artifact metadata in the version token', () => {
    const baseObjects: RemoteObjectMetadata[] = [
      {
        key: 'prod/runs/manifest.json',
        updatedAtMs: 100,
        etag: 'm1',
      },
      {
        key: 'prod/runs/run_results.json',
        updatedAtMs: 110,
        etag: 'r1',
      },
    ];
    const withCatalog = discoverLatestArtifactRuns(
      [
        ...baseObjects,
        {
          key: 'prod/runs/catalog.json',
          updatedAtMs: 120,
          etag: 'c1',
        },
      ],
      'prod/runs',
    )[0];
    const withUpdatedCatalog = discoverLatestArtifactRuns(
      [
        ...baseObjects,
        {
          key: 'prod/runs/catalog.json',
          updatedAtMs: 121,
          etag: 'c2',
        },
      ],
      'prod/runs',
    )[0];

    expect(withCatalog?.versionToken).toContain('catalog.json');
    expect(withUpdatedCatalog?.versionToken).not.toBe(withCatalog?.versionToken);
  });
});
