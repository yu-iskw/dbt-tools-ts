import { describe, expect, it } from 'vitest';
import {
  artifactLocationPlaceholder,
  getArtifactLoadWorkspaceHint,
  getArtifactReadinessLabel,
} from './artifactLoadPanelCopy';

describe('artifactLocationPlaceholder', () => {
  it('returns kind-specific placeholders', () => {
    expect(artifactLocationPlaceholder('local')).toMatch(/path\/to\/target/);
    expect(artifactLocationPlaceholder('s3')).toMatch(/s3:\/\//);
    expect(artifactLocationPlaceholder('gcs')).toMatch(/gs:\/\//);
  });
});

describe('getArtifactReadinessLabel', () => {
  it('shows scanning while discoverLoading even if an error is present', () => {
    expect(
      getArtifactReadinessLabel({
        discoverLoading: true,
        discoveryError: 'No manifest',
        candidateRunIds: [],
        selectedRunId: null,
        location: '/x',
      }),
    ).toBe('Scanning for artifact runs…');
  });

  it('shows discovery error when not loading', () => {
    expect(
      getArtifactReadinessLabel({
        discoverLoading: false,
        discoveryError: 'No manifest',
        candidateRunIds: [],
        selectedRunId: null,
        location: '/x',
      }),
    ).toBe('No manifest');
  });

  it('shows ready when a run is selected', () => {
    expect(
      getArtifactReadinessLabel({
        discoverLoading: false,
        discoveryError: null,
        candidateRunIds: ['a'],
        selectedRunId: 'a',
        location: '/x',
      }),
    ).toBe('Ready to load the workspace.');
  });

  it('asks for location when empty', () => {
    expect(
      getArtifactReadinessLabel({
        discoverLoading: false,
        discoveryError: null,
        candidateRunIds: [],
        selectedRunId: null,
        location: '  ',
      }),
    ).toBe('Enter a location, then press Enter or move focus away to scan.');
  });

  it('prompts scan when location set but no candidates', () => {
    expect(
      getArtifactReadinessLabel({
        discoverLoading: false,
        discoveryError: null,
        candidateRunIds: [],
        selectedRunId: null,
        location: '/path',
      }),
    ).toBe('Press Enter or leave the Location field to scan for artifact runs.');
  });
});

describe('getArtifactLoadWorkspaceHint', () => {
  const base = {
    discoverLoading: false,
    discoveryError: null,
    candidateRunIds: [] as string[],
    selectedRunId: null as string | null,
    location: '/p',
    loadLoading: false,
    canLoad: false,
  };

  it('returns undefined when can load', () => {
    expect(
      getArtifactLoadWorkspaceHint({
        ...base,
        candidateRunIds: ['a'],
        selectedRunId: 'a',
        canLoad: true,
      }),
    ).toBeUndefined();
  });

  it('hints scan when no candidates', () => {
    expect(getArtifactLoadWorkspaceHint(base)).toContain('Press Enter');
  });

  it('hints empty location', () => {
    expect(
      getArtifactLoadWorkspaceHint({
        ...base,
        location: '',
      }),
    ).toBe('Enter a path, then press Enter or leave the Location field to scan.');
  });
});
