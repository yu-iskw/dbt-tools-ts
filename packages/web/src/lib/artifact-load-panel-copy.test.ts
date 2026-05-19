import { describe, expect, it } from 'vitest';

import {
  artifactLocationHelper,
  artifactLocationPlaceholder,
  getArtifactLoadWorkspaceHint,
  getArtifactReadinessLabel,
} from './artifact-load-panel-copy';

describe('artifactLocationPlaceholder', () => {
  it('returns kind-specific placeholders', () => {
    expect(artifactLocationPlaceholder('local')).toMatch(/path\/to\/target/);
    expect(artifactLocationPlaceholder('s3')).toMatch(/s3:\/\//);
    expect(artifactLocationPlaceholder('gcs')).toMatch(/gs:\/\//);
  });
});

describe('artifactLocationHelper', () => {
  it('returns local vs cloud helper text', () => {
    expect(artifactLocationHelper('local')).toContain('server running this app');
    expect(artifactLocationHelper('s3')).toContain('SDK credentials');
    expect(artifactLocationHelper('gcs')).toContain('SDK credentials');
  });
});

describe('getArtifactReadinessLabel', () => {
  it('shows scanning while discoverLoading even if an error is present', () => {
    expect(
      getArtifactReadinessLabel({
        discoverLoading: true,
        discoveryError: 'No manifest',
        scanSucceeded: false,
        location: '/x',
      }),
    ).toBe('Scanning for artifacts…');
  });

  it('shows short summary when not loading and discovery failed', () => {
    expect(
      getArtifactReadinessLabel({
        discoverLoading: false,
        discoveryError: 'No manifest',
        scanSucceeded: false,
        location: '/x',
      }),
    ).toBe('Scan failed. Fix the location and scan again.');
  });

  it('shows ready when scan succeeded', () => {
    expect(
      getArtifactReadinessLabel({
        discoverLoading: false,
        discoveryError: null,
        scanSucceeded: true,
        location: '/x',
      }),
    ).toBe('Artifacts found. You can load the workspace again if needed.');
  });

  it('asks for location when empty', () => {
    expect(
      getArtifactReadinessLabel({
        discoverLoading: false,
        discoveryError: null,
        scanSucceeded: false,
        location: '  ',
      }),
    ).toBe('Enter a location, then scan.');
  });

  it('prompts scan when location set but scan has not succeeded', () => {
    expect(
      getArtifactReadinessLabel({
        discoverLoading: false,
        discoveryError: null,
        scanSucceeded: false,
        location: '/path',
      }),
    ).toBe('Press Enter or Scan to check this location.');
  });
});

describe('getArtifactLoadWorkspaceHint', () => {
  const base = {
    discoverLoading: false,
    discoveryError: null,
    scanSucceeded: false,
    location: '/p',
    loadLoading: false,
    canLoad: false,
  };

  it('returns undefined when can load', () => {
    expect(
      getArtifactLoadWorkspaceHint({
        ...base,
        scanSucceeded: true,
        canLoad: true,
      }),
    ).toBeUndefined();
  });

  it('hints scan when scan has not succeeded', () => {
    expect(getArtifactLoadWorkspaceHint(base)).toContain('Scan location');
  });

  it('hints empty location', () => {
    expect(
      getArtifactLoadWorkspaceHint({
        ...base,
        location: '',
      }),
    ).toBe('Enter a path, then press Enter, blur the field, or click Scan location.');
  });

  it('hints fix error when discovery failed', () => {
    expect(
      getArtifactLoadWorkspaceHint({
        ...base,
        discoveryError: 'No manifest',
      }),
    ).toBe('Fix the error below, then scan again.');
  });
});
