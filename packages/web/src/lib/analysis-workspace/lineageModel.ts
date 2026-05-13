import type { AnalysisState, ResourceNode } from '@web/types';
import { TEST_RESOURCE_TYPES, SUPPORT_TESTS_RESOURCE_TYPES } from './constants';
import { buildResourceTestStats } from './explorerTree';
import type { LensMode } from './types';

export type LineageDisplayMode = 'summary' | 'focused';

export interface LineageGraphNodeLayout {
  resource: ResourceNode;
  x: number;
  y: number;
  column: number;
  depth: number;
  side: 'upstream' | 'selected' | 'downstream';
  passCount: number;
  failCount: number;
  /** Attached tests with no run row / neutral tone (not dbt skipped). */
  notExecutedCount: number;
  skippedCount: number;
}

export interface LineageGraphModel {
  upstreamMap: Map<string, number>;
  downstreamMap: Map<string, number>;
  columnNodes: Array<{ column: number; resources: ResourceNode[] }>;
  nodeLayouts: Map<string, LineageGraphNodeLayout>;
  graphEdges: Array<{ from: string; to: string }>;
  svgWidth: number;
  svgHeight: number;
  hasRelatedNodes: boolean;
  nodeWidth: number;
  nodeHeight: number;
  nodeRadius: number;
  displayMode: LineageDisplayMode;
}

export type DependencyIndex = AnalysisState['dependencyIndex'];
type LineageColumnNode = { column: number; resources: ResourceNode[] };
type LineageGraphEdge = { from: string; to: string };

export function clampDepth(value: number): number {
  return Math.max(0, Math.min(10, value));
}

export function supportsTests(resourceType: string): boolean {
  return SUPPORT_TESTS_RESOURCE_TYPES.has(resourceType);
}

export function collectDependencyIdsByDepth(
  index: DependencyIndex,
  rootId: string,
  maxDepth: number,
  direction: 'upstream' | 'downstream',
): Map<string, number> {
  const discovered = new Map<string, number>();
  let frontier = [rootId];

  for (let depth = 1; depth <= maxDepth; depth += 1) {
    const nextFrontier: string[] = [];
    for (const nodeId of frontier) {
      const relation = index[nodeId];
      const neighborIds =
        direction === 'upstream'
          ? (relation?.upstream?.map((d) => d.uniqueId) ?? [])
          : (relation?.downstream?.map((d) => d.uniqueId) ?? []);
      for (const neighborId of neighborIds) {
        if (discovered.has(neighborId) || neighborId === rootId) continue;
        discovered.set(neighborId, depth);
        nextFrontier.push(neighborId);
      }
    }
    frontier = nextFrontier;
    if (frontier.length === 0) break;
  }

  return discovered;
}

export function getGraphStage(resourceType: string): number {
  switch (resourceType) {
    case 'source':
    case 'seed':
    case 'snapshot':
      return 0;
    case 'model':
      return 1;
    case 'semantic_model':
      return 2;
    case 'metric':
    case 'exposure':
      return 3;
    default:
      return 4;
  }
}

export function resolveLineageSide(
  resourceId: string,
  selectedId: string,
  upstreamMap: Map<string, number>,
  downstreamMap: Map<string, number>,
): { side: 'upstream' | 'selected' | 'downstream'; depth: number } {
  if (resourceId === selectedId) {
    return { side: 'selected', depth: 0 };
  }

  const upstreamDepth = upstreamMap.get(resourceId);
  const downstreamDepth = downstreamMap.get(resourceId);

  if (upstreamDepth != null && downstreamDepth != null) {
    return upstreamDepth <= downstreamDepth
      ? { side: 'upstream', depth: upstreamDepth }
      : { side: 'downstream', depth: downstreamDepth };
  }
  if (upstreamDepth != null) {
    return { side: 'upstream', depth: upstreamDepth };
  }
  if (downstreamDepth != null) {
    return { side: 'downstream', depth: downstreamDepth };
  }
  return { side: 'selected', depth: 0 };
}

// eslint-disable-next-line sonarjs/cognitive-complexity, sonarjs/cyclomatic-complexity -- column layout ranking
export function buildDisplayColumns(
  selectedId: string,
  upstreamMap: Map<string, number>,
  downstreamMap: Map<string, number>,
  resourceById: Map<string, ResourceNode>,
  dependencyIndex: DependencyIndex,
) {
  // Longest-path rank for upstream nodes.
  const upstreamRank = new Map<string, number>();
  const upstreamSorted = [...upstreamMap.keys()].sort(
    (a, b) => upstreamMap.get(a)! - upstreamMap.get(b)!,
  );
  for (const id of upstreamSorted) {
    const resource = resourceById.get(id);
    if (!resource || TEST_RESOURCE_TYPES.has(resource.resourceType)) continue;
    const downNeighbors = dependencyIndex[id]?.downstream?.map((d) => d.uniqueId) ?? [];
    let maxDownRank = 0;
    for (const nbr of downNeighbors) {
      if (nbr === selectedId) {
        maxDownRank = Math.max(maxDownRank, 0);
      } else {
        const nbrRank = upstreamRank.get(nbr);
        if (nbrRank !== undefined) maxDownRank = Math.max(maxDownRank, nbrRank);
      }
    }
    upstreamRank.set(id, maxDownRank + 1);
  }

  // Longest-path rank for downstream nodes (symmetric).
  const downstreamRank = new Map<string, number>();
  const downstreamSorted = [...downstreamMap.keys()].sort(
    (a, b) => downstreamMap.get(a)! - downstreamMap.get(b)!,
  );
  for (const id of downstreamSorted) {
    const resource = resourceById.get(id);
    if (!resource || TEST_RESOURCE_TYPES.has(resource.resourceType)) continue;
    const upNeighbors = dependencyIndex[id]?.upstream?.map((d) => d.uniqueId) ?? [];
    let maxUpRank = 0;
    for (const nbr of upNeighbors) {
      if (nbr === selectedId) {
        maxUpRank = Math.max(maxUpRank, 0);
      } else {
        const nbrRank = downstreamRank.get(nbr);
        if (nbrRank !== undefined) maxUpRank = Math.max(maxUpRank, nbrRank);
      }
    }
    downstreamRank.set(id, maxUpRank + 1);
  }

  const columns = new Map<number, ResourceNode[]>();
  const selected = resourceById.get(selectedId);
  if (selected) {
    columns.set(0, [selected]);
  }

  for (const [id] of upstreamMap) {
    const resource = resourceById.get(id);
    if (!resource || TEST_RESOURCE_TYPES.has(resource.resourceType)) continue;
    const column = -(upstreamRank.get(id) ?? 1);
    const current = columns.get(column) ?? [];
    current.push(resource);
    columns.set(column, current);
  }

  for (const [id] of downstreamMap) {
    const resource = resourceById.get(id);
    if (!resource || TEST_RESOURCE_TYPES.has(resource.resourceType)) continue;
    const column = downstreamRank.get(id) ?? 1;
    const current = columns.get(column) ?? [];
    current.push(resource);
    columns.set(column, current);
  }

  return Array.from(columns.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([column, resources]) => ({
      column,
      resources: [...new Map(resources.map((entry) => [entry.uniqueId, entry])).values()].sort(
        (left, right) => {
          const stageOrder = getGraphStage(left.resourceType) - getGraphStage(right.resourceType);
          if (stageOrder !== 0) return stageOrder;
          return left.name.localeCompare(right.name);
        },
      ),
    }));
}

export function reorderGraphColumns(
  columns: Array<{ column: number; resources: ResourceNode[] }>,
  dependencyIndex: DependencyIndex,
): Array<{ column: number; resources: ResourceNode[] }> {
  const positionById = new Map<string, number>();
  columns.forEach((entry) =>
    entry.resources.forEach((resource, index) => positionById.set(resource.uniqueId, index)),
  );

  const nextColumns = columns.map((entry) => ({
    ...entry,
    resources: [...entry.resources],
  }));

  for (let pass = 0; pass < 4; pass += 1) {
    for (let index = 1; index < nextColumns.length; index += 1) {
      const previous = nextColumns[index - 1];
      const current = nextColumns[index];
      current.resources.sort((left, right) => {
        const leftNeighbors =
          dependencyIndex[left.uniqueId]?.upstream?.map((d) => d.uniqueId) ?? [];
        const rightNeighbors =
          dependencyIndex[right.uniqueId]?.upstream?.map((d) => d.uniqueId) ?? [];
        const leftScore =
          leftNeighbors.length > 0
            ? leftNeighbors.reduce(
                (sum, id) => sum + (positionById.get(id) ?? previous.resources.length),
                0,
              ) / leftNeighbors.length
            : (positionById.get(left.uniqueId) ?? 0);
        const rightScore =
          rightNeighbors.length > 0
            ? rightNeighbors.reduce(
                (sum, id) => sum + (positionById.get(id) ?? previous.resources.length),
                0,
              ) / rightNeighbors.length
            : (positionById.get(right.uniqueId) ?? 0);
        return leftScore - rightScore;
      });
      current.resources.forEach((resource, order) => positionById.set(resource.uniqueId, order));
    }

    for (let index = nextColumns.length - 2; index >= 0; index -= 1) {
      const next = nextColumns[index + 1];
      const current = nextColumns[index];
      current.resources.sort((left, right) => {
        const leftNeighbors =
          dependencyIndex[left.uniqueId]?.downstream?.map((d) => d.uniqueId) ?? [];
        const rightNeighbors =
          dependencyIndex[right.uniqueId]?.downstream?.map((d) => d.uniqueId) ?? [];
        const leftScore =
          leftNeighbors.length > 0
            ? leftNeighbors.reduce(
                (sum, id) => sum + (positionById.get(id) ?? next.resources.length),
                0,
              ) / leftNeighbors.length
            : (positionById.get(left.uniqueId) ?? 0);
        const rightScore =
          rightNeighbors.length > 0
            ? rightNeighbors.reduce(
                (sum, id) => sum + (positionById.get(id) ?? next.resources.length),
                0,
              ) / rightNeighbors.length
            : (positionById.get(right.uniqueId) ?? 0);
        return leftScore - rightScore;
      });
      current.resources.forEach((resource, order) => positionById.set(resource.uniqueId, order));
    }
  }

  return nextColumns;
}

function getDisplayModeGeometry(displayMode: LineageDisplayMode) {
  return displayMode === 'summary'
    ? {
        nodeWidth: 176,
        nodeHeight: 64,
        nodeRadius: 14,
        columnGap: 104,
        rowGap: 24,
        paddingX: 40,
        paddingY: 40,
      }
    : {
        nodeWidth: 212,
        nodeHeight: 80,
        nodeRadius: 18,
        columnGap: 160,
        rowGap: 40,
        paddingX: 56,
        paddingY: 52,
      };
}

function computeLineageCanvasSize(
  columnNodes: LineageColumnNode[],
  geometry: ReturnType<typeof getDisplayModeGeometry>,
) {
  const columnCount = columnNodes.length;
  const tallestColumn = Math.max(1, ...columnNodes.map((entry) => entry.resources.length));
  return {
    svgWidth:
      geometry.paddingX * 2 +
      columnCount * geometry.nodeWidth +
      Math.max(0, columnCount - 1) * geometry.columnGap,
    svgHeight:
      geometry.paddingY * 2 +
      tallestColumn * geometry.nodeHeight +
      Math.max(0, tallestColumn - 1) * geometry.rowGap,
  };
}

function buildLineageNodeLayouts(
  columnNodes: LineageColumnNode[],
  selectedId: string,
  upstreamMap: Map<string, number>,
  downstreamMap: Map<string, number>,
  resourceTestStats: ReturnType<typeof buildResourceTestStats>,
  geometry: ReturnType<typeof getDisplayModeGeometry>,
  svgHeight: number,
): Map<string, LineageGraphNodeLayout> {
  const nodeLayouts = new Map<string, LineageGraphNodeLayout>();
  columnNodes.forEach((entry, columnIndex) => {
    const columnHeight =
      entry.resources.length * geometry.nodeHeight +
      Math.max(0, entry.resources.length - 1) * geometry.rowGap;
    const startY = geometry.paddingY + (svgHeight - geometry.paddingY * 2 - columnHeight) / 2;
    const x = geometry.paddingX + columnIndex * (geometry.nodeWidth + geometry.columnGap);

    entry.resources.forEach((node, rowIndex) => {
      const y = startY + rowIndex * (geometry.nodeHeight + geometry.rowGap);
      const { depth, side } = resolveLineageSide(
        node.uniqueId,
        selectedId,
        upstreamMap,
        downstreamMap,
      );
      const nodeStats = resourceTestStats.get(node.uniqueId);
      nodeLayouts.set(node.uniqueId, {
        resource: node,
        x,
        y,
        column: entry.column,
        depth,
        side,
        passCount: nodeStats?.pass ?? 0,
        failCount: (nodeStats?.error ?? 0) + (nodeStats?.warn ?? 0),
        notExecutedCount: nodeStats?.notExecuted ?? 0,
        skippedCount: nodeStats?.skipped ?? 0,
      });
    });
  });
  return nodeLayouts;
}

function collectDisplayedGraphEdges(
  dependencyIndex: DependencyIndex,
  displayedIds: Set<string>,
): LineageGraphEdge[] {
  const graphEdges: LineageGraphEdge[] = [];
  for (const nodeId of displayedIds) {
    const downstream = dependencyIndex[nodeId]?.downstream ?? [];
    for (const entry of downstream) {
      if (displayedIds.has(entry.uniqueId)) {
        graphEdges.push({ from: nodeId, to: entry.uniqueId });
      }
    }
  }
  return graphEdges;
}

export function buildLineageGraphModel({
  resource,
  dependencySummary,
  dependencyIndex,
  resourceById,
  upstreamDepth,
  downstreamDepth,
  displayMode = 'focused',
}: {
  resource: ResourceNode;
  dependencySummary: DependencyIndex[string] | undefined;
  dependencyIndex: DependencyIndex;
  resourceById: Map<string, ResourceNode>;
  upstreamDepth: number;
  downstreamDepth: number;
  displayMode?: LineageDisplayMode;
}): LineageGraphModel {
  const upstreamMap = collectDependencyIdsByDepth(
    dependencyIndex,
    resource.uniqueId,
    upstreamDepth,
    'upstream',
  );
  const downstreamMap = collectDependencyIdsByDepth(
    dependencyIndex,
    resource.uniqueId,
    downstreamDepth,
    'downstream',
  );

  const columnNodes = reorderGraphColumns(
    buildDisplayColumns(
      resource.uniqueId,
      upstreamMap,
      downstreamMap,
      resourceById,
      dependencyIndex,
    ),
    dependencyIndex,
  ).filter((entry) => entry.resources.length > 0);
  const resourceTestStats = buildResourceTestStats(
    Array.from(resourceById.values()),
    dependencyIndex,
  );
  const geometry = getDisplayModeGeometry(displayMode);
  const { svgWidth, svgHeight } = computeLineageCanvasSize(columnNodes, geometry);
  const nodeLayouts = buildLineageNodeLayouts(
    columnNodes,
    resource.uniqueId,
    upstreamMap,
    downstreamMap,
    resourceTestStats,
    geometry,
    svgHeight,
  );

  const displayedIds = new Set(nodeLayouts.keys());
  const graphEdges = collectDisplayedGraphEdges(dependencyIndex, displayedIds);

  return {
    upstreamMap,
    downstreamMap,
    columnNodes,
    nodeLayouts,
    graphEdges,
    svgWidth,
    svgHeight,
    hasRelatedNodes:
      nodeLayouts.size > 1 &&
      ((dependencySummary?.upstreamCount ?? 0) > 0 ||
        (dependencySummary?.downstreamCount ?? 0) > 0),
    nodeWidth: geometry.nodeWidth,
    nodeHeight: geometry.nodeHeight,
    nodeRadius: geometry.nodeRadius,
    displayMode,
  };
}

export function collectHighlightedGraphIds(
  resourceId: string | null,
  edges: Array<{ from: string; to: string }>,
): Set<string> {
  if (!resourceId) return new Set();
  const highlighted = new Set([resourceId]);
  for (const edge of edges) {
    if (edge.from === resourceId) highlighted.add(edge.to);
    if (edge.to === resourceId) highlighted.add(edge.from);
  }
  return highlighted;
}

export function getLineageGraphTypes(nodeLayouts: Map<string, LineageGraphNodeLayout>): string[] {
  return Array.from(
    new Set(Array.from(nodeLayouts.values()).map((entry) => entry.resource.resourceType)),
  ).sort((left, right) => {
    const stageOrder = getGraphStage(left) - getGraphStage(right);
    if (stageOrder !== 0) return stageOrder;
    return left.localeCompare(right);
  });
}

// ─── Lineage Lenses ──────────────────────────────────────────────────────────

/** Soft pastel fill colors for the status lens (applied inline on SVG rects). */
export const STATUS_LENS_FILLS: Record<string, string> = {
  positive: 'var(--bg-success-soft)',
  warning: 'var(--bg-warning-soft)',
  danger: 'var(--bg-danger-soft)',
  skipped: 'var(--bg-accent-soft)',
  neutral: 'var(--bg-surface-muted)',
};

// status lens used to be here

const COVERAGE_DOCUMENTED_FILL = 'var(--bg-success-soft)';
const COVERAGE_UNDOCUMENTED_FILL = 'var(--bg-danger-soft)';
const TYPE_LENS_NEUTRAL = 'var(--dbt-type-generic-soft)';
const TYPE_LENS_MUTED = 'var(--dbt-type-macro-soft)';

/** Soft pastel fill colors for the type lens. */
export const TYPE_LENS_FILLS: Record<string, string> = {
  model: 'var(--dbt-type-model-soft)',
  source: 'var(--dbt-type-source-soft)',
  seed: 'var(--dbt-type-seed-soft)',
  snapshot: 'var(--dbt-type-snapshot-soft)',
  test: 'var(--dbt-type-test-soft)',
  unit_test: 'var(--dbt-type-test-soft)',
  metric: 'var(--dbt-type-metric-soft)',
  semantic_model: 'var(--dbt-type-semantic-model-soft)',
  exposure: 'var(--dbt-type-exposure-soft)',
  macro: TYPE_LENS_MUTED,
  operation: 'var(--dbt-type-operation-soft)',
  sql_operation: 'var(--dbt-type-operation-soft)',
};

/** Solid colors for type lens legend swatches. */
export const TYPE_LENS_SOLID: Record<string, string> = {
  model: 'var(--dbt-type-model)',
  source: 'var(--dbt-type-source)',
  seed: 'var(--dbt-type-seed)',
  snapshot: 'var(--dbt-type-snapshot)',
  test: 'var(--dbt-type-test)',
  unit_test: 'var(--dbt-type-test)',
  metric: 'var(--dbt-type-metric)',
  semantic_model: 'var(--dbt-type-semantic-model)',
  exposure: 'var(--dbt-type-exposure)',
  macro: 'var(--dbt-type-macro)',
  operation: 'var(--dbt-type-operation)',
  sql_operation: 'var(--dbt-type-operation)',
};

export function getLensNodeFill(resource: ResourceNode, lensMode: LensMode): string {
  switch (lensMode) {
    case 'status':
      return STATUS_LENS_FILLS[resource.statusTone ?? 'neutral'];
    case 'type':
      return TYPE_LENS_FILLS[resource.resourceType] ?? TYPE_LENS_NEUTRAL;
    case 'coverage':
      return resource.description ? COVERAGE_DOCUMENTED_FILL : COVERAGE_UNDOCUMENTED_FILL;
  }
}

export interface LensLegendItem {
  key: string;
  label: string;
  color: string;
  borderColor?: string;
}

export function getLegendKeyForResource(resource: ResourceNode, lensMode: LensMode): string {
  switch (lensMode) {
    case 'status':
      return resource.statusTone ?? 'neutral';
    case 'type':
      return resource.resourceType;
    case 'coverage':
      return resource.description ? 'documented' : 'undocumented';
  }
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatResourceLabel(resourceType: string): string {
  return resourceType
    .split('_')
    .map((part) => capitalizeFirst(part))
    .join(' ');
}

/** Returns legend items appropriate for the active lens mode. */
export function getLensLegendItems(
  lensMode: LensMode,
  nodeLayouts: Map<string, LineageGraphNodeLayout>,
): LensLegendItem[] {
  const buildStatusLegendItems = () => {
    const order = ['positive', 'warning', 'danger', 'skipped', 'neutral'];
    return order.map((tone) => ({
      key: tone,
      label: capitalizeFirst(tone),
      color: STATUS_LENS_FILLS[tone],
    }));
  };

  const buildTypeLegendItems = () =>
    getLineageGraphTypes(nodeLayouts).map((type) => ({
      key: type,
      label: formatResourceLabel(type),
      color: TYPE_LENS_FILLS[type] ?? TYPE_LENS_NEUTRAL,
      borderColor: TYPE_LENS_SOLID[type] ?? 'var(--dbt-type-generic)',
    }));

  switch (lensMode) {
    case 'status':
      return buildStatusLegendItems();
    case 'type':
      return buildTypeLegendItems();
    case 'coverage':
      return [
        {
          key: 'documented',
          label: 'Documented',
          color: COVERAGE_DOCUMENTED_FILL,
        },
        {
          key: 'undocumented',
          label: 'No description',
          color: COVERAGE_UNDOCUMENTED_FILL,
        },
      ];
  }
}

/** IDs reachable from `selectedId` when edges are treated as undirected (lineage column layout). */
function reachableNodeIdsFromSelected(
  edges: Array<{ from: string; to: string }>,
  selectedId: string,
  allowedIds: Set<string>,
): Set<string> {
  const adj = new Map<string, string[]>();
  const addAdjacentNode = (from: string, to: string) => {
    const neighbors = adj.get(from);
    if (neighbors) neighbors.push(to);
    else adj.set(from, [to]);
  };
  for (const { from, to } of edges) {
    if (!allowedIds.has(from) || !allowedIds.has(to)) continue;
    addAdjacentNode(from, to);
    addAdjacentNode(to, from);
  }

  const visited = new Set<string>();
  if (!allowedIds.has(selectedId)) return visited;

  const queue = [selectedId];
  visited.add(selectedId);
  for (let i = 0; i < queue.length; i += 1) {
    const id = queue[i]!;
    for (const nbr of adj.get(id) ?? []) {
      if (!visited.has(nbr)) {
        visited.add(nbr);
        queue.push(nbr);
      }
    }
  }
  return visited;
}

/** Drop nodes not in the undirected connected component of `selectedResourceId` over `graphEdges`. */
function pruneLineageToSelectedComponent(
  nodeLayouts: Map<string, LineageGraphNodeLayout>,
  graphEdges: Array<{ from: string; to: string }>,
  selectedResourceId: string,
): Pick<LineageGraphModel, 'nodeLayouts' | 'graphEdges'> {
  if (!nodeLayouts.has(selectedResourceId)) {
    return { nodeLayouts, graphEdges };
  }

  const allowedIds = new Set(nodeLayouts.keys());
  const reachable = reachableNodeIdsFromSelected(graphEdges, selectedResourceId, allowedIds);

  if (reachable.size === nodeLayouts.size) {
    return { nodeLayouts, graphEdges };
  }

  const prunedLayouts = new Map<string, LineageGraphNodeLayout>();
  for (const [id, layout] of nodeLayouts.entries()) {
    if (reachable.has(id)) prunedLayouts.set(id, layout);
  }
  const prunedIds = new Set(prunedLayouts.keys());
  const prunedEdges = graphEdges.filter(
    (edge) => prunedIds.has(edge.from) && prunedIds.has(edge.to),
  );

  return { nodeLayouts: prunedLayouts, graphEdges: prunedEdges };
}

export function filterLineageGraphModel(
  model: LineageGraphModel,
  lensMode: LensMode,
  activeLegendKeys: Set<string>,
  selectedResourceId: string,
): Pick<LineageGraphModel, 'nodeLayouts' | 'graphEdges'> {
  if (activeLegendKeys.size === 0) {
    return pruneLineageToSelectedComponent(model.nodeLayouts, model.graphEdges, selectedResourceId);
  }

  const filteredNodeLayouts = new Map<string, LineageGraphNodeLayout>();
  for (const [nodeId, layout] of model.nodeLayouts.entries()) {
    if (
      nodeId === selectedResourceId ||
      activeLegendKeys.has(getLegendKeyForResource(layout.resource, lensMode))
    ) {
      filteredNodeLayouts.set(nodeId, layout);
    }
  }

  const visibleIds = new Set(filteredNodeLayouts.keys());
  const filteredGraphEdges = model.graphEdges.filter(
    (edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to),
  );

  return pruneLineageToSelectedComponent(
    filteredNodeLayouts,
    filteredGraphEdges,
    selectedResourceId,
  );
}
