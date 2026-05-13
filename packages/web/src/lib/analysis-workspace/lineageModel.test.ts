import { describe, it, expect } from 'vitest';
import type { ResourceNode } from '@web/types';
import {
  STATUS_LENS_FILLS,
  TYPE_LENS_SOLID,
  TYPE_LENS_FILLS,
  buildLineageGraphModel,
  clampDepth,
  collectDependencyIdsByDepth,
  filterLineageGraphModel,
  getLensNodeFill,
  getLensLegendItems,
} from './lineageModel';
import type { DependencyIndex, LineageGraphModel, LineageGraphNodeLayout } from './lineageModel';

function makeResource(overrides: Partial<ResourceNode> = {}): ResourceNode {
  return {
    uniqueId: overrides.uniqueId ?? 'model.jaffle_shop.orders',
    name: overrides.name ?? 'orders',
    resourceType: overrides.resourceType ?? 'model',
    packageName: overrides.packageName ?? 'jaffle_shop',
    path: overrides.path ?? 'models/orders.sql',
    originalFilePath: overrides.originalFilePath ?? 'models/orders.sql',
    description: overrides.description ?? null,
    status: overrides.status ?? 'success',
    statusTone: overrides.statusTone ?? 'positive',
    executionTime: overrides.executionTime ?? 1.2,
    threadId: overrides.threadId ?? 'Thread-1',
    ...overrides,
  };
}

function makeNodeLayout(
  resource: ResourceNode,
  side: LineageGraphNodeLayout['side'],
): LineageGraphNodeLayout {
  return {
    resource,
    x: 0,
    y: 0,
    column: 0,
    depth: 0,
    side,
    passCount: 0,
    failCount: 0,
    notExecutedCount: 0,
    skippedCount: 0,
  };
}

function minimalLineageModel(
  nodeLayouts: Map<string, LineageGraphNodeLayout>,
  graphEdges: Array<{ from: string; to: string }>,
): LineageGraphModel {
  return {
    upstreamMap: new Map(),
    downstreamMap: new Map(),
    columnNodes: [],
    nodeLayouts,
    graphEdges,
    svgWidth: 100,
    svgHeight: 100,
    hasRelatedNodes: nodeLayouts.size > 1,
    nodeWidth: 10,
    nodeHeight: 10,
    nodeRadius: 2,
    displayMode: 'focused',
  };
}

describe('clampDepth', () => {
  it('clamps below 0', () => expect(clampDepth(-1)).toBe(0));
  it('clamps above 10', () => expect(clampDepth(15)).toBe(10));
  it('passes through valid', () => expect(clampDepth(3)).toBe(3));
  it('passes through 0', () => expect(clampDepth(0)).toBe(0));
  it('passes through 10', () => expect(clampDepth(10)).toBe(10));
});

describe('collectDependencyIdsByDepth', () => {
  it('returns empty map for unknown id', () => {
    const index: DependencyIndex = {};
    const result = collectDependencyIdsByDepth(index, 'unknown', 2, 'upstream');
    expect(result.size).toBe(0);
  });

  it('collects direct upstream', () => {
    const index: DependencyIndex = {
      'model.p.b': {
        upstreamCount: 1,
        downstreamCount: 0,
        upstream: [{ uniqueId: 'model.p.a', name: 'a', resourceType: 'model', depth: 1 }],
        downstream: [],
      },
    };
    const result = collectDependencyIdsByDepth(index, 'model.p.b', 1, 'upstream');
    expect([...result.keys()]).toContain('model.p.a');
    expect(result.get('model.p.a')).toBe(1);
  });
});

describe('buildLineageGraphModel', () => {
  it('attaches aggregated pass and fail counts to lineage nodes', () => {
    const resource = makeResource();
    const passTest = makeResource({
      uniqueId: 'test.jaffle_shop.unique_orders',
      name: 'unique_orders',
      resourceType: 'test',
      path: 'models/orders.yml',
      originalFilePath: 'models/orders.yml',
      statusTone: 'positive',
      status: 'pass',
    });
    const failTest = makeResource({
      uniqueId: 'test.jaffle_shop.not_null_orders',
      name: 'not_null_orders',
      resourceType: 'test',
      path: 'models/orders.yml',
      originalFilePath: 'models/orders.yml',
      statusTone: 'danger',
      status: 'error',
    });

    const dependencyIndex: DependencyIndex = {
      [resource.uniqueId]: {
        upstreamCount: 0,
        downstreamCount: 0,
        upstream: [],
        downstream: [],
      },
      [passTest.uniqueId]: {
        upstreamCount: 1,
        downstreamCount: 0,
        upstream: [
          {
            uniqueId: resource.uniqueId,
            name: resource.name,
            resourceType: resource.resourceType,
            depth: 1,
          },
        ],
        downstream: [],
      },
      [failTest.uniqueId]: {
        upstreamCount: 1,
        downstreamCount: 0,
        upstream: [
          {
            uniqueId: resource.uniqueId,
            name: resource.name,
            resourceType: resource.resourceType,
            depth: 1,
          },
        ],
        downstream: [],
      },
    };

    const model = buildLineageGraphModel({
      resource,
      dependencySummary: dependencyIndex[resource.uniqueId],
      dependencyIndex,
      resourceById: new Map([
        [resource.uniqueId, resource],
        [passTest.uniqueId, passTest],
        [failTest.uniqueId, failTest],
      ]),
      upstreamDepth: 2,
      downstreamDepth: 2,
      displayMode: 'summary',
    });

    expect(model.nodeLayouts.get(resource.uniqueId)?.passCount).toBe(1);
    expect(model.nodeLayouts.get(resource.uniqueId)?.failCount).toBe(1);
  });

  it('attaches not-executed and skipped test counts to lineage nodes', () => {
    const resource = makeResource({
      statusTone: 'neutral',
      status: null,
    });
    const notRunTest = makeResource({
      uniqueId: 'test.jaffle_shop.not_run_a',
      name: 'not_run_a',
      resourceType: 'test',
      path: 'models/orders.yml',
      originalFilePath: 'models/orders.yml',
      statusTone: 'neutral',
      status: null,
    });
    const notRunTest2 = makeResource({
      uniqueId: 'test.jaffle_shop.not_run_b',
      name: 'not_run_b',
      resourceType: 'test',
      path: 'models/orders.yml',
      originalFilePath: 'models/orders.yml',
      statusTone: 'neutral',
      status: null,
    });
    const skippedTest = makeResource({
      uniqueId: 'test.jaffle_shop.skipped_one',
      name: 'skipped_one',
      resourceType: 'test',
      path: 'models/orders.yml',
      originalFilePath: 'models/orders.yml',
      statusTone: 'skipped',
      status: 'skipped',
    });

    const dependencyIndex: DependencyIndex = {
      [resource.uniqueId]: {
        upstreamCount: 0,
        downstreamCount: 0,
        upstream: [],
        downstream: [],
      },
      [notRunTest.uniqueId]: {
        upstreamCount: 1,
        downstreamCount: 0,
        upstream: [
          {
            uniqueId: resource.uniqueId,
            name: resource.name,
            resourceType: resource.resourceType,
            depth: 1,
          },
        ],
        downstream: [],
      },
      [notRunTest2.uniqueId]: {
        upstreamCount: 1,
        downstreamCount: 0,
        upstream: [
          {
            uniqueId: resource.uniqueId,
            name: resource.name,
            resourceType: resource.resourceType,
            depth: 1,
          },
        ],
        downstream: [],
      },
      [skippedTest.uniqueId]: {
        upstreamCount: 1,
        downstreamCount: 0,
        upstream: [
          {
            uniqueId: resource.uniqueId,
            name: resource.name,
            resourceType: resource.resourceType,
            depth: 1,
          },
        ],
        downstream: [],
      },
    };

    const model = buildLineageGraphModel({
      resource,
      dependencySummary: dependencyIndex[resource.uniqueId],
      dependencyIndex,
      resourceById: new Map([
        [resource.uniqueId, resource],
        [notRunTest.uniqueId, notRunTest],
        [notRunTest2.uniqueId, notRunTest2],
        [skippedTest.uniqueId, skippedTest],
      ]),
      upstreamDepth: 2,
      downstreamDepth: 2,
      displayMode: 'summary',
    });

    const layout = model.nodeLayouts.get(resource.uniqueId);
    expect(layout?.passCount).toBe(0);
    expect(layout?.failCount).toBe(0);
    expect(layout?.notExecutedCount).toBe(2);
    expect(layout?.skippedCount).toBe(1);
  });
});

describe('getLensLegendItems', () => {
  it('uses the same fill tokens for type legend swatches as graph nodes', () => {
    const resource = makeResource();
    const model = buildLineageGraphModel({
      resource,
      dependencySummary: {
        upstreamCount: 0,
        downstreamCount: 0,
        upstream: [],
        downstream: [],
      },
      dependencyIndex: {},
      resourceById: new Map([[resource.uniqueId, resource]]),
      upstreamDepth: 2,
      downstreamDepth: 2,
      displayMode: 'summary',
    });

    expect(getLensLegendItems('type', model.nodeLayouts)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'model',
          color: TYPE_LENS_FILLS.model,
          borderColor: TYPE_LENS_SOLID.model,
        }),
      ]),
    );
  });

  it('uses defined status fill tokens for status legend swatches', () => {
    const resource = makeResource({ statusTone: 'warning', status: 'warn' });
    const model = buildLineageGraphModel({
      resource,
      dependencySummary: {
        upstreamCount: 0,
        downstreamCount: 0,
        upstream: [],
        downstream: [],
      },
      dependencyIndex: {},
      resourceById: new Map([[resource.uniqueId, resource]]),
      upstreamDepth: 2,
      downstreamDepth: 2,
      displayMode: 'summary',
    });

    expect(getLensLegendItems('status', model.nodeLayouts)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'warning',
          color: STATUS_LENS_FILLS.warning,
        }),
      ]),
    );
  });

  it('uses defined token strings for coverage legend swatches', () => {
    const resource = makeResource({ description: 'Has docs' });
    const model = buildLineageGraphModel({
      resource,
      dependencySummary: {
        upstreamCount: 0,
        downstreamCount: 0,
        upstream: [],
        downstream: [],
      },
      dependencyIndex: {},
      resourceById: new Map([[resource.uniqueId, resource]]),
      upstreamDepth: 2,
      downstreamDepth: 2,
      displayMode: 'summary',
    });

    expect(getLensLegendItems('coverage', model.nodeLayouts)).toEqual([
      {
        key: 'documented',
        label: 'Documented',
        color: 'var(--bg-success-soft)',
      },
      {
        key: 'undocumented',
        label: 'No description',
        color: 'var(--bg-danger-soft)',
      },
    ]);
  });
});

describe('filterLineageGraphModel', () => {
  const selectedId = 'model.p.selected';
  const upstreamId = 'model.p.upstream';

  it('with empty legend keeps all nodes when every node is reachable on displayed edges', () => {
    const s = makeResource({ uniqueId: selectedId, name: 's' });
    const a = makeResource({ uniqueId: upstreamId, name: 'a' });
    const layouts = new Map<string, LineageGraphNodeLayout>([
      [selectedId, makeNodeLayout(s, 'selected')],
      [upstreamId, makeNodeLayout(a, 'upstream')],
    ]);
    const edges = [{ from: upstreamId, to: selectedId }];
    const model = minimalLineageModel(layouts, edges);

    const out = filterLineageGraphModel(model, 'type', new Set(), selectedId);

    expect(out.nodeLayouts).toBe(model.nodeLayouts);
    expect(out.graphEdges).toBe(model.graphEdges);
    expect([...out.nodeLayouts.keys()].sort()).toEqual([selectedId, upstreamId].sort());
  });

  it('with empty legend drops orphan nodes with no visible path to the selection', () => {
    const s = makeResource({ uniqueId: selectedId, name: 's' });
    const orphan = makeResource({
      uniqueId: 'model.p.floating',
      name: 'floating',
    });
    const layouts = new Map<string, LineageGraphNodeLayout>([
      [selectedId, makeNodeLayout(s, 'selected')],
      [orphan.uniqueId, makeNodeLayout(orphan, 'upstream')],
    ]);
    const model = minimalLineageModel(layouts, []);

    const out = filterLineageGraphModel(model, 'type', new Set(), selectedId);

    expect([...out.nodeLayouts.keys()]).toEqual([selectedId]);
    expect(out.graphEdges).toEqual([]);
  });

  it('keeps legend-visible nodes connected to the selection', () => {
    const s = makeResource({ uniqueId: selectedId, name: 's' });
    const a = makeResource({ uniqueId: upstreamId, name: 'a' });
    const layouts = new Map<string, LineageGraphNodeLayout>([
      [selectedId, makeNodeLayout(s, 'selected')],
      [upstreamId, makeNodeLayout(a, 'upstream')],
    ]);
    const edges = [{ from: upstreamId, to: selectedId }];
    const model = minimalLineageModel(layouts, edges);

    const out = filterLineageGraphModel(model, 'type', new Set(['model']), selectedId);

    expect([...out.nodeLayouts.keys()].sort()).toEqual([selectedId, upstreamId].sort());
    expect(out.graphEdges).toEqual(edges);
  });

  it('drops orphan nodes with no path to the selection on the visible edge graph', () => {
    const s = makeResource({ uniqueId: selectedId, name: 's' });
    const bridge = makeResource({
      uniqueId: 'macro.p.bridge',
      name: 'bridge',
      resourceType: 'macro',
      path: 'macros/bridge.sql',
      originalFilePath: 'macros/bridge.sql',
    });
    const orphan = makeResource({
      uniqueId: 'model.p.orphan',
      name: 'orphan',
    });
    const layouts = new Map<string, LineageGraphNodeLayout>([
      [selectedId, makeNodeLayout(s, 'selected')],
      [bridge.uniqueId, makeNodeLayout(bridge, 'downstream')],
      [orphan.uniqueId, makeNodeLayout(orphan, 'downstream')],
    ]);
    const edges = [
      { from: selectedId, to: bridge.uniqueId },
      { from: bridge.uniqueId, to: orphan.uniqueId },
    ];
    const model = minimalLineageModel(layouts, edges);

    const out = filterLineageGraphModel(model, 'type', new Set(['model']), selectedId);

    expect([...out.nodeLayouts.keys()]).toEqual([selectedId]);
    expect(out.graphEdges).toEqual([]);
  });
});

describe('getLensNodeFill', () => {
  it('uses resource-type tokens for type lens', () => {
    const resource = makeResource({ resourceType: 'semantic_model' });
    expect(getLensNodeFill(resource, 'type')).toBe(TYPE_LENS_FILLS.semantic_model);
  });

  it('uses semantic status tokens for status and coverage lenses', () => {
    const warning = makeResource({ statusTone: 'warning', status: 'warn' });
    const documented = makeResource({ description: 'Has docs' });
    const undocumented = makeResource({ description: null });

    expect(getLensNodeFill(warning, 'status')).toBe(STATUS_LENS_FILLS.warning);
    expect(getLensNodeFill(documented, 'coverage')).toBe('var(--bg-success-soft)');
    expect(getLensNodeFill(undocumented, 'coverage')).toBe('var(--bg-danger-soft)');
  });
});
