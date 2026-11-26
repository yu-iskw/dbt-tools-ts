import { useMemo, useState } from 'react';

import { layoutGroupedLineage } from '@web/lib/analysis-workspace/lineage-group-layout';
import {
  buildEdgeCrossings,
  buildLineageGroupModel,
  edgeCrossingKey,
  type LineageGroupModel,
} from '@web/lib/analysis-workspace/lineage-grouping';

import type { LineageGroupRect } from '@web/lib/analysis-workspace/lineage-group-layout';
import type {
  LineageGraphModel,
  LineageGraphNodeLayout,
} from '@web/lib/analysis-workspace/lineage-model';
import type { LineageGroupBy } from '@web/lib/analysis-workspace/types';

type VisibleEdge = { from: string; to: string };

/** Presentation data for grouped mode, passed to the SVG body, legend and hotspots. */
export interface LineageGroupingView {
  groupRects: LineageGroupRect[];
  edgeCrossings: LineageGroupModel['edgeCrossings'];
  crossingCounts: LineageGroupModel['crossingCounts'];
  crossingsOnly: boolean;
  onToggleCrossingsOnly: () => void;
}

export interface GroupedLineageView {
  nodeLayouts: Map<string, LineageGraphNodeLayout>;
  edges: VisibleEdge[];
  svgWidth: number;
  svgHeight: number;
  /** Null in ungrouped mode; the graph then renders exactly as before. */
  grouping: LineageGroupingView | null;
}

function buildGroupModelFor(
  nodeLayouts: Map<string, LineageGraphNodeLayout>,
  edges: VisibleEdge[],
): LineageGroupModel {
  const resourceById = new Map<string, LineageGraphNodeLayout['resource']>();
  for (const [nodeId, layout] of nodeLayouts) {
    resourceById.set(nodeId, layout.resource);
  }
  return buildLineageGroupModel({ nodeIds: Array.from(nodeLayouts.keys()), resourceById, edges });
}

/** Keeps only edges that cross a boundary, plus the nodes they touch and the selected node. */
function filterToCrossings(
  nodeLayouts: Map<string, LineageGraphNodeLayout>,
  edges: VisibleEdge[],
  selectedResourceId: string,
): { nodeLayouts: Map<string, LineageGraphNodeLayout>; edges: VisibleEdge[] } {
  const { crossings } = buildEdgeCrossings(
    edges,
    (id) => nodeLayouts.get(id)?.resource.warehouseLocation,
  );
  const crossingEdges = edges.filter(
    (edge) => (crossings.get(edgeCrossingKey(edge.from, edge.to)) ?? 'none') !== 'none',
  );
  const touchedIds = new Set<string>(selectedResourceId ? [selectedResourceId] : []);
  for (const edge of crossingEdges) {
    touchedIds.add(edge.from);
    touchedIds.add(edge.to);
  }
  const keptLayouts = new Map(Array.from(nodeLayouts).filter(([nodeId]) => touchedIds.has(nodeId)));
  return { nodeLayouts: keptLayouts, edges: crossingEdges };
}

/** Group-aware layout for one visible graph. Ungrouped mode returns the model's own layout unchanged. */
function computeGroupedView(
  model: LineageGraphModel,
  nodeLayouts: Map<string, LineageGraphNodeLayout>,
  edges: VisibleEdge[],
  crossingsOnly: boolean,
  selectedResourceId: string,
): {
  nodeLayouts: Map<string, LineageGraphNodeLayout>;
  edges: VisibleEdge[];
  groupModel: LineageGroupModel;
  groupRects: LineageGroupRect[];
  svgWidth: number;
  svgHeight: number;
} {
  const scoped = crossingsOnly
    ? filterToCrossings(nodeLayouts, edges, selectedResourceId)
    : { nodeLayouts, edges };
  const groupModel = buildGroupModelFor(scoped.nodeLayouts, scoped.edges);
  const layout = layoutGroupedLineage({
    model: { ...model, nodeLayouts: scoped.nodeLayouts },
    groupModel,
  });
  return {
    nodeLayouts: layout.nodeLayouts,
    edges: scoped.edges,
    groupModel,
    groupRects: layout.groupRects,
    svgWidth: layout.svgWidth,
    svgHeight: layout.svgHeight,
  };
}

/**
 * Applies warehouse grouping to the visible lineage graph. Owns the local "Crossings only" toggle
 * (component state, not URL state).
 */
export function useGroupedLineageLayout({
  model,
  graph,
  groupBy,
  selectedResourceId,
}: {
  model: LineageGraphModel;
  graph: { nodeLayouts: Map<string, LineageGraphNodeLayout>; graphEdges: VisibleEdge[] };
  groupBy: LineageGroupBy;
  selectedResourceId: string;
}): GroupedLineageView {
  const { nodeLayouts, graphEdges: edges } = graph;
  const [crossingsOnly, setCrossingsOnly] = useState(false);
  const grouped = groupBy === 'warehouse';

  return useMemo((): GroupedLineageView => {
    if (!grouped) {
      return {
        nodeLayouts,
        edges,
        svgWidth: model.svgWidth,
        svgHeight: model.svgHeight,
        grouping: null,
      };
    }
    const view = computeGroupedView(model, nodeLayouts, edges, crossingsOnly, selectedResourceId);
    return {
      nodeLayouts: view.nodeLayouts,
      edges: view.edges,
      svgWidth: view.svgWidth,
      svgHeight: view.svgHeight,
      grouping: {
        groupRects: view.groupRects,
        edgeCrossings: view.groupModel.edgeCrossings,
        crossingCounts: view.groupModel.crossingCounts,
        crossingsOnly,
        onToggleCrossingsOnly: () => setCrossingsOnly((current) => !current),
      },
    };
  }, [crossingsOnly, edges, grouped, model, nodeLayouts, selectedResourceId]);
}
