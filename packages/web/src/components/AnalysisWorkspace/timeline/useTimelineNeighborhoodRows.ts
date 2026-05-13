import { useMemo } from 'react';
import type { AnalysisState, GanttItem } from '@web/types';
import type { TimelineFilterState } from '@web/lib/analysis-workspace/types';
import {
  collectTimelineNeighborhoodIds,
  resolveTimelineNeighborhoodFocusId,
} from './gantt/edgeGeometry';

export type TimelineNeighborhoodUi =
  | {
      mode: 'narrowed';
      shown: number;
      total: number;
    }
  | {
      mode: 'expanded';
      total: number;
      narrowedCount: number;
    };

export function useTimelineNeighborhoodRows(
  analysis: AnalysisState,
  filters: TimelineFilterState,
  filteredParents: GanttItem[],
): {
  displayedParents: GanttItem[];
  neighborhoodUi: TimelineNeighborhoodUi | null;
} {
  const candidateParentIds = useMemo(
    () => new Set(filteredParents.map((i) => i.unique_id)),
    [filteredParents],
  );

  const ganttItemById = useMemo(
    () => new Map(analysis.ganttData.map((g) => [g.unique_id, g])),
    [analysis.ganttData],
  );

  const neighborhoodFocusId = useMemo(
    () =>
      resolveTimelineNeighborhoodFocusId(
        filters.selectedExecutionId,
        candidateParentIds,
        ganttItemById,
      ),
    [filters.selectedExecutionId, candidateParentIds, ganttItemById],
  );

  const neighborhoodIds = useMemo(
    () =>
      collectTimelineNeighborhoodIds({
        focusId: neighborhoodFocusId,
        timelineAdjacency: analysis.timelineAdjacency,
        candidateIds: candidateParentIds,
        dependencyDirection: filters.dependencyDirection,
        dependencyDepthHops: filters.dependencyDepthHops,
      }),
    [
      neighborhoodFocusId,
      analysis.timelineAdjacency,
      candidateParentIds,
      filters.dependencyDirection,
      filters.dependencyDepthHops,
    ],
  );

  const displayedParents = useMemo(() => {
    if (filters.selectedExecutionId == null || filters.neighborhoodRowsShowAll) {
      return filteredParents;
    }
    return filteredParents.filter((p) => neighborhoodIds.has(p.unique_id));
  }, [
    filteredParents,
    filters.selectedExecutionId,
    filters.neighborhoodRowsShowAll,
    neighborhoodIds,
  ]);

  const neighborhoodParentCount = useMemo(
    () => filteredParents.filter((p) => neighborhoodIds.has(p.unique_id)).length,
    [filteredParents, neighborhoodIds],
  );

  const neighborhoodUi = useMemo((): TimelineNeighborhoodUi | null => {
    if (filters.selectedExecutionId == null) return null;
    if (filteredParents.length === 0 || neighborhoodParentCount >= filteredParents.length) {
      return null;
    }
    if (!filters.neighborhoodRowsShowAll) {
      return {
        mode: 'narrowed',
        shown: neighborhoodParentCount,
        total: filteredParents.length,
      };
    }
    return {
      mode: 'expanded',
      total: filteredParents.length,
      narrowedCount: neighborhoodParentCount,
    };
  }, [
    filters.selectedExecutionId,
    filters.neighborhoodRowsShowAll,
    filteredParents.length,
    neighborhoodParentCount,
  ]);

  return { displayedParents, neighborhoodUi };
}
