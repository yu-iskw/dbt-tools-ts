import { describe, expect, it } from 'vitest';

import {
  AUTO_COLLAPSE_NODE_THRESHOLD,
  buildLineageCollapse,
  defaultCollapsedGroupIds,
  isSummaryNodeId,
  summaryNodeId,
  summaryPlaceholders,
  toggleableGroupIds,
} from '@web/lib/analysis-workspace/lineage-collapse';
import {
  NO_WAREHOUSE_GROUP_ID,
  buildLineageGroupModel,
} from '@web/lib/analysis-workspace/lineage-grouping';

import type { ResourceNode, WarehouseLocation } from '@dbt-tools/core/browser';
import type { LineageGraphNodeLayout } from '@web/lib/analysis-workspace/lineage-model';

type Edge = { from: string; to: string };

/** `[project, dataset]`, or null for a resource with no warehouse location. */
type Place = readonly [string, string] | null;

function location([project, dataset]: readonly [string, string]): WarehouseLocation {
  return {
    levels: [
      { kind: 'project', label: 'Project', name: project },
      { kind: 'dataset', label: 'Dataset', name: dataset },
    ],
    relation: null,
  };
}

function resource(
  id: string,
  place: Place,
  extra: Partial<Pick<ResourceNode, 'resourceType' | 'statusTone'>> = {},
): ResourceNode {
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
    warehouseLocation: place ? location(place) : null,
    ...extra,
  } as ResourceNode;
}

function scenario(
  places: Record<string, Place>,
  edges: Edge[],
  extras: Record<string, Partial<Pick<ResourceNode, 'resourceType' | 'statusTone'>>> = {},
) {
  const placeOf = new Map(Object.entries(places));
  const extraOf = new Map(Object.entries(extras));
  const nodeIds = [...placeOf.keys()];
  const resourceById = new Map(
    nodeIds.map((id): [string, ResourceNode] => [
      id,
      resource(id, placeOf.get(id) ?? null, extraOf.get(id)),
    ]),
  );
  const groupModel = buildLineageGroupModel({ nodeIds, resourceById, edges });
  return { nodeIds, edges, resourceById, groupModel };
}

const RAW = 'inner:proj/raw';
const MARTS = 'inner:proj/marts';
const OTHER = 'inner:other/marts';

/** a, b in raw; c, d in marts; e in another project; x outside the warehouse. */
const SMALL = scenario(
  {
    a: ['proj', 'raw'],
    b: ['proj', 'raw'],
    c: ['proj', 'marts'],
    d: ['proj', 'marts'],
    e: ['other', 'marts'],
    x: null,
  },
  [
    { from: 'a', to: 'b' },
    { from: 'a', to: 'c' },
    { from: 'b', to: 'c' },
    { from: 'b', to: 'd' },
    { from: 'c', to: 'd' },
    { from: 'd', to: 'e' },
    { from: 'e', to: 'x' },
  ],
);

function collapse(
  s: ReturnType<typeof scenario>,
  collapsed: string[],
  selectedId = 'c',
): ReturnType<typeof buildLineageCollapse> {
  return buildLineageCollapse({
    nodeIds: s.nodeIds,
    edges: s.edges,
    groupModel: s.groupModel,
    resourceById: s.resourceById,
    collapsedGroupIds: new Set(collapsed),
    selectedId,
  });
}

function totalCount(result: ReturnType<typeof buildLineageCollapse>): number {
  return result.displayEdges.reduce((sum, edge) => sum + edge.count, 0) + result.internalEdgeCount;
}

describe('buildLineageCollapse', () => {
  it('leaves everything untouched when nothing is collapsed', () => {
    const result = collapse(SMALL, []);

    expect(result.nodeIds).toEqual(SMALL.nodeIds);
    expect(result.summaries).toEqual([]);
    expect(result.displayEdges).toHaveLength(SMALL.edges.length);
    expect(result.displayEdges.every((edge) => edge.count === 1)).toBe(true);
    expect(result.internalEdgeCount).toBe(0);
    expect(result.bundledEdgeCount).toBe(0);
  });

  it('replaces a collapsed group with one summary node and bundles its edges', () => {
    const result = collapse(SMALL, [RAW]);

    expect(result.nodeIds).toEqual(['c', 'd', 'e', 'x']);
    expect(result.summaries).toHaveLength(1);
    const [summary] = result.summaries;
    expect(summary).toMatchObject({
      id: summaryNodeId(RAW),
      groupId: RAW,
      label: 'raw',
      memberIds: ['a', 'b'],
      memberCount: 2,
      internalEdgeCount: 1,
    });
    // a->c and b->c merge into one bundle of two; b->d stays a bundle of one.
    const toC = result.displayEdges.find((edge) => edge.to === 'c');
    expect(toC).toMatchObject({ from: summaryNodeId(RAW), count: 2 });
    expect(toC?.memberEdges).toEqual([
      { from: 'a', to: 'c' },
      { from: 'b', to: 'c' },
    ]);
    expect(result.internalEdgeCount).toBe(1);
    expect(result.collapsedGroupIds).toEqual([RAW]);
  });

  it('counts bundled and internal edges together as the edges not drawn on their own', () => {
    const result = collapse(SMALL, [RAW]);
    // internal a->b (1) + bundle a->c, b->c (2) + bundle b->d (1)
    expect(result.bundledEdgeCount).toBe(4);
  });

  it('never collapses the selected node group, even when asked to', () => {
    const result = collapse(SMALL, [RAW, MARTS], 'c');

    expect(result.collapsedGroupIds).toEqual([RAW]);
    expect(result.nodeIds).toEqual(expect.arrayContaining(['c', 'd']));
    expect(toggleableGroupIds(SMALL.groupModel, 'c').has(MARTS)).toBe(false);
  });

  it('can collapse the lane like any other group', () => {
    const result = collapse(SMALL, [NO_WAREHOUSE_GROUP_ID]);

    expect(result.summaries.map((summary) => summary.groupId)).toEqual([NO_WAREHOUSE_GROUP_ID]);
    expect(result.summaries[0]?.label).toBe('Not in warehouse');
    expect(result.displayEdges.at(-1)).toMatchObject({
      from: 'e',
      to: summaryNodeId(NO_WAREHOUSE_GROUP_ID),
      count: 1,
    });
  });

  it('keeps direction: edges in opposite directions never merge', () => {
    const s = scenario({ a: ['p', 'one'], b: ['p', 'two'], c: ['p', 'two'], s: ['p', 'sel'] }, [
      { from: 'a', to: 'b' },
      { from: 'c', to: 'a' },
      { from: 'a', to: 'c' },
    ]);
    const result = collapse(s, ['inner:p/two'], 's');
    const two = summaryNodeId('inner:p/two');

    expect(result.displayEdges).toHaveLength(2);
    expect(result.displayEdges.find((edge) => edge.from === 'a' && edge.to === two)?.count).toBe(2);
    expect(result.displayEdges.find((edge) => edge.from === two && edge.to === 'a')?.count).toBe(1);
  });

  it('gives a bundle the crossing tier of its member edges', () => {
    const s = scenario(
      {
        sel: ['p', 'sel'],
        a: ['p', 'x'],
        b: ['p', 'x'],
        inner: ['p', 'y'],
        c: ['q', 'z'],
        d: ['q', 'z'],
        outer: ['p', 'y'],
        same: ['p', 'x'],
      },
      [
        { from: 'a', to: 'inner' },
        { from: 'b', to: 'inner' },
        { from: 'c', to: 'outer' },
        { from: 'd', to: 'outer' },
        { from: 'a', to: 'same' },
        { from: 'b', to: 'same' },
      ],
    );
    const result = collapse(s, ['inner:p/x', 'inner:q/z'], 'sel');
    const tiers = new Map(result.displayEdges.map((edge) => [`${edge.from}>${edge.to}`, edge]));

    const x = summaryNodeId('inner:p/x');
    const z = summaryNodeId('inner:q/z');
    expect(tiers.get(`${x}>inner`)).toMatchObject({ count: 2, crossing: 'inner' });
    expect(tiers.get(`${z}>outer`)).toMatchObject({ count: 2, crossing: 'outer' });
    // a->same and b->same stay inside the collapsed group.
    expect(result.internalEdgeCount).toBe(2);
  });

  it('rolls up member types and run status counts on the summary node', () => {
    const s = scenario(
      { a: ['p', 'g'], b: ['p', 'g'], c: ['p', 'g'], sel: ['p', 'sel'] },
      [{ from: 'a', to: 'sel' }],
      {
        a: { resourceType: 'source', statusTone: 'positive' },
        b: { resourceType: 'model', statusTone: 'danger' },
        c: { resourceType: 'model', statusTone: 'positive' },
      },
    );
    const [summary] = collapse(s, ['inner:p/g'], 'sel').summaries;

    expect(summary?.typeCounts).toEqual([
      { resourceType: 'model', count: 2 },
      { resourceType: 'source', count: 1 },
    ]);
    expect(summary?.statusCounts).toEqual([
      { tone: 'positive', count: 2 },
      { tone: 'danger', count: 1 },
    ]);
  });

  it('is deterministic for the same input', () => {
    const first = collapse(SMALL, [RAW, OTHER]);
    const second = collapse(SMALL, [OTHER, RAW]);

    expect(second).toEqual(first);
  });

  it('keeps every real edge in exactly one place when collapsing', () => {
    const result = collapse(SMALL, [RAW, OTHER, NO_WAREHOUSE_GROUP_ID]);
    const inBundles = result.displayEdges.flatMap((edge) => edge.memberEdges);

    expect(inBundles.length + result.internalEdgeCount).toBe(SMALL.edges.length);
    for (const edge of inBundles) expect(SMALL.edges).toContainEqual(edge);
  });
});

describe('conservation invariant (ADR-0018)', () => {
  function makeRng(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  }

  const PLACES: Place[] = [
    ['p1', 'raw'],
    ['p1', 'marts'],
    ['p2', 'raw'],
    ['p2', 'marts'],
    ['p3', 'x'],
    null,
  ];

  it('holds for random graphs and random collapse sets', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const next = makeRng(seed);
      const nodeCount = 2 + Math.floor(next() * 30);
      const ids = Array.from({ length: nodeCount }, (_, index) => `n${index}`);
      const places = Object.fromEntries(
        ids.map((id) => [id, PLACES[Math.floor(next() * PLACES.length)] ?? null]),
      );
      const edgeCount = Math.floor(next() * nodeCount * 4);
      const edges: Edge[] = Array.from({ length: edgeCount }, () => ({
        from: ids[Math.floor(next() * nodeCount)] ?? 'n0',
        to: ids[Math.floor(next() * nodeCount)] ?? 'n0',
      }));
      const s = scenario(places, edges);
      const allGroups = s.groupModel.groups.map((group) => group.id);
      const collapsed = allGroups.filter(() => next() < 0.5);
      const selectedId = ids[Math.floor(next() * nodeCount)] ?? 'n0';

      const result = collapse(s, collapsed, selectedId);

      expect(totalCount(result), `seed ${seed}`).toBe(edges.length);
      expect(result.bundledEdgeCount).toBeLessThanOrEqual(edges.length);
      const drawn = new Set([...result.nodeIds, ...result.summaries.map((summary) => summary.id)]);
      for (const edge of result.displayEdges) {
        // Edge endpoints are always drawn nodes; direction is never swapped.
        expect(drawn.has(edge.from) || !s.nodeIds.includes(edge.from)).toBe(true);
        expect(drawn.has(edge.to) || !s.nodeIds.includes(edge.to)).toBe(true);
        for (const member of edge.memberEdges) {
          expect(edges).toContainEqual(member);
        }
      }
      const selectedGroup = s.groupModel.groupIdByNodeId.get(selectedId);
      expect(result.collapsedGroupIds).not.toContain(selectedGroup);
      expect(result.nodeIds.length + result.summaries.reduce((n, g) => n + g.memberCount, 0)).toBe(
        s.nodeIds.length,
      );
    }
  });
});

describe('defaultCollapsedGroupIds', () => {
  function bigScenario(nodeCount: number) {
    // Groups of 4 nodes; node i is in dataset d(i/4). Chain edges between consecutive nodes.
    const places = Object.fromEntries(
      Array.from({ length: nodeCount }, (_, index): [string, Place] => [
        `n${index}`,
        ['proj', `d${Math.floor(index / 4)}`],
      ]),
    );
    const edges: Edge[] = [];
    for (let index = 1; index < nodeCount; index += 1) {
      edges.push({ from: `n${index - 1}`, to: `n${index}` });
    }
    return scenario(places, edges);
  }

  it('starts small graphs expanded', () => {
    const s = bigScenario(AUTO_COLLAPSE_NODE_THRESHOLD);
    expect(defaultCollapsedGroupIds({ groupModel: s.groupModel, selectedId: 'n0' }).size).toBe(0);
  });

  it('collapses every group except the selected one, neighbours included', () => {
    const s = bigScenario(AUTO_COLLAPSE_NODE_THRESHOLD + 8);
    // n3 is the last node of d0; its neighbour n4 sits in d1.
    const collapsed = defaultCollapsedGroupIds({ groupModel: s.groupModel, selectedId: 'n3' });

    expect(collapsed.has('inner:proj/d0')).toBe(false);
    expect(collapsed.has('inner:proj/d1')).toBe(true);
    expect(collapsed.size).toBe(s.groupModel.groups.filter((g) => g.kind === 'inner').length - 1);
  });

  it('reduces a dense graph to a handful of drawn edges', () => {
    const s = bigScenario(AUTO_COLLAPSE_NODE_THRESHOLD + 8);
    const collapsed = defaultCollapsedGroupIds({ groupModel: s.groupModel, selectedId: 'n3' });
    const result = collapse(s, [...collapsed], 'n3');

    expect(result.displayEdges.length).toBeLessThan(s.edges.length / 2);
    expect(totalCount(result)).toBe(s.edges.length);
  });
});

describe('summaryNodeId and isSummaryNodeId', () => {
  it('round-trips and does not match real ids', () => {
    expect(isSummaryNodeId(summaryNodeId('inner:p/d'))).toBe(true);
    expect(isSummaryNodeId('model.pkg.orders')).toBe(false);
  });
});

describe('summaryPlaceholders', () => {
  function layoutAt(id: string, x: number, y: number): [string, LineageGraphNodeLayout] {
    return [
      id,
      {
        resource: resource(id, null),
        x,
        y,
        column: 0,
        depth: 0,
        side: 'upstream',
        passCount: 0,
        failCount: 0,
        notExecutedCount: 0,
        skippedCount: 0,
      },
    ];
  }

  it('uses a member column and the mean member y', () => {
    const { summaries } = collapse(SMALL, [RAW]);
    const layouts = new Map([layoutAt('a', 100, 40), layoutAt('b', 40, 120), layoutAt('c', 0, 0)]);

    // Two members: the lower median column is 40.
    expect(summaryPlaceholders(summaries, layouts)).toEqual([
      { id: summaryNodeId(RAW), groupId: RAW, x: 40, y: 80 },
    ]);
  });

  it('picks the middle column of a group spanning three columns', () => {
    const s = scenario({ a: ['p', 'g'], b: ['p', 'g'], c: ['p', 'g'], sel: ['p', 'sel'] }, [
      { from: 'a', to: 'sel' },
    ]);
    const { summaries } = collapse(s, ['inner:p/g'], 'sel');
    const layouts = new Map([layoutAt('a', 300, 0), layoutAt('b', 20, 0), layoutAt('c', 160, 0)]);

    expect(summaryPlaceholders(summaries, layouts)[0]?.x).toBe(160);
  });

  it('skips a summary with no laid-out members', () => {
    const { summaries } = collapse(SMALL, [RAW]);
    expect(summaryPlaceholders(summaries, new Map())).toEqual([]);
  });
});
