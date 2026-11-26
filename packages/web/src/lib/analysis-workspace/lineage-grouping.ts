import { getBoundaryCrossing } from '@dbt-tools/core/browser';

import type { BoundaryCrossing, ResourceNode, WarehouseLocation } from '@dbt-tools/core/browser';

export const NO_WAREHOUSE_GROUP_ID = 'lane:no-warehouse';

export interface LineageGroup {
  id: string;
  kind: 'inner' | 'lane' | 'outer';
  label: string;
  levelLabel: string;
  parentId: string | null;
  childGroupIds: string[];
  nodeIds: string[];
}

export interface LineageGroupModel {
  groups: LineageGroup[];
  rootGroupIds: string[];
  groupIdByNodeId: Map<string, string>;
  edgeCrossings: Map<string, BoundaryCrossing>;
  crossingCounts: { inner: number; outer: number };
}

interface ContainerRef {
  name: string;
  levelLabel: string;
}

interface GroupPath {
  outer: ContainerRef | null;
  inner: ContainerRef;
}

function compareText(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

export function edgeCrossingKey(from: string, to: string): string {
  return `${from}->${to}`;
}

/** Outer and inner containers for a location; null when the resource has no warehouse container. */
function groupPathOf(location: WarehouseLocation | null | undefined): GroupPath | null {
  const levels = location?.levels ?? [];
  const [first] = levels;
  const inner = levels.at(-1);
  if (first == null || inner == null) return null;
  const outer = levels.length > 1 ? { name: first.name, levelLabel: first.label } : null;
  return { outer, inner: { name: inner.name, levelLabel: inner.label } };
}

function innerGroupId(path: GroupPath): string {
  return path.outer ? `inner:${path.outer.name}/${path.inner.name}` : `inner:${path.inner.name}`;
}

function ensureGroup(
  groups: Map<string, LineageGroup>,
  id: string,
  kind: LineageGroup['kind'],
  container: ContainerRef,
  parentId: string | null,
): LineageGroup {
  const existing = groups.get(id);
  if (existing) return existing;
  const created: LineageGroup = {
    id,
    kind,
    label: container.name,
    levelLabel: container.levelLabel,
    parentId,
    childGroupIds: [],
    nodeIds: [],
  };
  groups.set(id, created);
  return created;
}

/** Adds one node under its inner group, creating the outer and inner groups as needed. */
function placeNode(groups: Map<string, LineageGroup>, nodeId: string, path: GroupPath): string {
  const outer = path.outer;
  const outerId = outer ? `outer:${outer.name}` : null;
  if (outer && outerId) ensureGroup(groups, outerId, 'outer', outer, null);
  const innerId = innerGroupId(path);
  const inner = ensureGroup(groups, innerId, 'inner', path.inner, outerId);
  inner.nodeIds.push(nodeId);
  return innerId;
}

function compareGroups(a: LineageGroup, b: LineageGroup): number {
  return compareText(a.label, b.label) || compareText(a.id, b.id);
}

/** Outer and single-level root groups sorted by label; each outer followed by its inner groups. */
function orderGroups(byId: Map<string, LineageGroup>): LineageGroup[] {
  const allGroups = [...byId.values()];
  const roots = allGroups.filter((g) => g.parentId === null).sort(compareGroups);
  const ordered: LineageGroup[] = [];
  for (const root of roots) {
    ordered.push(root);
    const children = allGroups.filter((g) => g.parentId === root.id).sort(compareGroups);
    root.childGroupIds = children.map((c) => c.id);
    ordered.push(...children);
  }
  return ordered;
}

function buildLaneGroup(nodeIds: string[]): LineageGroup {
  return {
    id: NO_WAREHOUSE_GROUP_ID,
    kind: 'lane',
    label: 'Not in warehouse',
    levelLabel: 'Outside warehouse',
    parentId: null,
    childGroupIds: [],
    nodeIds,
  };
}

interface NodeGroups {
  byId: Map<string, LineageGroup>;
  groupIdByNodeId: Map<string, string>;
  laneNodeIds: Set<string>;
}

/** Places each distinct node in its innermost warehouse group, or in the lane when it has none. */
function buildNodeGroups(
  nodeIds: readonly string[],
  locationOf: (id: string) => WarehouseLocation | null | undefined,
): NodeGroups {
  const result: NodeGroups = {
    byId: new Map(),
    groupIdByNodeId: new Map(),
    laneNodeIds: new Set(),
  };
  for (const nodeId of nodeIds) {
    if (result.groupIdByNodeId.has(nodeId) || result.laneNodeIds.has(nodeId)) continue;
    const path = groupPathOf(locationOf(nodeId));
    if (path == null) {
      result.laneNodeIds.add(nodeId);
    } else {
      result.groupIdByNodeId.set(nodeId, placeNode(result.byId, nodeId, path));
    }
  }
  for (const group of result.byId.values()) {
    group.nodeIds.sort(compareText);
  }
  return result;
}

function buildEdgeCrossings(
  edges: ReadonlyArray<{ from: string; to: string }>,
  locationOf: (id: string) => WarehouseLocation | null | undefined,
): { crossings: Map<string, BoundaryCrossing>; counts: { inner: number; outer: number } } {
  const crossings = new Map<string, BoundaryCrossing>();
  const counts = { inner: 0, outer: 0 };
  for (const edge of edges) {
    const key = edgeCrossingKey(edge.from, edge.to);
    if (crossings.has(key)) continue;
    const tier = edgeTier(locationOf(edge.from), locationOf(edge.to));
    crossings.set(key, tier);
    if (tier === 'inner') counts.inner += 1;
    if (tier === 'outer') counts.outer += 1;
  }
  return { crossings, counts };
}

/** Lane endpoints never produce a crossing; otherwise compare the two locations. */
function edgeTier(
  from: WarehouseLocation | null | undefined,
  to: WarehouseLocation | null | undefined,
): BoundaryCrossing {
  if (groupPathOf(from) == null || groupPathOf(to) == null) return 'none';
  return getBoundaryCrossing(from, to);
}

export function buildLineageGroupModel(args: {
  nodeIds: readonly string[];
  resourceById: ReadonlyMap<string, ResourceNode>;
  edges: ReadonlyArray<{ from: string; to: string }>;
}): LineageGroupModel {
  const { nodeIds, resourceById, edges } = args;
  const locationOf = (id: string): WarehouseLocation | null | undefined =>
    resourceById.get(id)?.warehouseLocation;

  const { byId, groupIdByNodeId, laneNodeIds } = buildNodeGroups(nodeIds, locationOf);
  const groups = orderGroups(byId);
  if (laneNodeIds.size > 0) {
    const sortedLane = [...laneNodeIds].sort(compareText);
    groups.push(buildLaneGroup(sortedLane));
    for (const nodeId of sortedLane) groupIdByNodeId.set(nodeId, NO_WAREHOUSE_GROUP_ID);
  }

  const { crossings, counts } = buildEdgeCrossings(edges, locationOf);
  return {
    groups,
    rootGroupIds: groups.filter((g) => g.parentId === null).map((g) => g.id),
    groupIdByNodeId,
    edgeCrossings: crossings,
    crossingCounts: counts,
  };
}
