import { describe, expect, it } from 'vitest';

import { ManifestGraph } from '../analysis/manifest/graph';

import { discoverResources, levenshteinDistance } from './rank';

import type { ParsedManifest } from 'dbt-artifacts-parser/manifest';

function baseMeta(): ParsedManifest['metadata'] {
  return {
    dbt_schema_version: 'https://schemas.getdbt.com/dbt/manifest/v12.json',
    dbt_version: '1.10.0',
  } as ParsedManifest['metadata'];
}

function modelNode(
  name: string,
  packageName: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    resource_type: 'model',
    name,
    package_name: packageName,
    path: `models/${name}.sql`,
    tags: [],
    ...extra,
  };
}

describe('levenshteinDistance', () => {
  it('returns edit distance for typos', () => {
    expect(levenshteinDistance('orders', 'ordrs')).toBe(1);
    expect(levenshteinDistance('orderz', 'orders')).toBe(1);
    expect(levenshteinDistance('orders', 'orders')).toBe(0);
  });
});

describe('discoverResources', () => {
  it('returns empty for blank query', () => {
    const manifest = {
      metadata: baseMeta(),
      nodes: {
        'model.pkg.a': modelNode('a', 'pkg'),
      },
      sources: {},
    } as ParsedManifest;
    const graph = new ManifestGraph(manifest);
    expect(discoverResources(graph, '   ').matches).toEqual([]);
  });

  it('returns matches for empty query when type filter is set', () => {
    const manifest = {
      metadata: baseMeta(),
      nodes: {
        'model.pkg.a': modelNode('a', 'pkg'),
        'seed.pkg.b': {
          resource_type: 'seed',
          name: 'b',
          package_name: 'pkg',
          path: 'seeds/b.csv',
          tags: [],
        },
      },
      sources: {},
    } as ParsedManifest;
    const graph = new ManifestGraph(manifest);
    const out = discoverResources(graph, '', { type: 'model' });
    expect(out.matches.map((m) => m.unique_id)).toEqual(['model.pkg.a']);
  });

  it('ranks exact name above substring', () => {
    const manifest = {
      metadata: baseMeta(),
      nodes: {
        'model.pkg.stg_orders': modelNode('stg_orders', 'pkg', {
          description: 'staging orders',
        }),
        'model.pkg.orders': modelNode('orders', 'pkg', {
          description: 'marts orders',
        }),
      },
      sources: {},
    } as ParsedManifest;
    const graph = new ManifestGraph(manifest);
    const { matches } = discoverResources(graph, 'orders', { limit: 10 });
    const orderIds = matches.map((m) => m.unique_id);
    expect(orderIds).toContain('model.pkg.orders');
    const top = matches[0];
    expect(top?.unique_id).toBe('model.pkg.orders');
    expect(top?.reasons).toContain('exact_name_match');
  });

  it('matches fuzzy name when substring would miss', () => {
    const manifest = {
      metadata: baseMeta(),
      nodes: {
        'model.pkg.orders': modelNode('orders', 'pkg'),
      },
      sources: {},
    } as ParsedManifest;
    const graph = new ManifestGraph(manifest);
    const { matches } = discoverResources(graph, 'ordrs', { limit: 5 });
    expect(matches.some((m) => m.unique_id === 'model.pkg.orders')).toBe(true);
    const m = matches.find((x) => x.unique_id === 'model.pkg.orders');
    expect(m?.reasons).toContain('fuzzy_name_match');
  });

  it('lists disambiguation for duplicate display names', () => {
    const manifest = {
      metadata: baseMeta(),
      nodes: {
        'model.pkg_a.orders': modelNode('orders', 'pkg_a'),
        'model.pkg_b.orders': modelNode('orders', 'pkg_b'),
      },
      sources: {},
    } as ParsedManifest;
    const graph = new ManifestGraph(manifest);
    const { matches } = discoverResources(graph, 'orders', { limit: 10 });
    const withDism = matches.filter((m) => m.disambiguation.length > 0);
    expect(withDism.length).toBeGreaterThan(0);
  });

  it('supports type: filter with no plain terms', () => {
    const manifest = {
      metadata: baseMeta(),
      nodes: {
        'model.p.m': modelNode('m', 'p'),
        'test.p.t': {
          resource_type: 'test',
          name: 't',
          package_name: 'p',
          path: 'tests/t.sql',
        },
      },
      sources: {},
    } as ParsedManifest;
    const graph = new ManifestGraph(manifest);
    const { matches } = discoverResources(graph, 'type:model', { limit: 20 });
    expect(matches.every((m) => m.resource_type === 'model')).toBe(true);
  });

  it('supports inline path: filters in the query', () => {
    const manifest = {
      metadata: baseMeta(),
      nodes: {
        'model.p.orders': modelNode('orders', 'p', {
          path: 'models/marts/orders.sql',
        }),
        'model.p.orders_archive': modelNode('orders_archive', 'p', {
          path: 'models/archive/orders_archive.sql',
        }),
      },
      sources: {},
    } as ParsedManifest;
    const graph = new ManifestGraph(manifest);
    const { matches } = discoverResources(graph, 'orders path:marts', {
      limit: 20,
    });
    expect(matches.map((m) => m.unique_id)).toEqual(['model.p.orders']);
  });

  it('lets explicit path options override inline path tokens', () => {
    const manifest = {
      metadata: baseMeta(),
      nodes: {
        'model.p.orders_marts': modelNode('orders', 'p', {
          path: 'models/marts/orders.sql',
        }),
        'model.p.orders_staging': modelNode('orders', 'p', {
          path: 'models/staging/orders.sql',
        }),
      },
      sources: {},
    } as ParsedManifest;
    const graph = new ManifestGraph(manifest);
    const { matches } = discoverResources(graph, 'orders path:marts', {
      limit: 20,
      path: 'staging',
    });
    expect(matches.map((m) => m.unique_id)).toEqual(['model.p.orders_staging']);
  });

  it('includes related neighbors when edges exist', () => {
    const manifest = {
      metadata: baseMeta(),
      nodes: {
        'model.p.stg': modelNode('stg', 'p'),
        'model.p.orders': {
          ...modelNode('orders', 'p'),
          depends_on: { nodes: ['model.p.stg'], macros: [] },
        } as Record<string, unknown>,
        'test.p.orders_unique': {
          resource_type: 'test',
          name: 'orders_unique',
          package_name: 'p',
          path: 'tests/o.sql',
          depends_on: { nodes: ['model.p.orders'], macros: [] },
        } as Record<string, unknown>,
      },
      sources: {},
    } as ParsedManifest;
    const graph = new ManifestGraph(manifest);
    const { matches } = discoverResources(graph, 'orders', { limit: 5 });
    const orders = matches.find((m) => m.unique_id === 'model.p.orders');
    expect(orders?.related.some((r) => r.unique_id === 'model.p.stg')).toBe(true);
    expect(orders?.related.some((r) => r.unique_id === 'test.p.orders_unique')).toBe(true);
  });
});
