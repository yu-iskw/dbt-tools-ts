import { describe, expect, it } from 'vitest';
import { artifactLocationSnapshotFromStatus, userArtifactSourceKindLabel } from './artifactSource';

describe('artifactLocationSnapshotFromStatus', () => {
  it('returns null when both fields are empty', () => {
    expect(
      artifactLocationSnapshotFromStatus({
        sourceKind: null,
        locationDisplay: null,
      }),
    ).toBeNull();
  });

  it('returns snapshot when only location is set', () => {
    expect(
      artifactLocationSnapshotFromStatus({
        sourceKind: null,
        locationDisplay: '/abs/path',
      }),
    ).toEqual({
      sourceKind: null,
      locationDisplay: '/abs/path',
    });
  });
});

describe('userArtifactSourceKindLabel', () => {
  it('maps known kinds', () => {
    expect(userArtifactSourceKindLabel('local')).toBe('Local directory');
    expect(userArtifactSourceKindLabel('s3')).toBe('Amazon S3');
    expect(userArtifactSourceKindLabel('gcs')).toBe('Google Cloud Storage');
    expect(userArtifactSourceKindLabel(null)).toBeNull();
  });
});
