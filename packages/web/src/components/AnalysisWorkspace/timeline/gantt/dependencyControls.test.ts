import { describe, expect, it } from 'vitest';
import { TIMELINE_EXTENDED_MAX_HOPS } from './constants';
import {
  clampTimelineDependencyDepth,
  mapTimelineDependencyControlsToFocusOptions,
} from './dependencyControls';

describe('clampTimelineDependencyDepth', () => {
  it('clamps values into the supported hop range', () => {
    expect(clampTimelineDependencyDepth(0)).toBe(1);
    expect(clampTimelineDependencyDepth(2.8)).toBe(2);
    expect(clampTimelineDependencyDepth(99)).toBe(TIMELINE_EXTENDED_MAX_HOPS);
  });
});

describe('mapTimelineDependencyControlsToFocusOptions', () => {
  it('maps upstream depth 1 to one-hop upstream only', () => {
    expect(
      mapTimelineDependencyControlsToFocusOptions({
        dependencyDirection: 'upstream',
        dependencyDepthHops: 1,
      }),
    ).toMatchObject({
      includeUpstream: true,
      includeDownstream: false,
      showAllUpstream: false,
      showAllDownstream: false,
      extendedDeps: { enabled: false },
    });
  });

  it('maps downstream to downstream-only with extended BFS when depth > 1', () => {
    expect(
      mapTimelineDependencyControlsToFocusOptions({
        dependencyDirection: 'downstream',
        dependencyDepthHops: 3,
      }),
    ).toMatchObject({
      includeUpstream: false,
      includeDownstream: true,
      extendedDeps: { enabled: true, maxHops: 3 },
    });
  });

  it('treats Max as the extended hop cap', () => {
    expect(
      mapTimelineDependencyControlsToFocusOptions({
        dependencyDirection: 'both',
        dependencyDepthHops: 999,
      }).extendedDeps,
    ).toMatchObject({
      enabled: true,
      maxHops: TIMELINE_EXTENDED_MAX_HOPS,
    });
  });
});
