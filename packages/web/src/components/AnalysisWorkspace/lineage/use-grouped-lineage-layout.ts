import { useCallback, useMemo, useState } from 'react';

import {
  buildLineageCollapse,
  defaultCollapsedGroupIds,
  summaryPlaceholders,
  toggleableGroupIds,
  type DisplayEdge,
  type SummaryNode,
} from '@web/lib/analysis-workspace/lineage-collapse';
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

/** A summary node with its laid-out position. */
export interface SummaryNodeView extends SummaryNode {
  x: number;
  y: number;
}

/** Collapse state and actions for grouped mode (view state only; ADR-0018). */
export interface LineageCollapseView {
  summaries: SummaryNodeView[];
  collapsedGroupIds: ReadonlySet<string>;
  /** Containers that can collapse: all but the one holding the selected node. */
  toggleableGroupIds: ReadonlySet<string>;
  /** Edges folded into a bundle or hidden inside a collapsed container. */
  bundledEdgeCount: number;
  /** Real nodes hidden inside collapsed containers. */
  hiddenNodeCount: number;
  onToggleGroup: (groupId: string) => void;
  onExpandGroups: (groupIds: readonly string[]) => void;
  onCollapseOthers: () => void;
  onExpandAll: () => void;
}

/** Presentation data for grouped mode, passed to the SVG body, legend and hotspots. */
export interface LineageGroupingView {
  groupRects: LineageGroupRect[];
  /** Counts of real edges by tier; never changes when containers collapse. */
  crossingCounts: LineageGroupModel['crossingCounts'];
  crossingsOnly: boolean;
  onToggleCrossingsOnly: () => void;
  collapse: LineageCollapseView;
}

export interface GroupedLineageView {
  nodeLayouts: Map<string, LineageGraphNodeLayout>;
  /** Real edges in ungrouped mode; bundled display edges in grouped mode. */
  edges: Array<DisplayEdge | VisibleEdge>;
  svgWidth: number;
  svgHeight: number;
  /** Null in ungrouped mode; the graph then renders exactly as before. */
  grouping: LineageGroupingView | null;
}

interface ScopedGraph {
  nodeLayouts: Map<string, LineageGraphNodeLayout>;
  edges: VisibleEdge[];
  groupModel: LineageGroupModel;
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

/** Scope ("Crossings only") then group model; legend counts come from this, before any collapse. */
function scopeGraph(
  nodeLayouts: Map<string, LineageGraphNodeLayout>,
  edges: VisibleEdge[],
  crossingsOnly: boolean,
  selectedResourceId: string,
): ScopedGraph {
  const scoped = crossingsOnly
    ? filterToCrossings(nodeLayouts, edges, selectedResourceId)
    : { nodeLayouts, edges };
  return { ...scoped, groupModel: buildGroupModelFor(scoped.nodeLayouts, scoped.edges) };
}

/** Collapse, then lay out the remaining nodes and one placeholder per collapsed container. */
function computeGroupedView({
  model,
  scoped,
  collapsedGroupIds,
  selectedResourceId,
}: {
  model: LineageGraphModel;
  scoped: ScopedGraph;
  collapsedGroupIds: ReadonlySet<string>;
  selectedResourceId: string;
}): {
  nodeLayouts: Map<string, LineageGraphNodeLayout>;
  edges: DisplayEdge[];
  summaries: SummaryNodeView[];
  groupRects: LineageGroupRect[];
  bundledEdgeCount: number;
  svgWidth: number;
  svgHeight: number;
} {
  const { groupModel, nodeLayouts, edges } = scoped;
  const resourceById = new Map(
    Array.from(nodeLayouts, ([nodeId, layout]) => [nodeId, layout.resource] as const),
  );
  const collapse = buildLineageCollapse({
    nodeIds: Array.from(nodeLayouts.keys()),
    edges,
    groupModel,
    resourceById,
    collapsedGroupIds,
    selectedId: selectedResourceId,
  });
  const keptIds = new Set(collapse.nodeIds);
  const keptLayouts = new Map(Array.from(nodeLayouts).filter(([nodeId]) => keptIds.has(nodeId)));
  const layout = layoutGroupedLineage({
    model: { ...model, nodeLayouts: keptLayouts },
    groupModel,
    placeholders: summaryPlaceholders(collapse.summaries, nodeLayouts),
  });
  const summaries = collapse.summaries.flatMap((summary) => {
    const position = layout.placeholderPositions.get(summary.id);
    return position ? [{ ...summary, ...position }] : [];
  });
  return {
    nodeLayouts: layout.nodeLayouts,
    edges: collapse.displayEdges,
    summaries,
    groupRects: layout.groupRects,
    bundledEdgeCount: collapse.bundledEdgeCount,
    svgWidth: layout.svgWidth,
    svgHeight: layout.svgHeight,
  };
}

interface CollapseChoice {
  /** The choice applies to this graph and selection only; a new one falls back to the default. */
  model: LineageGraphModel;
  selectedResourceId: string;
  ids: ReadonlySet<string>;
}

/**
 * Collapsed container ids: the user's choice for the current graph and selection, otherwise the
 * default policy. Selecting another node builds a new graph, so the selected node's container
 * is open by default and a hotspot click on a neighbour needs no extra handling.
 */
function useCollapseState({
  model,
  scoped,
  selectedResourceId,
}: {
  model: LineageGraphModel;
  scoped: ScopedGraph | null;
  selectedResourceId: string;
}) {
  const [choice, setChoice] = useState<CollapseChoice | null>(null);
  const defaultIds = useMemo(
    () =>
      scoped
        ? defaultCollapsedGroupIds({
            groupModel: scoped.groupModel,
            selectedId: selectedResourceId,
          })
        : new Set<string>(),
    [scoped, selectedResourceId],
  );
  const current =
    choice?.model === model && choice.selectedResourceId === selectedResourceId
      ? choice.ids
      : defaultIds;

  const choose = useCallback(
    (ids: ReadonlySet<string>) => setChoice({ model, selectedResourceId, ids }),
    [model, selectedResourceId],
  );
  const onToggleGroup = useCallback(
    (groupId: string) => {
      const next = new Set(current);
      if (!next.delete(groupId)) next.add(groupId);
      choose(next);
    },
    [choose, current],
  );
  const onExpandGroups = useCallback(
    (groupIds: readonly string[]) =>
      choose(new Set([...current].filter((id) => !groupIds.includes(id)))),
    [choose, current],
  );
  const onCollapseOthers = useCallback(() => {
    if (scoped) choose(toggleableGroupIds(scoped.groupModel, selectedResourceId));
  }, [choose, scoped, selectedResourceId]);
  const onExpandAll = useCallback(() => choose(new Set()), [choose]);
  return useMemo(
    () => ({ collapsedIds: current, onToggleGroup, onExpandGroups, onCollapseOthers, onExpandAll }),
    [current, onCollapseOthers, onExpandAll, onExpandGroups, onToggleGroup],
  );
}

/**
 * Applies warehouse grouping to the visible lineage graph. Owns the local "Crossings only" toggle
 * and the collapse state (component state, not URL state).
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
  const scoped = useMemo(
    () => (grouped ? scopeGraph(nodeLayouts, edges, crossingsOnly, selectedResourceId) : null),
    [crossingsOnly, edges, grouped, nodeLayouts, selectedResourceId],
  );
  const collapseState = useCollapseState({ model, scoped, selectedResourceId });
  const { collapsedIds } = collapseState;

  return useMemo((): GroupedLineageView => {
    if (!scoped) {
      return {
        nodeLayouts,
        edges,
        svgWidth: model.svgWidth,
        svgHeight: model.svgHeight,
        grouping: null,
      };
    }
    const view = computeGroupedView({
      model,
      scoped,
      collapsedGroupIds: collapsedIds,
      selectedResourceId,
    });
    return {
      nodeLayouts: view.nodeLayouts,
      edges: view.edges,
      svgWidth: view.svgWidth,
      svgHeight: view.svgHeight,
      grouping: {
        groupRects: view.groupRects,
        crossingCounts: scoped.groupModel.crossingCounts,
        crossingsOnly,
        onToggleCrossingsOnly: () => setCrossingsOnly((current) => !current),
        collapse: {
          summaries: view.summaries,
          collapsedGroupIds: new Set(view.summaries.map((summary) => summary.groupId)),
          toggleableGroupIds: toggleableGroupIds(scoped.groupModel, selectedResourceId),
          bundledEdgeCount: view.bundledEdgeCount,
          hiddenNodeCount: view.summaries.reduce((total, s) => total + s.memberCount, 0),
          onToggleGroup: collapseState.onToggleGroup,
          onExpandGroups: collapseState.onExpandGroups,
          onCollapseOthers: collapseState.onCollapseOthers,
          onExpandAll: collapseState.onExpandAll,
        },
      },
    };
  }, [
    collapseState,
    collapsedIds,
    crossingsOnly,
    edges,
    model,
    nodeLayouts,
    scoped,
    selectedResourceId,
  ]);
}
