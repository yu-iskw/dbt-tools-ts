import { useMemo } from 'react';

import { mapTimelineDependencyControlsToFocusOptions } from './dependency-controls';
import { getFocusTimelineEdges, type FocusTimelineEdge } from './edge-geometry';

import type { TimelineDependencyDirection } from '@web/lib/analysis-workspace/types';
import type { GanttItem, TimelineAdjacencyEntry } from '@web/types';

export interface UseGanttFocusEdgesParams {
  edgeFocusId: string | null;
  timelineAdjacency: Record<string, TimelineAdjacencyEntry> | undefined;
  itemById: Map<string, GanttItem>;
  bundleIndexById: Map<string, number>;
  dependencyDirection: TimelineDependencyDirection;
  dependencyDepthHops: number;
}

export function useGanttFocusEdges({
  edgeFocusId,
  timelineAdjacency,
  itemById,
  bundleIndexById,
  dependencyDirection,
  dependencyDepthHops,
}: UseGanttFocusEdgesParams): { edges: FocusTimelineEdge[] } {
  const focusOptions = useMemo(
    () =>
      mapTimelineDependencyControlsToFocusOptions({
        dependencyDirection,
        dependencyDepthHops,
      }),
    [dependencyDepthHops, dependencyDirection],
  );

  const { edges } = useMemo(
    () =>
      getFocusTimelineEdges(
        edgeFocusId,
        timelineAdjacency,
        itemById,
        bundleIndexById,
        focusOptions,
      ),
    [edgeFocusId, timelineAdjacency, itemById, bundleIndexById, focusOptions],
  );

  return { edges };
}
