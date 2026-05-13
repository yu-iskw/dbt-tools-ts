import type { GanttItem, TimelineAdjacencyEntry } from '@web/types';
import type { BundleRow } from '@web/lib/analysis-workspace/bundleLayout';
import { describe, expect, it } from 'vitest';
import {
  applyNeighborCap,
  applyUpstreamCap,
  collectTimelineNeighborhoodIds,
  resolveTimelineNeighborhoodFocusId,
  countInboundInAdjacency,
  countInboundOnTimeline,
  countOutboundInAdjacency,
  countOutboundOnTimeline,
  focusEdgePath,
  getFocusTimelineEdges,
  parcelCenterY,
  rankInboundNeighborIds,
  rankOutboundNeighborIds,
} from './edgeGeometry';
import {
  AXIS_TOP,
  ROW_H,
  TIMELINE_EXTENDED_MAX_EDGES_PER_DIRECTION,
  TIMELINE_EXTENDED_MAX_HOPS,
  TIMELINE_MAX_DOWNSTREAM_EDGES,
  TIMELINE_MAX_UPSTREAM_EDGES,
} from './constants';

const fullUpstreamOpts = {
  includeUpstream: true,
  includeDownstream: false,
  showAllUpstream: true,
  maxUpstreamEdges: TIMELINE_MAX_UPSTREAM_EDGES,
  showAllDownstream: true,
  maxDownstreamEdges: TIMELINE_MAX_DOWNSTREAM_EDGES,
} as const;

function model(id: string, start = 0, end = 1000, resourceType = 'model'): GanttItem {
  return {
    unique_id: id,
    name: id,
    start,
    end,
    duration: end - start,
    status: 'success',
    resourceType,
    packageName: 'pkg',
    path: null,
    parentId: null,
  };
}

function test(id: string, parentId: string, start = 100, end = 200): GanttItem {
  return {
    unique_id: id,
    name: id,
    start,
    end,
    duration: end - start,
    status: 'pass',
    resourceType: 'test',
    packageName: 'pkg',
    path: null,
    parentId,
  };
}

function makeBundle(parent: GanttItem, tests: GanttItem[]): BundleRow {
  const lanes = tests.map((t, i) => ({ item: t, lane: i }));
  return {
    item: parent,
    tests,
    lanes,
    laneCount: tests.length,
  };
}

describe('rankInboundNeighborIds', () => {
  it('orders sibling tests before primary upstream', () => {
    const m = model('model.p');
    const t1 = test('test.t1', 'model.p');
    const t2 = test('test.t2', 'model.p', 300, 400);
    const itemById = new Map([m, t1, t2].map((i) => [i.unique_id, i]));
    const ranked = rankInboundNeighborIds(['model.p', 'test.t1'], t2, itemById);
    expect(ranked[0]).toBe('test.t1');
    expect(ranked[1]).toBe('model.p');
  });

  it('uses resource type before temporal tie-break', () => {
    const src = model('source.x', 0, 50, 'source');
    const m = model('model.x', 0, 200);
    const focus = model('model.f', 500, 600);
    const itemById = new Map([src, m, focus].map((i) => [i.unique_id, i]));
    const ranked = rankInboundNeighborIds(['model.x', 'source.x'], focus, itemById);
    expect(ranked[0]).toBe('model.x');
    expect(ranked[1]).toBe('source.x');
  });
});

describe('applyUpstreamCap', () => {
  it('returns all when showAllUpstream', () => {
    const ids = ['a', 'b', 'c'];
    expect(applyUpstreamCap(ids, true, 2)).toEqual(ids);
  });

  it('slices when over max', () => {
    expect(applyUpstreamCap(['a', 'b', 'c', 'd'], false, 2)).toEqual(['a', 'b']);
  });
});

describe('applyNeighborCap', () => {
  it('matches upstream cap semantics', () => {
    expect(applyNeighborCap(['a', 'b', 'c'], true, 1)).toEqual(['a', 'b', 'c']);
    expect(applyNeighborCap(['a', 'b', 'c'], false, 2)).toEqual(['a', 'b']);
  });
});

describe('countInboundOnTimeline', () => {
  it('counts only ids present in bundleIndexById', () => {
    const adj: Record<string, TimelineAdjacencyEntry> = {
      x: { inbound: ['a', 'b', 'missing'], outbound: [] },
    };
    const idx = new Map([
      ['a', 0],
      ['b', 1],
    ]);
    expect(countInboundOnTimeline('x', adj, idx)).toBe(2);
  });
});

describe('countOutboundOnTimeline', () => {
  it('counts only ids present in bundleIndexById', () => {
    const adj: Record<string, TimelineAdjacencyEntry> = {
      x: { inbound: [], outbound: ['a', 'b', 'gone'] },
    };
    const idx = new Map([
      ['a', 0],
      ['b', 1],
    ]);
    expect(countOutboundOnTimeline('x', adj, idx)).toBe(2);
  });
});

describe('countInboundInAdjacency', () => {
  it('returns inbound list length', () => {
    const adj: Record<string, TimelineAdjacencyEntry> = {
      x: { inbound: ['a', 'b', 'missing'], outbound: [] },
    };
    expect(countInboundInAdjacency('x', adj)).toBe(3);
    expect(countInboundInAdjacency(null, adj)).toBe(0);
  });
});

describe('countOutboundInAdjacency', () => {
  it('returns outbound list length', () => {
    const adj: Record<string, TimelineAdjacencyEntry> = {
      x: { inbound: [], outbound: ['a', 'b'] },
    };
    expect(countOutboundInAdjacency('x', adj)).toBe(2);
  });
});

describe('rankOutboundNeighborIds', () => {
  it('uses resource type before temporal tie-break', () => {
    const focus = model('model.f', 0, 100);
    const src = model('source.x', 500, 600, 'source');
    const m = model('model.x', 200, 300);
    const itemById = new Map([focus, src, m].map((i) => [i.unique_id, i]));
    const ranked = rankOutboundNeighborIds(['source.x', 'model.x'], focus, itemById);
    expect(ranked[0]).toBe('model.x');
    expect(ranked[1]).toBe('source.x');
  });
});

describe('getFocusTimelineEdges', () => {
  it('returns empty when focusId is null', () => {
    const itemById = new Map<string, GanttItem>();
    const bundleIndexById = new Map<string, number>();
    expect(
      getFocusTimelineEdges(null, {}, itemById, bundleIndexById, {
        includeUpstream: true,
        includeDownstream: false,
        showAllUpstream: true,
        maxUpstreamEdges: TIMELINE_MAX_UPSTREAM_EDGES,
        showAllDownstream: false,
        maxDownstreamEdges: TIMELINE_MAX_DOWNSTREAM_EDGES,
      }).edges,
    ).toEqual([]);
  });

  it('emits primary inbound edges to focus and optional downstream', () => {
    const m1 = model('model.a');
    const m2 = model('model.b', 500, 1500);
    const rel = test('test.rel', 'model.a', 200, 400);
    const items = [m1, m2, rel];
    const itemById = new Map(items.map((i) => [i.unique_id, i]));
    const bundleIndexById = new Map<string, number>([
      ['model.a', 0],
      ['test.rel', 0],
      ['model.b', 1],
    ]);

    const timelineAdjacency: Record<string, TimelineAdjacencyEntry> = {
      'test.rel': {
        inbound: ['model.a', 'model.b'],
        outbound: ['model.c'],
      },
    };

    const up = getFocusTimelineEdges('test.rel', timelineAdjacency, itemById, bundleIndexById, {
      ...fullUpstreamOpts,
      includeDownstream: false,
    }).edges;
    expect(up).toHaveLength(2);
    expect(up).toContainEqual({
      fromId: 'model.a',
      toId: 'test.rel',
      tier: 'primary',
      hop: 1,
      leg: 'upstream',
    });
    expect(up).toContainEqual({
      fromId: 'model.b',
      toId: 'test.rel',
      tier: 'primary',
      hop: 1,
      leg: 'upstream',
    });

    const withDown = getFocusTimelineEdges(
      'test.rel',
      timelineAdjacency,
      itemById,
      bundleIndexById,
      { ...fullUpstreamOpts, includeDownstream: true },
    ).edges;
    expect(withDown.some((e) => e.tier === 'downstream')).toBe(false);

    const idx = new Map<string, number>([
      ['model.a', 0],
      ['test.rel', 0],
      ['model.b', 1],
      ['model.c', 2],
    ]);
    const withC = getFocusTimelineEdges('test.rel', timelineAdjacency, itemById, idx, {
      ...fullUpstreamOpts,
      includeDownstream: true,
    }).edges;
    expect(withC).toContainEqual({
      fromId: 'test.rel',
      toId: 'model.c',
      tier: 'downstream',
      hop: 1,
      leg: 'downstream',
    });
  });

  it('classifies sibling tests as secondary', () => {
    const m = model('model.p');
    const t1 = test('test.t1', 'model.p');
    const t2 = test('test.t2', 'model.p', 300, 400);
    const items = [m, t1, t2];
    const itemById = new Map(items.map((i) => [i.unique_id, i]));
    const bundleIndexById = new Map<string, number>([
      ['model.p', 0],
      ['test.t1', 0],
      ['test.t2', 0],
    ]);

    const timelineAdjacency: Record<string, TimelineAdjacencyEntry> = {
      'test.t2': { inbound: ['test.t1', 'model.p'], outbound: [] },
    };

    const edges = getFocusTimelineEdges(
      'test.t2',
      timelineAdjacency,
      itemById,
      bundleIndexById,
      fullUpstreamOpts,
    ).edges;
    expect(edges).toContainEqual({
      fromId: 'test.t1',
      toId: 'test.t2',
      tier: 'secondary',
      hop: 1,
      leg: 'upstream',
    });
    expect(edges).toContainEqual({
      fromId: 'model.p',
      toId: 'test.t2',
      tier: 'primary',
      hop: 1,
      leg: 'upstream',
    });
  });

  it('caps upstream edges in compact mode', () => {
    const focus = model('model.focus', 5000, 6000);
    const inboundIds: string[] = [];
    const items: GanttItem[] = [focus];
    for (let i = 0; i < 12; i++) {
      const id = `model.up${i}`;
      inboundIds.push(id);
      items.push(model(id, i * 10, i * 10 + 5));
    }
    const itemById = new Map(items.map((x) => [x.unique_id, x]));
    const bundleIndexById = new Map(items.map((x, i) => [x.unique_id, i]));

    const timelineAdjacency: Record<string, TimelineAdjacencyEntry> = {
      'model.focus': { inbound: inboundIds, outbound: [] },
    };

    const compact = getFocusTimelineEdges(
      'model.focus',
      timelineAdjacency,
      itemById,
      bundleIndexById,
      {
        includeUpstream: true,
        includeDownstream: false,
        showAllUpstream: false,
        maxUpstreamEdges: 8,
        showAllDownstream: false,
        maxDownstreamEdges: TIMELINE_MAX_DOWNSTREAM_EDGES,
      },
    ).edges;
    expect(compact.filter((e) => e.hop === 1 && e.leg === 'upstream')).toHaveLength(8);

    const full = getFocusTimelineEdges(
      'model.focus',
      timelineAdjacency,
      itemById,
      bundleIndexById,
      {
        includeUpstream: true,
        includeDownstream: false,
        showAllUpstream: true,
        maxUpstreamEdges: 8,
        showAllDownstream: false,
        maxDownstreamEdges: TIMELINE_MAX_DOWNSTREAM_EDGES,
      },
    ).edges;
    expect(full.filter((e) => e.hop === 1 && e.leg === 'upstream')).toHaveLength(12);
  });

  it('caps downstream edges in compact mode', () => {
    const focus = model('model.focus', 0, 100);
    const outboundIds: string[] = [];
    const items: GanttItem[] = [focus];
    for (let i = 0; i < 12; i++) {
      const id = `model.down${i}`;
      outboundIds.push(id);
      items.push(model(id, 500 + i * 10, 600 + i * 10));
    }
    const itemById = new Map(items.map((x) => [x.unique_id, x]));
    const bundleIndexById = new Map(items.map((x, i) => [x.unique_id, i]));

    const timelineAdjacency: Record<string, TimelineAdjacencyEntry> = {
      'model.focus': { inbound: [], outbound: outboundIds },
    };

    const compact = getFocusTimelineEdges(
      'model.focus',
      timelineAdjacency,
      itemById,
      bundleIndexById,
      {
        includeUpstream: true,
        includeDownstream: true,
        showAllUpstream: true,
        maxUpstreamEdges: TIMELINE_MAX_UPSTREAM_EDGES,
        showAllDownstream: false,
        maxDownstreamEdges: 8,
      },
    ).edges;
    expect(compact.filter((e) => e.hop === 1 && e.leg === 'downstream')).toHaveLength(8);

    const full = getFocusTimelineEdges(
      'model.focus',
      timelineAdjacency,
      itemById,
      bundleIndexById,
      {
        includeUpstream: true,
        includeDownstream: true,
        showAllUpstream: true,
        maxUpstreamEdges: TIMELINE_MAX_UPSTREAM_EDGES,
        showAllDownstream: true,
        maxDownstreamEdges: 8,
      },
    ).edges;
    expect(full.filter((e) => e.hop === 1 && e.leg === 'downstream')).toHaveLength(12);
  });

  it('adds hop-2 upstream and downstream when extendedDeps is enabled', () => {
    const a = model('model.a', 0, 50);
    const b = model('model.b', 60, 120);
    const focus = model('model.focus', 200, 300);
    const c = model('model.c', 400, 450);
    const d = model('model.d', 500, 600);
    const items = [a, b, focus, c, d];
    const itemById = new Map(items.map((i) => [i.unique_id, i]));
    const bundleIndexById = new Map(items.map((x, i) => [x.unique_id, i]));

    const timelineAdjacency: Record<string, TimelineAdjacencyEntry> = {
      'model.focus': { inbound: ['model.b'], outbound: ['model.c'] },
      'model.b': { inbound: ['model.a'], outbound: ['model.focus'] },
      'model.a': { inbound: [], outbound: ['model.b'] },
      'model.c': { inbound: ['model.focus'], outbound: ['model.d'] },
      'model.d': { inbound: ['model.c'], outbound: [] },
    };

    const { edges, extendedTruncated } = getFocusTimelineEdges(
      'model.focus',
      timelineAdjacency,
      itemById,
      bundleIndexById,
      {
        includeUpstream: true,
        includeDownstream: true,
        showAllUpstream: true,
        maxUpstreamEdges: TIMELINE_MAX_UPSTREAM_EDGES,
        showAllDownstream: true,
        maxDownstreamEdges: TIMELINE_MAX_DOWNSTREAM_EDGES,
        extendedDeps: {
          enabled: true,
          maxHops: TIMELINE_EXTENDED_MAX_HOPS,
          maxEdgesPerDirection: TIMELINE_EXTENDED_MAX_EDGES_PER_DIRECTION,
        },
      },
    );

    expect(extendedTruncated).toBe(false);
    expect(edges).toContainEqual({
      fromId: 'model.a',
      toId: 'model.b',
      tier: 'primary',
      hop: 2,
      leg: 'upstream',
    });
    expect(edges).toContainEqual({
      fromId: 'model.b',
      toId: 'model.focus',
      tier: 'primary',
      hop: 1,
      leg: 'upstream',
    });
    expect(edges).toContainEqual({
      fromId: 'model.focus',
      toId: 'model.c',
      tier: 'downstream',
      hop: 1,
      leg: 'downstream',
    });
    expect(edges).toContainEqual({
      fromId: 'model.c',
      toId: 'model.d',
      tier: 'downstream',
      hop: 2,
      leg: 'downstream',
    });
  });

  it('suppresses upstream edges when includeUpstream is false', () => {
    const up = model('model.up');
    const focus = model('model.focus', 200, 300);
    const down = model('model.down', 400, 450);
    const items = [up, focus, down];
    const itemById = new Map(items.map((i) => [i.unique_id, i]));
    const bundleIndexById = new Map(items.map((x, i) => [x.unique_id, i]));
    const timelineAdjacency: Record<string, TimelineAdjacencyEntry> = {
      'model.focus': { inbound: ['model.up'], outbound: ['model.down'] },
      'model.up': { inbound: [], outbound: ['model.focus'] },
      'model.down': { inbound: ['model.focus'], outbound: [] },
    };

    const { edges } = getFocusTimelineEdges(
      'model.focus',
      timelineAdjacency,
      itemById,
      bundleIndexById,
      {
        includeUpstream: false,
        includeDownstream: true,
        showAllUpstream: true,
        maxUpstreamEdges: TIMELINE_MAX_UPSTREAM_EDGES,
        showAllDownstream: true,
        maxDownstreamEdges: TIMELINE_MAX_DOWNSTREAM_EDGES,
        extendedDeps: {
          enabled: true,
          maxHops: TIMELINE_EXTENDED_MAX_HOPS,
          maxEdgesPerDirection: TIMELINE_EXTENDED_MAX_EDGES_PER_DIRECTION,
        },
      },
    );

    expect(edges.some((edge) => edge.leg === 'upstream')).toBe(false);
    expect(edges).toContainEqual({
      fromId: 'model.focus',
      toId: 'model.down',
      tier: 'downstream',
      hop: 1,
      leg: 'downstream',
    });
  });

  it('disables extended edges when extendedDeps.enabled is false', () => {
    const a = model('model.a', 0, 50);
    const b = model('model.b', 60, 120);
    const focus = model('model.focus', 200, 300);
    const items = [a, b, focus];
    const itemById = new Map(items.map((i) => [i.unique_id, i]));
    const bundleIndexById = new Map(items.map((x, i) => [x.unique_id, i]));
    const timelineAdjacency: Record<string, TimelineAdjacencyEntry> = {
      'model.focus': { inbound: ['model.b'], outbound: [] },
      'model.b': { inbound: ['model.a'], outbound: ['model.focus'] },
      'model.a': { inbound: [], outbound: ['model.b'] },
    };

    const { edges } = getFocusTimelineEdges(
      'model.focus',
      timelineAdjacency,
      itemById,
      bundleIndexById,
      {
        includeUpstream: true,
        includeDownstream: false,
        showAllUpstream: true,
        maxUpstreamEdges: TIMELINE_MAX_UPSTREAM_EDGES,
        showAllDownstream: true,
        maxDownstreamEdges: TIMELINE_MAX_DOWNSTREAM_EDGES,
        extendedDeps: { enabled: false },
      },
    );

    expect(edges.every((edge) => edge.hop === 1)).toBe(true);
  });
});

describe('parcelCenterY and focusEdgePath', () => {
  it('places parent bar center in row coordinates', () => {
    const m = model('m.x');
    const bundles = [makeBundle(m, [])];
    const rowOffsets = [0];
    const y = parcelCenterY(0, 'm.x', bundles, rowOffsets, 0, true);
    expect(y).toBe(AXIS_TOP + 6 + 7);
  });

  it('places test chip center when showTests', () => {
    const m = model('m.x');
    const t = test('t.x', 'm.x');
    const bundles = [makeBundle(m, [t])];
    const rowOffsets = [0];
    const y = parcelCenterY(0, 't.x', bundles, rowOffsets, 0, true);
    const expectedChipTop = AXIS_TOP + ROW_H + 5;
    expect(y).toBe(expectedChipTop + 5);
  });

  it('builds a cubic path between two parcels', () => {
    const a = model('a', 0, 100);
    const b = model('b', 200, 300);
    const itemById = new Map([
      [a.unique_id, a],
      [b.unique_id, b],
    ]);
    const bundleIndexById = new Map([
      [a.unique_id, 0],
      [b.unique_id, 1],
    ]);
    const bundles = [makeBundle(a, []), makeBundle(b, [])];
    const rowOffsets = [0, ROW_H];

    const d = focusEdgePath({
      edge: {
        fromId: 'a',
        toId: 'b',
        tier: 'primary',
        hop: 1,
        leg: 'upstream',
      },
      itemById,
      bundleIndexById,
      bundles,
      rowOffsets,
      scrollTop: 0,
      showTests: true,
      effectiveLabelW: 100,
      rangeStart: 0,
      rangeEnd: 500,
      chartW: 400,
    });
    expect(d.startsWith('M')).toBe(true);
    expect(d.includes('C')).toBe(true);
  });
});

describe('resolveTimelineNeighborhoodFocusId', () => {
  const parent = model('model.p');
  const t = test('test.t1', 'model.p');

  it('returns parent id when selection is a test in candidates', () => {
    const itemById = new Map([
      [parent.unique_id, parent],
      [t.unique_id, t],
    ]);
    const candidates = new Set([parent.unique_id]);
    expect(resolveTimelineNeighborhoodFocusId(t.unique_id, candidates, itemById)).toBe(
      parent.unique_id,
    );
  });

  it('returns selected id when it is already a parent candidate', () => {
    const itemById = new Map([[parent.unique_id, parent]]);
    const candidates = new Set([parent.unique_id]);
    expect(resolveTimelineNeighborhoodFocusId(parent.unique_id, candidates, itemById)).toBe(
      parent.unique_id,
    );
  });

  it('returns null when test parent is missing from candidates', () => {
    const itemById = new Map([[t.unique_id, t]]);
    const candidates = new Set<string>();
    expect(resolveTimelineNeighborhoodFocusId(t.unique_id, candidates, itemById)).toBeNull();
  });

  it('returns null for unknown selection id', () => {
    expect(
      resolveTimelineNeighborhoodFocusId('missing', new Set([parent.unique_id]), new Map()),
    ).toBeNull();
  });
});

describe('collectTimelineNeighborhoodIds', () => {
  const chainAdj: Record<string, TimelineAdjacencyEntry> = {
    a: { inbound: [], outbound: ['b'] },
    b: { inbound: ['a'], outbound: ['c'] },
    c: { inbound: ['b'], outbound: [] },
  };
  const candidates = new Set(['a', 'b', 'c']);

  it('returns all candidates when focus is null', () => {
    const set = collectTimelineNeighborhoodIds({
      focusId: null,
      timelineAdjacency: chainAdj,
      candidateIds: candidates,
      dependencyDirection: 'both',
      dependencyDepthHops: 2,
    });
    expect(set).toEqual(new Set(candidates));
  });

  it('returns all candidates when timelineAdjacency is undefined', () => {
    const set = collectTimelineNeighborhoodIds({
      focusId: 'b',
      timelineAdjacency: undefined,
      candidateIds: candidates,
      dependencyDirection: 'both',
      dependencyDepthHops: 2,
    });
    expect(set).toEqual(new Set(candidates));
  });

  it('returns all candidates when focus is not in candidateIds', () => {
    const subset = new Set(['a', 'c']);
    const set = collectTimelineNeighborhoodIds({
      focusId: 'b',
      timelineAdjacency: chainAdj,
      candidateIds: subset,
      dependencyDirection: 'both',
      dependencyDepthHops: 2,
    });
    expect(set).toEqual(subset);
  });

  it('returns all candidates when focus has no adjacency entry', () => {
    const cand = new Set(['orphan', 'a']);
    const set = collectTimelineNeighborhoodIds({
      focusId: 'orphan',
      timelineAdjacency: chainAdj,
      candidateIds: cand,
      dependencyDirection: 'both',
      dependencyDepthHops: 2,
    });
    expect(set).toEqual(cand);
  });

  it('expands upstream one hop from center', () => {
    const set = collectTimelineNeighborhoodIds({
      focusId: 'b',
      timelineAdjacency: chainAdj,
      candidateIds: candidates,
      dependencyDirection: 'upstream',
      dependencyDepthHops: 1,
    });
    expect([...set].sort()).toEqual(['a', 'b']);
  });

  it('expands downstream one hop from center', () => {
    const set = collectTimelineNeighborhoodIds({
      focusId: 'b',
      timelineAdjacency: chainAdj,
      candidateIds: candidates,
      dependencyDirection: 'downstream',
      dependencyDepthHops: 1,
    });
    expect([...set].sort()).toEqual(['b', 'c']);
  });

  it('unions both directions through full chain at sufficient depth', () => {
    const set = collectTimelineNeighborhoodIds({
      focusId: 'b',
      timelineAdjacency: chainAdj,
      candidateIds: candidates,
      dependencyDirection: 'both',
      dependencyDepthHops: 2,
    });
    expect([...set].sort()).toEqual(['a', 'b', 'c']);
  });

  it('respects hop limit for longer chains', () => {
    const long: Record<string, TimelineAdjacencyEntry> = {
      a: { inbound: [], outbound: ['b'] },
      b: { inbound: ['a'], outbound: ['c'] },
      c: { inbound: ['b'], outbound: ['d'] },
      d: { inbound: ['c'], outbound: [] },
    };
    const longCand = new Set(['a', 'b', 'c', 'd']);
    const one = collectTimelineNeighborhoodIds({
      focusId: 'b',
      timelineAdjacency: long,
      candidateIds: longCand,
      dependencyDirection: 'both',
      dependencyDepthHops: 1,
    });
    expect([...one].sort()).toEqual(['a', 'b', 'c']);

    const two = collectTimelineNeighborhoodIds({
      focusId: 'b',
      timelineAdjacency: long,
      candidateIds: longCand,
      dependencyDirection: 'both',
      dependencyDepthHops: 2,
    });
    expect([...two].sort()).toEqual(['a', 'b', 'c', 'd']);
  });
});
