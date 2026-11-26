import { describe, expect, it } from 'vitest';

import {
  NO_WAREHOUSE_GROUP_ID,
  buildLineageGroupModel,
  edgeCrossingKey,
  lineageNodeLabel,
} from '@web/lib/analysis-workspace/lineage-grouping';
import { bigQueryLocation } from '@web/lib/analysis-workspace/lineage-test-fixtures';

import type { ResourceNode, WarehouseLocation } from '@dbt-tools/core/browser';

function sparkLocation(schema: string): WarehouseLocation {
  return { levels: [{ kind: 'schema', label: 'Schema', name: schema }], relation: null };
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

function resourcesOf(entries: Array<[string, WarehouseLocation | null | undefined]>) {
  return new Map(
    entries.map(([id, location]): [string, ResourceNode] => [id, resource(id, location)]),
  );
}

function groupIds(model: ReturnType<typeof buildLineageGroupModel>): string[] {
  return model.groups.map((g) => g.id);
}

describe('buildLineageGroupModel', () => {
  it('nests one inner group under its outer project', () => {
    const model = buildLineageGroupModel({
      nodeIds: ['m.b', 'm.a'],
      resourceById: resourcesOf([
        ['m.a', bigQueryLocation('proj', 'marts')],
        ['m.b', bigQueryLocation('proj', 'marts')],
      ]),
      edges: [{ from: 'm.a', to: 'm.b' }],
    });

    expect(groupIds(model)).toEqual(['outer:proj', 'inner:proj/marts']);
    expect(model.groups[0]).toMatchObject({
      kind: 'outer',
      label: 'proj',
      levelLabel: 'Project',
      parentId: null,
      childGroupIds: ['inner:proj/marts'],
      nodeIds: [],
    });
    expect(model.groups[1]).toMatchObject({
      kind: 'inner',
      label: 'marts',
      levelLabel: 'Dataset',
      parentId: 'outer:proj',
      nodeIds: ['m.a', 'm.b'],
    });
    expect(model.rootGroupIds).toEqual(['outer:proj']);
    expect(model.edgeCrossings.get(edgeCrossingKey('m.a', 'm.b'))).toBe('none');
    expect(model.crossingCounts).toEqual({ inner: 0, outer: 0 });
  });

  it('splits two datasets under one project into inner groups and flags an inner crossing', () => {
    const model = buildLineageGroupModel({
      nodeIds: ['m.raw', 'm.marts'],
      resourceById: resourcesOf([
        ['m.raw', bigQueryLocation('proj', 'raw')],
        ['m.marts', bigQueryLocation('proj', 'marts')],
      ]),
      edges: [{ from: 'm.raw', to: 'm.marts' }],
    });

    expect(model.groups.find((g) => g.id === 'outer:proj')?.childGroupIds).toEqual([
      'inner:proj/marts',
      'inner:proj/raw',
    ]);
    expect(model.groupIdByNodeId.get('m.raw')).toBe('inner:proj/raw');
    expect(model.groupIdByNodeId.get('m.marts')).toBe('inner:proj/marts');
    expect(model.edgeCrossings.get(edgeCrossingKey('m.raw', 'm.marts'))).toBe('inner');
    expect(model.crossingCounts).toEqual({ inner: 1, outer: 0 });
  });

  it('flags a cross-project edge as an outer crossing and orders outer groups by label', () => {
    const model = buildLineageGroupModel({
      nodeIds: ['m.billing', 'm.analytics'],
      resourceById: resourcesOf([
        ['m.billing', bigQueryLocation('zeta-project', 'marts')],
        ['m.analytics', bigQueryLocation('alpha-project', 'marts')],
      ]),
      edges: [{ from: 'm.billing', to: 'm.analytics' }],
    });

    expect(groupIds(model)).toEqual([
      'outer:alpha-project',
      'inner:alpha-project/marts',
      'outer:zeta-project',
      'inner:zeta-project/marts',
    ]);
    expect(model.rootGroupIds).toEqual(['outer:alpha-project', 'outer:zeta-project']);
    expect(model.edgeCrossings.get(edgeCrossingKey('m.billing', 'm.analytics'))).toBe('outer');
    expect(model.crossingCounts).toEqual({ inner: 0, outer: 1 });
  });

  it('treats the same dataset name in different projects as distinct inner groups', () => {
    const model = buildLineageGroupModel({
      nodeIds: ['m.a', 'm.b'],
      resourceById: resourcesOf([
        ['m.a', bigQueryLocation('proj-a', 'marts')],
        ['m.b', bigQueryLocation('proj-b', 'marts')],
      ]),
      edges: [{ from: 'm.a', to: 'm.b' }],
    });

    expect(model.groupIdByNodeId.get('m.a')).toBe('inner:proj-a/marts');
    expect(model.groupIdByNodeId.get('m.b')).toBe('inner:proj-b/marts');
    expect(model.groups.filter((g) => g.kind === 'inner')).toHaveLength(2);
    expect(model.edgeCrossings.get(edgeCrossingKey('m.a', 'm.b'))).toBe('outer');
  });

  it('builds a root-level inner group for a single-level (spark) location', () => {
    const model = buildLineageGroupModel({
      nodeIds: ['m.a', 'm.b'],
      resourceById: resourcesOf([
        ['m.a', sparkLocation('marts')],
        ['m.b', sparkLocation('raw')],
      ]),
      edges: [{ from: 'm.a', to: 'm.b' }],
    });

    expect(groupIds(model)).toEqual(['inner:marts', 'inner:raw']);
    expect(model.groups[0]).toMatchObject({ kind: 'inner', parentId: null, levelLabel: 'Schema' });
    expect(model.rootGroupIds).toEqual(['inner:marts', 'inner:raw']);
    expect(model.edgeCrossings.get(edgeCrossingKey('m.a', 'm.b'))).toBe('inner');
    expect(model.crossingCounts).toEqual({ inner: 1, outer: 0 });
  });

  it('puts resources without a warehouse location in the last lane and never counts their edges', () => {
    const model = buildLineageGroupModel({
      nodeIds: ['exposure.x', 'm.a', 'model.eph'],
      resourceById: resourcesOf([
        ['exposure.x', null],
        ['m.a', bigQueryLocation('proj', 'marts')],
        ['model.eph', undefined],
      ]),
      edges: [
        { from: 'm.a', to: 'exposure.x' },
        { from: 'model.eph', to: 'm.a' },
      ],
    });

    const lane = model.groups[model.groups.length - 1];
    expect(lane).toMatchObject({
      id: NO_WAREHOUSE_GROUP_ID,
      kind: 'lane',
      label: 'Not in warehouse',
      levelLabel: 'Outside warehouse',
      parentId: null,
      nodeIds: ['exposure.x', 'model.eph'],
    });
    expect(model.groupIdByNodeId.get('exposure.x')).toBe(NO_WAREHOUSE_GROUP_ID);
    expect(model.groupIdByNodeId.get('model.eph')).toBe(NO_WAREHOUSE_GROUP_ID);
    expect(model.edgeCrossings.get(edgeCrossingKey('m.a', 'exposure.x'))).toBe('none');
    expect(model.edgeCrossings.get(edgeCrossingKey('model.eph', 'm.a'))).toBe('none');
    expect(model.crossingCounts).toEqual({ inner: 0, outer: 0 });
  });

  it('omits the lane group when every node is in a warehouse container', () => {
    const model = buildLineageGroupModel({
      nodeIds: ['m.a'],
      resourceById: resourcesOf([['m.a', sparkLocation('marts')]]),
      edges: [],
    });

    expect(model.groups.some((g) => g.kind === 'lane')).toBe(false);
  });

  it('maps every input node id to its innermost group', () => {
    const nodeIds = ['m.a', 'm.b', 'exposure.x'];
    const model = buildLineageGroupModel({
      nodeIds,
      resourceById: resourcesOf([
        ['m.a', bigQueryLocation('proj', 'marts')],
        ['m.b', bigQueryLocation('proj', 'raw')],
        ['exposure.x', null],
      ]),
      edges: [],
    });

    for (const nodeId of nodeIds) {
      expect(model.groupIdByNodeId.has(nodeId)).toBe(true);
    }
    expect(model.groupIdByNodeId.size).toBe(nodeIds.length);
  });

  it('keeps every unique input edge and never adds or drops one', () => {
    const edges = [
      { from: 'm.a', to: 'm.b' },
      { from: 'm.b', to: 'm.a' },
      { from: 'm.a', to: 'm.c' },
      { from: 'm.a', to: 'm.b' },
      { from: 'exposure.x', to: 'm.a' },
    ];
    const model = buildLineageGroupModel({
      nodeIds: ['m.a', 'm.b', 'm.c', 'exposure.x'],
      resourceById: resourcesOf([
        ['m.a', bigQueryLocation('proj-a', 'marts')],
        ['m.b', bigQueryLocation('proj-b', 'marts')],
        ['m.c', bigQueryLocation('proj-a', 'raw')],
        ['exposure.x', null],
      ]),
      edges,
    });

    const uniqueKeys = new Set(edges.map((e) => edgeCrossingKey(e.from, e.to)));
    expect(model.edgeCrossings.size).toBe(uniqueKeys.size);
    for (const key of uniqueKeys) {
      expect(model.edgeCrossings.has(key)).toBe(true);
    }
    const counted = model.crossingCounts.inner + model.crossingCounts.outer;
    const nonNone = [...model.edgeCrossings.values()].filter((t) => t !== 'none').length;
    expect(counted).toBe(nonNone);
  });

  it('produces the same model regardless of input order', () => {
    const resourceById = resourcesOf([
      ['m.a', bigQueryLocation('proj-b', 'marts')],
      ['m.b', bigQueryLocation('proj-a', 'raw')],
      ['m.c', bigQueryLocation('proj-a', 'marts')],
      ['exposure.x', null],
    ]);
    const edges = [
      { from: 'm.a', to: 'm.b' },
      { from: 'm.c', to: 'm.b' },
      { from: 'm.b', to: 'exposure.x' },
    ];

    const forward = buildLineageGroupModel({
      nodeIds: ['m.a', 'm.b', 'm.c', 'exposure.x'],
      resourceById,
      edges,
    });
    const reversed = buildLineageGroupModel({
      nodeIds: ['exposure.x', 'm.c', 'm.b', 'm.a'],
      resourceById,
      edges: [...edges].reverse(),
    });

    expect(reversed.groups).toEqual(forward.groups);
    expect(reversed.rootGroupIds).toEqual(forward.rootGroupIds);
    expect(reversed.crossingCounts).toEqual(forward.crossingCounts);
    expect(reversed.edgeCrossings).toEqual(forward.edgeCrossings);
  });
});

describe('lineageNodeLabel', () => {
  const located = bigQueryLocation('proj', 'marts', 'orders');

  it('uses the relation in grouped mode and the dbt name otherwise', () => {
    const node = resource('model.pkg.proj__marts___orders', located);
    expect(lineageNodeLabel(node, true)).toBe('orders');
    expect(lineageNodeLabel(node, false)).toBe('model.pkg.proj__marts___orders');
  });

  it('falls back to the dbt name when there is no relation or location', () => {
    expect(lineageNodeLabel(resource('exposure.pkg.dash', null), true)).toBe('exposure.pkg.dash');
    expect(lineageNodeLabel(resource('m', bigQueryLocation('p', 'd')), true)).toBe('m');
  });
});
