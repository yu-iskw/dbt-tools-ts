import { compareText } from './lineage-grouping';

import type { LineageGroup, LineageGroupModel } from './lineage-grouping';
import type { LineageGraphModel, LineageGraphNodeLayout } from './lineage-model';

/** Padding between an outer box edge and the inner boxes or nodes it wraps. */
export const OUTER_PAD = 16;
/** Padding between an inner box edge and the nodes it wraps. */
const INNER_PAD = 12;
/** Label strip height at the top of an inner box. */
export const GROUP_HEADER_HEIGHT = 24;
const HEADER = GROUP_HEADER_HEIGHT;
/** Label strip height at the top of an outer box. */
const OUTER_HEADER = 28;
/** Vertical gap between inner bands that belong to the same outer group. */
const BAND_GAP = 12;
/** Vertical gap between different outer groups, and before the lane. */
const OUTER_GAP = 28;

export interface LineageGroupRect {
  groupId: string;
  kind: LineageGroup['kind'];
  label: string;
  levelLabel: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Stand-in for a collapsed group's summary node: laid out like one node so the band is one row
 * tall. `x` and `y` are where the members were (first member column, mean member y).
 */
export interface GroupPlaceholder {
  id: string;
  groupId: string;
  x: number;
  y: number;
}

export interface GroupedLineageLayout {
  nodeLayouts: LineageGraphModel['nodeLayouts'];
  /** Final top-left position of each placeholder, keyed by placeholder id. */
  placeholderPositions: Map<string, { x: number; y: number }>;
  /** Draw order: all outer rects, then inner rects, then the lane rect. */
  groupRects: LineageGroupRect[];
  svgWidth: number;
  svgHeight: number;
}

/** A node or placeholder to place; `layout` is null for placeholders. */
interface NodeEntry {
  id: string;
  x: number;
  y: number;
  layout: LineageGraphNodeLayout | null;
}

interface PlacedNode {
  id: string;
  x: number;
  y: number;
  layout: LineageGraphNodeLayout | null;
}

interface RowSlot {
  entry: NodeEntry;
  row: number;
}

interface GroupColumns {
  slots: RowSlot[];
  rowsPerColumn: number;
}

interface Pitch {
  nodeWidth: number;
  nodeHeight: number;
  rowGap: number;
}

interface Band {
  group: LineageGroup;
  top: number;
  bottom: number;
}

interface Extent {
  minX: number;
  maxRight: number;
}

interface PlacedGroup {
  band: Band;
  extent: Extent;
  nodes: PlacedNode[];
}

function compareEntries(a: NodeEntry, b: NodeEntry): number {
  return a.x - b.x || a.y - b.y || compareText(a.id, b.id);
}

/**
 * Node layouts and placeholders keyed by their group; nodes without a group go to the lane when
 * one exists.
 */
function collectEntriesByGroup(
  model: LineageGraphModel,
  groupModel: LineageGroupModel,
  placeholders: readonly GroupPlaceholder[],
): Map<string, NodeEntry[]> {
  const laneId = groupModel.groups.find((group) => group.kind === 'lane')?.id ?? null;
  const entriesByGroup = new Map<string, NodeEntry[]>();
  const add = (groupId: string | null, entry: NodeEntry) => {
    if (groupId == null) return;
    const entries = entriesByGroup.get(groupId) ?? [];
    entries.push(entry);
    entriesByGroup.set(groupId, entries);
  };
  for (const [id, layout] of model.nodeLayouts) {
    add(groupModel.groupIdByNodeId.get(id) ?? laneId, { id, x: layout.x, y: layout.y, layout });
  }
  for (const { id, groupId, x, y } of placeholders) {
    add(groupId, { id, x, y, layout: null });
  }
  return entriesByGroup;
}

/** Stacks a group's nodes per column, top to bottom, in their original y order. */
function assignRows(entries: NodeEntry[]): GroupColumns {
  const sorted = [...entries].sort(compareEntries);
  const slots: RowSlot[] = [];
  let rowsPerColumn = 0;
  let row = 0;
  sorted.forEach((entry, index) => {
    // `at(-1)` would wrap to the last entry, so the first entry never continues a column.
    const sameColumn = index > 0 && sorted.at(index - 1)?.x === entry.x;
    row = sameColumn ? row + 1 : 0;
    slots.push({ entry, row });
    rowsPerColumn = Math.max(rowsPerColumn, row + 1);
  });
  return { slots, rowsPerColumn };
}

function bandHeight(rowsPerColumn: number, pitch: Pitch): number {
  const rowsHeight = rowsPerColumn * (pitch.nodeHeight + pitch.rowGap) - pitch.rowGap;
  return rowsHeight + INNER_PAD * 2 + HEADER;
}

/** Vertical bands top to bottom; inner bands of one outer are consecutive in `leaves`. */
function placeLeafBands(leaves: LineageGroup[], heightOf: Map<string, number>): Band[] {
  const bands: Band[] = [];
  let cursor = OUTER_PAD;
  leaves.forEach((group, index) => {
    const parentId = group.parentId;
    // `at(-1)` would wrap to the last leaf, so the first leaf never shares an outer with a previous one.
    const previousParentId = index > 0 ? leaves.at(index - 1)?.parentId : undefined;
    if (parentId !== null && previousParentId !== parentId) {
      cursor += OUTER_HEADER + OUTER_PAD;
    }
    const height = heightOf.get(group.id) ?? 0;
    bands.push({ group, top: cursor, bottom: cursor + height });
    cursor += height;

    const nextInSameOuter = parentId !== null && leaves.at(index + 1)?.parentId === parentId;
    if (nextInSameOuter) {
      cursor += BAND_GAP;
    } else {
      cursor += (parentId !== null ? OUTER_PAD : 0) + OUTER_GAP;
    }
  });
  return bands;
}

function placeGroupNodes(band: Band, columns: GroupColumns, pitch: Pitch): PlacedGroup {
  const nodes: PlacedNode[] = columns.slots.map(({ entry, row }) => {
    const x = entry.x + OUTER_PAD;
    const y = band.top + INNER_PAD + HEADER + row * (pitch.nodeHeight + pitch.rowGap);
    return { id: entry.id, x, y, layout: entry.layout && { ...entry.layout, x, y } };
  });
  let minX = Infinity;
  let maxX = -Infinity;
  for (const node of nodes) {
    minX = Math.min(minX, node.x);
    maxX = Math.max(maxX, node.x);
  }
  return { band, extent: { minX, maxRight: maxX + pitch.nodeWidth }, nodes };
}

function innerRect(placed: PlacedGroup): LineageGroupRect {
  const { band, extent } = placed;
  return {
    groupId: band.group.id,
    kind: band.group.kind,
    label: band.group.label,
    levelLabel: band.group.levelLabel,
    x: extent.minX - INNER_PAD,
    y: band.top,
    width: extent.maxRight - extent.minX + INNER_PAD * 2,
    height: band.bottom - band.top,
  };
}

function outerRect(outer: LineageGroup, children: PlacedGroup[]): LineageGroupRect | null {
  const first = children.at(0);
  const last = children.at(-1);
  if (!first || !last) return null;
  const minX = Math.min(...children.map((child) => child.extent.minX));
  const maxRight = Math.max(...children.map((child) => child.extent.maxRight));
  const top = first.band.top - OUTER_HEADER - OUTER_PAD;
  return {
    groupId: outer.id,
    kind: 'outer',
    label: outer.label,
    levelLabel: outer.levelLabel,
    x: minX - OUTER_PAD,
    y: top,
    width: maxRight - minX + OUTER_PAD * 2,
    height: last.band.bottom + OUTER_PAD - top,
  };
}

function buildOuterRects(groups: LineageGroup[], placed: PlacedGroup[]): LineageGroupRect[] {
  const placedByParent = new Map<string, PlacedGroup[]>();
  for (const entry of placed) {
    const parentId = entry.band.group.parentId;
    if (parentId === null) continue;
    const siblings = placedByParent.get(parentId) ?? [];
    siblings.push(entry);
    placedByParent.set(parentId, siblings);
  }
  const rects: LineageGroupRect[] = [];
  for (const outer of groups) {
    if (outer.kind !== 'outer') continue;
    const rect = outerRect(outer, placedByParent.get(outer.id) ?? []);
    if (rect) rects.push(rect);
  }
  return rects;
}

function collectLeafGroups(
  groupModel: LineageGroupModel,
  entriesByGroup: Map<string, NodeEntry[]>,
): LineageGroup[] {
  return groupModel.groups.filter(
    (group) => group.kind !== 'outer' && (entriesByGroup.get(group.id)?.length ?? 0) > 0,
  );
}

/** Right and bottom edges of every rect and every node, including nodes left unmoved. */
function measureExtent(
  rects: LineageGroupRect[],
  nodeLayouts: LineageGraphModel['nodeLayouts'],
  pitch: Pitch,
): { right: number; bottom: number } {
  let right = OUTER_PAD;
  let bottom = OUTER_PAD;
  for (const rect of rects) {
    right = Math.max(right, rect.x + rect.width);
    bottom = Math.max(bottom, rect.y + rect.height);
  }
  for (const layout of nodeLayouts.values()) {
    right = Math.max(right, layout.x + pitch.nodeWidth);
    bottom = Math.max(bottom, layout.y + pitch.nodeHeight);
  }
  return { right, bottom };
}

/**
 * Repositions nodes into group bands so that groups never overlap.
 * Horizontal positions come from the ungrouped model; only y and the group boxes are new.
 */
export function layoutGroupedLineage({
  model,
  groupModel,
  placeholders = [],
}: {
  model: LineageGraphModel;
  groupModel: LineageGroupModel;
  /** One entry per collapsed group; the group's members must be absent from `model.nodeLayouts`. */
  placeholders?: readonly GroupPlaceholder[];
}): GroupedLineageLayout {
  const pitch: Pitch = {
    nodeWidth: model.nodeWidth,
    nodeHeight: model.nodeHeight,
    rowGap: model.rowGap,
  };
  const entriesByGroup = collectEntriesByGroup(model, groupModel, placeholders);
  const leaves = collectLeafGroups(groupModel, entriesByGroup);

  const columnsByGroup = new Map<string, GroupColumns>();
  const heightOf = new Map<string, number>();
  for (const leaf of leaves) {
    const columns = assignRows(entriesByGroup.get(leaf.id) ?? []);
    columnsByGroup.set(leaf.id, columns);
    heightOf.set(leaf.id, bandHeight(columns.rowsPerColumn, pitch));
  }

  const bands = placeLeafBands(leaves, heightOf);
  const placed = bands.map((band) =>
    placeGroupNodes(
      band,
      columnsByGroup.get(band.group.id) ?? { slots: [], rowsPerColumn: 0 },
      pitch,
    ),
  );

  const placedById = new Map<string, LineageGraphNodeLayout>();
  const placeholderPositions = new Map<string, { x: number; y: number }>();
  for (const group of placed) {
    for (const { id, x, y, layout } of group.nodes) {
      if (layout) placedById.set(id, layout);
      else placeholderPositions.set(id, { x, y });
    }
  }

  const outerRects = buildOuterRects(groupModel.groups, placed);
  // Leaves come in group order with the lane last, so one pass keeps "inner, then lane" draw order.
  const groupRects = [...outerRects, ...placed.map(innerRect)];

  const nodeLayouts: LineageGraphModel['nodeLayouts'] = new Map();
  const sortedIds = [...model.nodeLayouts.keys()].sort(compareText);
  for (const id of sortedIds) {
    const layout = model.nodeLayouts.get(id);
    if (layout) nodeLayouts.set(id, placedById.get(id) ?? layout);
  }

  const extent = measureExtent(groupRects, nodeLayouts, pitch);
  return {
    nodeLayouts,
    placeholderPositions,
    groupRects,
    svgWidth: extent.right + OUTER_PAD,
    svgHeight: extent.bottom + OUTER_PAD,
  };
}
