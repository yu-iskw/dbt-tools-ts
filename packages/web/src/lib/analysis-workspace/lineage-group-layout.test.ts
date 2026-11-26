import { describe, expect, it } from 'vitest';

import {
  OUTER_PAD,
  layoutGroupedLineage,
  type GroupedLineageLayout,
  type LineageGroupRect,
} from '@web/lib/analysis-workspace/lineage-group-layout';
import { buildLineageGroupModel } from '@web/lib/analysis-workspace/lineage-grouping';

import type { ResourceNode, WarehouseLocation } from '@dbt-tools/core/browser';
import type {
  LineageGraphModel,
  LineageGraphNodeLayout,
} from '@web/lib/analysis-workspace/lineage-model';

const NODE_WIDTH = 212;
const NODE_HEIGHT = 80;
const FOCUSED_ROW_GAP = 40;

interface SyntheticNode {
  id: string;
  /** Column index; x is derived from it. */
  column: number;
  /** Row index within the column; y is derived from it. */
  row: number;
  location?: WarehouseLocation | null;
}

function bigQueryLocation(project: string, dataset: string): WarehouseLocation {
  return {
    levels: [
      { kind: 'project', label: 'Project', name: project },
      { kind: 'dataset', label: 'Dataset', name: dataset },
    ],
    relation: null,
  };
}

function resource(id: string, warehouseLocation?: WarehouseLocation | null): ResourceNode {
  return {
    uniqueId: id,
    name: id,
    resourceType: 'model',
    packageName: 'pkg',
    path: null,
    originalFilePath: null,
    description: null,
    status: null,
    statusTone: 'neutral',
    executionTime: null,
    threadId: null,
    warehouseLocation,
  } as ResourceNode;
}

function layoutOf(node: SyntheticNode): [string, LineageGraphNodeLayout] {
  return [
    node.id,
    {
      resource: resource(node.id, node.location),
      x: 56 + node.column * (NODE_WIDTH + 160),
      y: 52 + node.row * (NODE_HEIGHT + FOCUSED_ROW_GAP),
      column: node.column,
      depth: 0,
      side: 'downstream',
      passCount: 0,
      failCount: 0,
      notExecutedCount: 0,
      skippedCount: 0,
    },
  ];
}

function buildScenario(
  nodes: SyntheticNode[],
  edges: Array<{ from: string; to: string }> = [],
  options: { modelOrder?: 'forward' | 'reverse' } = {},
) {
  const ordered = options.modelOrder === 'reverse' ? [...nodes].reverse() : nodes;
  const model: LineageGraphModel = {
    upstreamMap: new Map(),
    downstreamMap: new Map(),
    columnNodes: [],
    nodeLayouts: new Map(ordered.map(layoutOf)),
    graphEdges: edges,
    svgWidth: 0,
    svgHeight: 0,
    hasRelatedNodes: edges.length > 0,
    nodeWidth: NODE_WIDTH,
    nodeHeight: NODE_HEIGHT,
    nodeRadius: 18,
    displayMode: 'focused',
  };
  const resourceById = new Map(
    nodes.map((node): [string, ResourceNode] => [node.id, resource(node.id, node.location)]),
  );
  const groupModel = buildLineageGroupModel({
    nodeIds: nodes.map((node) => node.id),
    resourceById,
    edges,
  });
  return { model, groupModel };
}

function layoutFor(nodes: SyntheticNode[], edges: Array<{ from: string; to: string }> = []) {
  const { model, groupModel } = buildScenario(nodes, edges);
  return {
    model,
    groupModel,
    layout: layoutGroupedLineage({ model, groupModel, displayMode: 'focused' }),
  };
}

function rectsOverlap(a: LineageGroupRect, b: LineageGroupRect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function rectContains(outer: LineageGroupRect, inner: LineageGroupRect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

function rectsOfKind(layout: GroupedLineageLayout, kind: LineageGroupRect['kind']) {
  return layout.groupRects.filter((rect) => rect.kind === kind);
}

function expectNoOverlapWithinKind(layout: GroupedLineageLayout) {
  for (const kind of ['outer', 'inner', 'lane'] as const) {
    const rects = rectsOfKind(layout, kind);
    rects.forEach((a, index) => {
      for (const b of rects.slice(index + 1)) {
        expect(rectsOverlap(a, b)).toBe(false);
      }
    });
  }
}

function expectEveryNodeCenterInsideGroup(
  layout: GroupedLineageLayout,
  groupIdByNodeId: Map<string, string>,
) {
  for (const [id, node] of layout.nodeLayouts) {
    const groupId = groupIdByNodeId.get(id);
    const rect = layout.groupRects.find((candidate) => candidate.groupId === groupId);
    expect(rect, `rect for ${id}`).toBeDefined();
    const cx = node.x + NODE_WIDTH / 2;
    const cy = node.y + NODE_HEIGHT / 2;
    expect(cx).toBeGreaterThanOrEqual(rect!.x);
    expect(cx).toBeLessThanOrEqual(rect!.x + rect!.width);
    expect(cy).toBeGreaterThanOrEqual(rect!.y);
    expect(cy).toBeLessThanOrEqual(rect!.y + rect!.height);
  }
}

function expectNoVerticalNodeOverlapInColumns(layout: GroupedLineageLayout) {
  const nodes = [...layout.nodeLayouts.values()];
  for (const a of nodes) {
    for (const b of nodes) {
      if (a === b || a.x !== b.x) continue;
      const separated = a.y + NODE_HEIGHT <= b.y || b.y + NODE_HEIGHT <= a.y;
      expect(separated).toBe(true);
    }
  }
}

const TWO_INNER_ONE_OUTER: SyntheticNode[] = [
  { id: 'm.raw1', column: 0, row: 0, location: bigQueryLocation('proj', 'raw') },
  { id: 'm.marts1', column: 1, row: 0, location: bigQueryLocation('proj', 'marts') },
  { id: 'm.raw2', column: 1, row: 1, location: bigQueryLocation('proj', 'raw') },
];

describe('layoutGroupedLineage', () => {
  it('places two inner groups under one outer as non-overlapping boxes inside that outer', () => {
    const { groupModel, layout } = layoutFor(TWO_INNER_ONE_OUTER, [
      { from: 'm.raw1', to: 'm.marts1' },
    ]);

    const outers = rectsOfKind(layout, 'outer');
    const inners = rectsOfKind(layout, 'inner');
    expect(outers).toHaveLength(1);
    expect(inners).toHaveLength(2);
    expect(inners.every((inner) => rectContains(outers[0]!, inner))).toBe(true);
    expectNoOverlapWithinKind(layout);
    expectEveryNodeCenterInsideGroup(layout, groupModel.groupIdByNodeId);
  });

  it('draws outer rects first, then inner rects, then the lane rect', () => {
    const { layout } = layoutFor([
      ...TWO_INNER_ONE_OUTER,
      { id: 'exposure.x', column: 2, row: 0, location: null },
    ]);

    expect(layout.groupRects.map((rect) => rect.kind)).toEqual(['outer', 'inner', 'inner', 'lane']);
  });

  it('keeps two outer groups side by side in bands without overlap', () => {
    const { groupModel, layout } = layoutFor(
      [
        { id: 'm.a', column: 0, row: 0, location: bigQueryLocation('proj-a', 'marts') },
        { id: 'm.b', column: 1, row: 0, location: bigQueryLocation('proj-b', 'marts') },
        { id: 'm.c', column: 1, row: 1, location: bigQueryLocation('proj-b', 'raw') },
      ],
      [{ from: 'm.a', to: 'm.b' }],
    );

    expect(rectsOfKind(layout, 'outer').map((rect) => rect.label)).toEqual(['proj-a', 'proj-b']);
    expect(rectsOfKind(layout, 'inner')).toHaveLength(3);
    expectNoOverlapWithinKind(layout);
    expectEveryNodeCenterInsideGroup(layout, groupModel.groupIdByNodeId);
  });

  it('places the not-in-warehouse lane last and below every other box', () => {
    const { layout } = layoutFor([
      ...TWO_INNER_ONE_OUTER,
      { id: 'exposure.x', column: 2, row: 0, location: null },
    ]);

    const lane = layout.groupRects.at(-1);
    expect(lane?.kind).toBe('lane');
    expect(lane?.label).toBe('Not in warehouse');
    const others = layout.groupRects.filter((rect) => rect.kind !== 'lane');
    for (const rect of others) {
      expect(lane!.y).toBeGreaterThanOrEqual(rect.y + rect.height);
    }
    expectNoOverlapWithinKind(layout);
  });

  it('handles a group spanning three columns and a group with three nodes in one column', () => {
    const nodes: SyntheticNode[] = [
      { id: 'm.1', column: 0, row: 0, location: bigQueryLocation('proj', 'marts') },
      { id: 'm.2', column: 0, row: 1, location: bigQueryLocation('proj', 'marts') },
      { id: 'm.3', column: 0, row: 2, location: bigQueryLocation('proj', 'marts') },
      { id: 'm.4', column: 1, row: 0, location: bigQueryLocation('proj', 'marts') },
      { id: 'm.5', column: 2, row: 0, location: bigQueryLocation('proj', 'marts') },
      { id: 'm.6', column: 1, row: 1, location: bigQueryLocation('proj', 'raw') },
      { id: 'm.7', column: 2, row: 1, location: bigQueryLocation('proj', 'raw') },
      { id: 'm.8', column: 0, row: 3, location: bigQueryLocation('other', 'marts') },
    ];
    const { groupModel, layout } = layoutFor(nodes, [
      { from: 'm.1', to: 'm.4' },
      { from: 'm.4', to: 'm.5' },
      { from: 'm.6', to: 'm.7' },
    ]);

    expect(rectsOfKind(layout, 'inner')).toHaveLength(3);
    expectNoOverlapWithinKind(layout);
    expectEveryNodeCenterInsideGroup(layout, groupModel.groupIdByNodeId);
    expectNoVerticalNodeOverlapInColumns(layout);
  });

  it('keeps every node, shifts x by the outer padding, and never changes the other node fields', () => {
    const { model, layout } = layoutFor(TWO_INNER_ONE_OUTER);

    expect(layout.nodeLayouts.size).toBe(model.nodeLayouts.size);
    for (const [id, original] of model.nodeLayouts) {
      const moved = layout.nodeLayouts.get(id);
      expect(moved?.x).toBe(original.x + OUTER_PAD);
      expect(moved).toMatchObject({ column: original.column, side: original.side });
      expect(moved?.resource).toBe(original.resource);
    }
  });

  it('never puts two nodes in the same column on top of each other', () => {
    const { layout } = layoutFor(TWO_INNER_ONE_OUTER);
    expect(layout.nodeLayouts.size).toBe(TWO_INNER_ONE_OUTER.length);
    expectNoVerticalNodeOverlapInColumns(layout);
  });

  it('returns a minimal, non-empty canvas for an empty node set', () => {
    const { layout } = layoutFor([]);

    expect(layout.nodeLayouts.size).toBe(0);
    expect(layout.groupRects).toEqual([]);
    expect(layout.svgWidth).toBeGreaterThan(0);
    expect(layout.svgHeight).toBeGreaterThan(0);
  });

  it('places a node missing from the group model in the lane when one exists', () => {
    const nodes: SyntheticNode[] = [
      { id: 'm.a', column: 0, row: 0, location: bigQueryLocation('proj', 'marts') },
      { id: 'exposure.x', column: 1, row: 0, location: null },
      { id: 'orphan', column: 1, row: 1, location: bigQueryLocation('proj', 'raw') },
    ];
    const { model, groupModel } = buildScenario(nodes);
    const groupModelWithoutOrphan = buildLineageGroupModel({
      nodeIds: ['m.a', 'exposure.x'],
      resourceById: new Map(
        nodes.map((node): [string, ResourceNode] => [node.id, resource(node.id, node.location)]),
      ),
      edges: [],
    });
    expect(groupModel.groupIdByNodeId.has('orphan')).toBe(true);

    const layout = layoutGroupedLineage({
      model,
      groupModel: groupModelWithoutOrphan,
      displayMode: 'focused',
    });

    const lane = rectsOfKind(layout, 'lane')[0];
    const orphan = layout.nodeLayouts.get('orphan');
    expect(lane).toBeDefined();
    expect(orphan).toBeDefined();
    expect(
      rectContains(lane!, {
        ...lane!,
        x: orphan!.x,
        y: orphan!.y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      }),
    ).toBe(true);
  });

  it('leaves a node missing from the group model unmoved when no lane exists', () => {
    const nodes: SyntheticNode[] = [
      { id: 'm.a', column: 0, row: 0, location: bigQueryLocation('proj', 'marts') },
      { id: 'orphan', column: 1, row: 0, location: bigQueryLocation('proj', 'raw') },
    ];
    const { model } = buildScenario(nodes);
    const groupModel = buildLineageGroupModel({
      nodeIds: ['m.a'],
      resourceById: new Map(
        nodes.map((node): [string, ResourceNode] => [node.id, resource(node.id, node.location)]),
      ),
      edges: [],
    });

    const layout = layoutGroupedLineage({ model, groupModel, displayMode: 'focused' });

    expect(layout.nodeLayouts.get('orphan')).toEqual(model.nodeLayouts.get('orphan'));
  });

  it('is deterministic regardless of node and edge input order', () => {
    const edges = [
      { from: 'm.raw1', to: 'm.marts1' },
      { from: 'm.raw2', to: 'm.marts1' },
    ];
    const forward = buildScenario(TWO_INNER_ONE_OUTER, edges);
    const reversedNodes = buildScenario([...TWO_INNER_ONE_OUTER].reverse(), [...edges].reverse(), {
      modelOrder: 'reverse',
    });

    const a = layoutGroupedLineage({ ...forward, displayMode: 'focused' });
    const b = layoutGroupedLineage({ ...reversedNodes, displayMode: 'focused' });

    expect(b.groupRects).toEqual(a.groupRects);
    expect(b.svgWidth).toBe(a.svgWidth);
    expect(b.svgHeight).toBe(a.svgHeight);
    const byId = ([left]: [string, unknown], [right]: [string, unknown]) =>
      left < right ? -1 : Number(left > right);
    expect([...b.nodeLayouts.entries()].sort(byId)).toEqual(
      [...a.nodeLayouts.entries()].sort(byId),
    );
  });
});
