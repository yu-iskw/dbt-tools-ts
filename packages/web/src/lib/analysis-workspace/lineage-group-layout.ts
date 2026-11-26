import type { LineageGroup, LineageGroupModel } from './lineage-grouping';
import type {
  LineageDisplayMode,
  LineageGraphModel,
  LineageGraphNodeLayout,
} from './lineage-model';

/** Padding between an outer box edge and the inner boxes or nodes it wraps. */
export const OUTER_PAD = 16;
/** Padding between an inner box edge and the nodes it wraps. */
export const INNER_PAD = 12;
/** Label strip height at the top of an inner box. */
export const HEADER = 24;
/** Label strip height at the top of an outer box. */
export const OUTER_HEADER = 28;
/** Vertical gap between inner bands that belong to the same outer group. */
export const BAND_GAP = 12;
/** Vertical gap between different outer groups, and before the lane. */
export const OUTER_GAP = 28;

/** Row gaps mirror `getDisplayModeGeometry` in `lineage-model.ts` (not exported there). */
const ROW_GAP_BY_MODE = new Map<LineageDisplayMode, number>([
  ['focused', 40],
  ['summary', 24],
]);
const DEFAULT_ROW_GAP = 40;

export interface LineageGroupRect {
  groupId: string;
  kind: 'inner' | 'lane' | 'outer';
  label: string;
  levelLabel: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GroupedLineageLayout {
  nodeLayouts: LineageGraphModel['nodeLayouts'];
  /** Draw order: all outer rects, then inner rects, then the lane rect. */
  groupRects: LineageGroupRect[];
  svgWidth: number;
  svgHeight: number;
}

interface NodeEntry {
  id: string;
  layout: LineageGraphNodeLayout;
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
  nodes: Array<[string, LineageGraphNodeLayout]>;
}

function compareText(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

function compareEntries(a: NodeEntry, b: NodeEntry): number {
  return a.layout.x - b.layout.x || a.layout.y - b.layout.y || compareText(a.id, b.id);
}

/** Node layouts keyed by their group; nodes without a group go to the lane when one exists. */
function collectEntriesByGroup(
  model: LineageGraphModel,
  groupModel: LineageGroupModel,
): Map<string, NodeEntry[]> {
  const laneId = groupModel.groups.find((group) => group.kind === 'lane')?.id ?? null;
  const entriesByGroup = new Map<string, NodeEntry[]>();
  for (const [id, layout] of model.nodeLayouts) {
    const groupId = groupModel.groupIdByNodeId.get(id) ?? laneId;
    if (groupId == null) continue;
    const entries = entriesByGroup.get(groupId) ?? [];
    entries.push({ id, layout });
    entriesByGroup.set(groupId, entries);
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
    const sameColumn = sorted.at(index - 1)?.layout.x === entry.layout.x;
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
    if (parentId !== null && leaves.at(index - 1)?.parentId !== parentId) {
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
  const nodes: Array<[string, LineageGraphNodeLayout]> = columns.slots.map(({ entry, row }) => [
    entry.id,
    {
      ...entry.layout,
      x: entry.layout.x + OUTER_PAD,
      y: band.top + INNER_PAD + HEADER + row * (pitch.nodeHeight + pitch.rowGap),
    },
  ]);
  const xs = nodes.map(([, layout]) => layout.x);
  const extent: Extent = {
    minX: Math.min(...xs),
    maxRight: Math.max(...xs) + pitch.nodeWidth,
  };
  return { band, extent, nodes };
}

function innerRect(placed: PlacedGroup): LineageGroupRect {
  const { band, extent } = placed;
  const isLane = band.group.kind === 'lane';
  return {
    groupId: band.group.id,
    kind: isLane ? 'lane' : 'inner',
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
  const rects: LineageGroupRect[] = [];
  for (const outer of groups) {
    if (outer.kind !== 'outer') continue;
    const children = placed.filter((entry) => entry.band.group.parentId === outer.id);
    const rect = outerRect(outer, children);
    if (rect) rects.push(rect);
  }
  return rects;
}

function resolveRowGap(displayMode: LineageDisplayMode): number {
  return ROW_GAP_BY_MODE.get(displayMode) ?? DEFAULT_ROW_GAP;
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
  displayMode,
}: {
  model: LineageGraphModel;
  groupModel: LineageGroupModel;
  displayMode: 'focused' | 'summary';
}): GroupedLineageLayout {
  const pitch: Pitch = {
    nodeWidth: model.nodeWidth,
    nodeHeight: model.nodeHeight,
    rowGap: resolveRowGap(displayMode),
  };
  const entriesByGroup = collectEntriesByGroup(model, groupModel);
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
  for (const group of placed) {
    for (const [id, layout] of group.nodes) placedById.set(id, layout);
  }

  const outerRects = buildOuterRects(groupModel.groups, placed);
  const innerRects = placed.filter((entry) => entry.band.group.kind === 'inner').map(innerRect);
  const laneRects = placed.filter((entry) => entry.band.group.kind === 'lane').map(innerRect);
  const groupRects = [...outerRects, ...innerRects, ...laneRects];

  const nodeLayouts: LineageGraphModel['nodeLayouts'] = new Map();
  const sortedIds = [...model.nodeLayouts.keys()].sort(compareText);
  for (const id of sortedIds) {
    const layout = model.nodeLayouts.get(id);
    if (layout) nodeLayouts.set(id, placedById.get(id) ?? layout);
  }

  const extent = measureExtent(groupRects, nodeLayouts, pitch);
  return {
    nodeLayouts,
    groupRects,
    svgWidth: extent.right + OUTER_PAD,
    svgHeight: extent.bottom + OUTER_PAD,
  };
}
