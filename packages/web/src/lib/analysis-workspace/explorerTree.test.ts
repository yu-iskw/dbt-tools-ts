import { describe, it, expect } from 'vitest';
import {
  buildExplorerTree,
  buildResourceTestStats,
  buildSelectedAssetTestEvidence,
  collectAncestorBranchIdsForResource,
  collectLeafIds,
  findNodeByLeafResourceId,
  flattenExplorerTree,
  projectRootBranchId,
  testStatsHasAttention,
  type ExplorerTreeRow,
} from './explorerTree';
import type { ResourceNode } from '@web/types';

function makeResource(overrides: Partial<ResourceNode> = {}): ResourceNode {
  return {
    uniqueId: `model.jaffle_shop.${overrides.name ?? 'r'}`,
    name: overrides.name ?? 'r',
    resourceType: 'model',
    packageName: 'jaffle_shop',
    fqn: ['jaffle_shop', overrides.name ?? 'r'],
    originalFilePath: `models/${overrides.name ?? 'r'}.sql`,
    description: '',
    dependsOn: [],
    database: 'dev',
    schema: 'dbt',
    ...overrides,
  } as ResourceNode;
}

describe('buildResourceTestStats', () => {
  const modelUpstream = (modelId: string) => [
    {
      uniqueId: modelId,
      name: 'orders',
      resourceType: 'model',
      depth: 1,
    },
  ];

  it('counts neutral tests as notExecuted, not skipped', () => {
    const modelId = 'model.jaffle_shop.orders';
    const model = makeResource({ name: 'orders' });
    const neutralTest = makeResource({
      uniqueId: 'test.jaffle_shop.n',
      name: 'n',
      resourceType: 'test',
      originalFilePath: 'tests/n.sql',
      statusTone: 'neutral',
    });
    const dependencyIndex = {
      [neutralTest.uniqueId]: {
        upstreamCount: 1,
        downstreamCount: 0,
        upstream: modelUpstream(modelId),
        downstream: [],
      },
    };
    const map = buildResourceTestStats([model, neutralTest], dependencyIndex);
    expect(map.get(modelId)).toEqual({
      pass: 0,
      fail: 0,
      error: 0,
      warn: 0,
      skipped: 0,
      notExecuted: 1,
    });
  });

  it('counts skipped-tone tests in skipped bucket', () => {
    const modelId = 'model.jaffle_shop.orders';
    const model = makeResource({ name: 'orders' });
    const skippedTest = makeResource({
      uniqueId: 'test.jaffle_shop.s',
      name: 's',
      resourceType: 'test',
      originalFilePath: 'tests/s.sql',
      statusTone: 'skipped',
    });
    const dependencyIndex = {
      [skippedTest.uniqueId]: {
        upstreamCount: 1,
        downstreamCount: 0,
        upstream: modelUpstream(modelId),
        downstream: [],
      },
    };
    const map = buildResourceTestStats([model, skippedTest], dependencyIndex);
    expect(map.get(modelId)).toEqual({
      pass: 0,
      fail: 0,
      error: 0,
      warn: 0,
      skipped: 1,
      notExecuted: 0,
    });
  });

  it('maps positive, danger, and warning tones', () => {
    const modelId = 'model.jaffle_shop.orders';
    const model = makeResource({ name: 'orders' });
    const passT = makeResource({
      uniqueId: 'test.jaffle_shop.p',
      name: 'p',
      resourceType: 'test',
      originalFilePath: 'tests/p.sql',
      statusTone: 'positive',
    });
    const errT = makeResource({
      uniqueId: 'test.jaffle_shop.e',
      name: 'e',
      resourceType: 'test',
      originalFilePath: 'tests/e.sql',
      statusTone: 'danger',
    });
    const warnT = makeResource({
      uniqueId: 'test.jaffle_shop.w',
      name: 'w',
      resourceType: 'test',
      originalFilePath: 'tests/w.sql',
      statusTone: 'warning',
    });
    const dependencyIndex = Object.fromEntries(
      [passT, errT, warnT].map((t) => [
        t.uniqueId,
        {
          upstreamCount: 1,
          downstreamCount: 0,
          upstream: modelUpstream(modelId),
          downstream: [],
        },
      ]),
    );
    const map = buildResourceTestStats([model, passT, errT, warnT], dependencyIndex);
    expect(map.get(modelId)).toEqual({
      pass: 1,
      fail: 0,
      error: 1,
      warn: 1,
      skipped: 0,
      notExecuted: 0,
    });
  });
});

describe('testStatsHasAttention', () => {
  it('is false for pass-only stats', () => {
    expect(
      testStatsHasAttention({
        pass: 99,
        fail: 0,
        error: 0,
        warn: 0,
        skipped: 0,
        notExecuted: 0,
      }),
    ).toBe(false);
  });

  it('is false when only notExecuted is non-zero', () => {
    expect(
      testStatsHasAttention({
        pass: 0,
        fail: 0,
        error: 0,
        warn: 0,
        skipped: 0,
        notExecuted: 1,
      }),
    ).toBe(false);
  });

  it('is true when error, warn, skipped, or fail is non-zero', () => {
    expect(
      testStatsHasAttention({
        pass: 0,
        fail: 0,
        error: 1,
        warn: 0,
        skipped: 0,
        notExecuted: 0,
      }),
    ).toBe(true);
    expect(
      testStatsHasAttention({
        pass: 0,
        fail: 0,
        error: 0,
        warn: 1,
        skipped: 0,
        notExecuted: 0,
      }),
    ).toBe(true);
    expect(
      testStatsHasAttention({
        pass: 0,
        fail: 0,
        error: 0,
        warn: 0,
        skipped: 1,
        notExecuted: 0,
      }),
    ).toBe(true);
  });

  it('is true when notExecuted is non-zero but error is also non-zero', () => {
    expect(
      testStatsHasAttention({
        pass: 0,
        fail: 0,
        error: 1,
        warn: 0,
        skipped: 0,
        notExecuted: 99,
      }),
    ).toBe(true);
  });
});

describe('projectRootBranchId', () => {
  it('uses Workspace label when projectName is null', () => {
    expect(projectRootBranchId(null)).toBe('project:branch:Workspace');
  });

  it('prefixes project name', () => {
    expect(projectRootBranchId('pkg')).toBe('project:branch:pkg');
  });
});

describe('buildExplorerTree', () => {
  const modelUpstream = (modelId: string) => [
    {
      uniqueId: modelId,
      name: 'orders',
      resourceType: 'model',
      depth: 1,
    },
  ];

  it('does not attach testStats for pass-only attachments on leaves or branches', () => {
    const modelId = 'model.jaffle_shop.orders';
    const model = makeResource({ name: 'orders' });
    const passTest = makeResource({
      uniqueId: 'test.jaffle_shop.p',
      name: 'p',
      resourceType: 'test',
      originalFilePath: 'tests/p.sql',
      statusTone: 'positive',
    });
    const dependencyIndex = {
      [passTest.uniqueId]: {
        upstreamCount: 1,
        downstreamCount: 0,
        upstream: modelUpstream(modelId),
        downstream: [],
      },
    };
    const tree = buildExplorerTree([model, passTest], 'project', 'jaffle_shop', dependencyIndex);
    const leaf = findNodeByLeafResourceId(tree, modelId);
    expect(leaf?.testStats).toBeUndefined();
    expect(tree[0]?.testStats).toBeUndefined();
  });

  it('returns empty array for no resources', () => {
    const tree = buildExplorerTree([], 'project', 'jaffle_shop');
    expect(tree).toHaveLength(0);
  });

  it('groups resources under package branch', () => {
    const resources = [makeResource({ name: 'orders' }), makeResource({ name: 'customers' })];
    const tree = buildExplorerTree(resources, 'project', 'jaffle_shop');
    expect(tree.length).toBeGreaterThan(0);
    const leafIds = collectLeafIds(tree);
    expect(leafIds).toContain('model.jaffle_shop.orders');
    expect(leafIds).toContain('model.jaffle_shop.customers');
  });

  it('uses descendant non-test resource counts for branches', () => {
    const resources = [
      makeResource({
        name: 'orders',
        originalFilePath: 'models/marts/orders.sql',
      }),
      makeResource({
        name: 'customers',
        originalFilePath: 'models/marts/customers.sql',
      }),
      makeResource({
        uniqueId: 'test.jaffle_shop.orders_not_null',
        name: 'orders_not_null',
        resourceType: 'test',
        originalFilePath: 'tests/orders_not_null.sql',
      }),
    ];
    const tree = buildExplorerTree(resources, 'project', 'jaffle_shop');
    expect(tree[0]?.count).toBe(2);
    const modelsBranch = tree[0]?.children.find((node) => node.label === 'models');
    expect(modelsBranch?.count).toBe(2);
  });
});

describe('flattenExplorerTree', () => {
  it('returns no rows for empty tree', () => {
    expect(flattenExplorerTree([], new Set())).toHaveLength(0);
  });

  it('collapsed branches hide children', () => {
    const resources = [makeResource({ name: 'orders' })];
    const tree = buildExplorerTree(resources, 'project', 'jaffle_shop');
    // nothing expanded → only root branch visible
    const rows = flattenExplorerTree(tree, new Set());
    const leafRows = rows.filter((r: ExplorerTreeRow) => r.node.resource != null);
    expect(leafRows).toHaveLength(0);
  });
});

describe('findNodeByLeafResourceId', () => {
  it('returns null for empty tree', () => {
    expect(findNodeByLeafResourceId([], 'model.x.y')).toBeNull();
  });

  it('finds existing resource', () => {
    const resources = [makeResource({ name: 'orders' })];
    const tree = buildExplorerTree(resources, 'project', 'jaffle_shop');
    const node = findNodeByLeafResourceId(tree, 'model.jaffle_shop.orders');
    expect(node).not.toBeNull();
    expect(node?.resource?.uniqueId).toBe('model.jaffle_shop.orders');
  });
});

describe('collectAncestorBranchIdsForResource', () => {
  it('returns ancestor branch ids for an existing resource', () => {
    const resources = [
      makeResource({
        name: 'orders',
        originalFilePath: 'models/marts/orders.sql',
      }),
    ];
    const tree = buildExplorerTree(resources, 'project', 'jaffle_shop');
    const ids = collectAncestorBranchIdsForResource(tree, 'model.jaffle_shop.orders');
    expect(ids.size).toBeGreaterThan(0);
    expect([...ids].some((id) => id.includes('jaffle_shop/models/marts'))).toBeTruthy();
  });

  it('returns an empty set for a missing resource', () => {
    const tree = buildExplorerTree([makeResource({ name: 'orders' })], 'project', 'jaffle_shop');
    expect(collectAncestorBranchIdsForResource(tree, 'model.jaffle_shop.missing')).toEqual(
      new Set(),
    );
  });
});

describe('buildSelectedAssetTestEvidence', () => {
  it('collects attached tests and groups warning+danger into attention', () => {
    const resources = [
      makeResource({ name: 'orders' }),
      makeResource({
        uniqueId: 'test.jaffle_shop.orders_not_null',
        name: 'orders_not_null',
        resourceType: 'test',
        statusTone: 'positive',
        status: 'pass',
      }),
      makeResource({
        uniqueId: 'test.jaffle_shop.orders_unique',
        name: 'orders_unique',
        resourceType: 'test',
        statusTone: 'danger',
        status: 'fail',
      }),
      makeResource({
        uniqueId: 'test.jaffle_shop.other_asset',
        name: 'other_asset',
        resourceType: 'test',
        statusTone: 'warning',
        status: 'warn',
      }),
    ];

    const evidence = buildSelectedAssetTestEvidence('model.jaffle_shop.orders', resources, {
      'test.jaffle_shop.orders_not_null': {
        upstreamCount: 1,
        downstreamCount: 0,
        upstream: [
          {
            uniqueId: 'model.jaffle_shop.orders',
            name: 'orders',
            resourceType: 'model',
            depth: 1,
          },
        ],
        downstream: [],
      },
      'test.jaffle_shop.orders_unique': {
        upstreamCount: 1,
        downstreamCount: 0,
        upstream: [
          {
            uniqueId: 'model.jaffle_shop.orders',
            name: 'orders',
            resourceType: 'model',
            depth: 1,
          },
        ],
        downstream: [],
      },
      'test.jaffle_shop.other_asset': {
        upstreamCount: 1,
        downstreamCount: 0,
        upstream: [
          {
            uniqueId: 'model.jaffle_shop.customers',
            name: 'customers',
            resourceType: 'model',
            depth: 1,
          },
        ],
        downstream: [],
      },
    });

    expect(evidence.total).toBe(2);
    expect(evidence.passing).toBe(1);
    expect(evidence.attention).toBe(1);
    expect(evidence.tests.map((test) => test.uniqueId)).toEqual([
      'test.jaffle_shop.orders_unique',
      'test.jaffle_shop.orders_not_null',
    ]);
  });
});
