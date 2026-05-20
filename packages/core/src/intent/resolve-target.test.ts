import { describe, expect, it } from 'vitest';

import { ManifestGraph } from '../analysis/manifest/graph';

import { resolveIntentTarget } from './resolve-target';

import type { ParsedManifest } from 'dbt-artifacts-parser/manifest';

function meta(): ParsedManifest['metadata'] {
  return {
    dbt_schema_version: 'https://schemas.getdbt.com/dbt/manifest/v12.json',
    dbt_version: '1.10.0',
  } as ParsedManifest['metadata'];
}

describe('resolveIntentTarget', () => {
  it('accepts an existing unique_id', () => {
    const manifest = {
      metadata: meta(),
      nodes: {
        'model.p.orders': {
          resource_type: 'model',
          name: 'orders',
          package_name: 'p',
          path: 'models/orders.sql',
        },
      },
      sources: {},
    } as ParsedManifest;
    const graph = new ManifestGraph(manifest);
    const r = resolveIntentTarget(graph, 'model.p.orders');
    expect(r.unique_id).toBe('model.p.orders');
    expect(r.why_it_matched).toContain('exact_unique_id_match');
    expect(r.discover).toBeNull();
  });

  it('resolves via discover for short query', () => {
    const manifest = {
      metadata: meta(),
      nodes: {
        'model.p.orders': {
          resource_type: 'model',
          name: 'orders',
          package_name: 'p',
          path: 'models/orders.sql',
        },
      },
      sources: {},
    } as ParsedManifest;
    const graph = new ManifestGraph(manifest);
    const r = resolveIntentTarget(graph, 'orders');
    expect(r.unique_id).toBe('model.p.orders');
    expect(r.discover).not.toBeNull();
  });

  it('throws for ambiguous short queries with duplicate top matches', () => {
    const manifest = {
      metadata: meta(),
      nodes: {
        'model.pkg_a.orders': {
          resource_type: 'model',
          name: 'orders',
          package_name: 'pkg_a',
          path: 'models/pkg_a/orders.sql',
        },
        'model.pkg_b.orders': {
          resource_type: 'model',
          name: 'orders',
          package_name: 'pkg_b',
          path: 'models/pkg_b/orders.sql',
        },
      },
      sources: {},
    } as ParsedManifest;
    const graph = new ManifestGraph(manifest);
    expect(() => resolveIntentTarget(graph, 'orders')).toThrow(/ambiguous/i);
  });
});
