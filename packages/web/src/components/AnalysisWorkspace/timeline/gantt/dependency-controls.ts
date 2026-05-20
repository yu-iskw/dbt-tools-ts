import {
  TIMELINE_EXTENDED_MAX_EDGES_PER_DIRECTION,
  TIMELINE_EXTENDED_MAX_HOPS,
  TIMELINE_MAX_DOWNSTREAM_EDGES,
  TIMELINE_MAX_UPSTREAM_EDGES,
} from './constants';

import type { FocusTimelineEdgesOptions } from './edge-geometry';
import type { TimelineDependencyDirection } from '@web/lib/analysis-workspace/types';

export interface TimelineDependencyControlsState {
  dependencyDirection: TimelineDependencyDirection;
  dependencyDepthHops: number;
}

export function clampTimelineDependencyDepth(depth: number): number {
  return Math.max(1, Math.min(TIMELINE_EXTENDED_MAX_HOPS, Math.trunc(depth)));
}

/**
 * `Max` is represented by setting `dependencyDepthHops` to the extended hop cap
 * rather than tracking a second boolean flag.
 */
export function mapTimelineDependencyControlsToFocusOptions(
  controls: TimelineDependencyControlsState,
): FocusTimelineEdgesOptions {
  const depth = clampTimelineDependencyDepth(controls.dependencyDepthHops);
  const includeUpstream = controls.dependencyDirection !== 'downstream';
  const includeDownstream = controls.dependencyDirection !== 'upstream';

  return {
    includeUpstream,
    includeDownstream,
    showAllUpstream: false,
    maxUpstreamEdges: TIMELINE_MAX_UPSTREAM_EDGES,
    showAllDownstream: false,
    maxDownstreamEdges: TIMELINE_MAX_DOWNSTREAM_EDGES,
    extendedDeps:
      depth > 1
        ? {
            enabled: true,
            maxHops: clampTimelineDependencyDepth(depth),
            maxEdgesPerDirection: TIMELINE_EXTENDED_MAX_EDGES_PER_DIRECTION,
          }
        : { enabled: false },
  };
}
