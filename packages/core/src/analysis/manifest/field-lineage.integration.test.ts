import { describe, it, expect } from 'vitest';

import { DependencyService } from '../dependencies/service';

import { ManifestGraph } from './graph';
import { SQLAnalyzer } from './sql-analyzer';

import type { ParsedCatalog } from 'dbt-artifacts-parser/catalog';
import type { ParsedManifest } from 'dbt-artifacts-parser/manifest';

describe('Field-level lineage integration', () => {
  it('should trace lineage from child field back to source field', () => {
    // 1. Setup mock manifest
    const manifest = {
      metadata: {
        adapter_type: 'postgresql',
        dbt_schema_version: 'https://schemas.getdbt.com/dbt/manifest/v12.json',
        dbt_version: '1.10.0',
      },
      nodes: {
        'model.pkg.stg_users': {
          unique_id: 'model.pkg.stg_users',
          resource_type: 'model',
          name: 'stg_users',
          relation_name: '"analytics"."staging"."stg_users"',
          compiled_code: 'SELECT id, name FROM raw_users',
          depends_on: { nodes: ['source.pkg.raw_users'] },
        },
        'model.pkg.dim_users': {
          unique_id: 'model.pkg.dim_users',
          resource_type: 'model',
          name: 'dim_users',
          relation_name: '"analytics"."core"."dim_users"',
          compiled_code: 'SELECT id as user_id, name FROM "analytics"."staging"."stg_users"',
          depends_on: { nodes: ['model.pkg.stg_users'] },
        },
      },
      sources: {
        'source.pkg.raw_users': {
          unique_id: 'source.pkg.raw_users',
          resource_type: 'source',
          name: 'raw_users',
          relation_name: 'raw_users',
        },
      },
      parent_map: {
        'model.pkg.stg_users': ['source.pkg.raw_users'],
        'model.pkg.dim_users': ['model.pkg.stg_users'],
      },
    };

    // 2. Setup mock catalog
    const catalog = {
      nodes: {
        'model.pkg.stg_users': {
          columns: {
            id: { type: 'integer' },
            name: { type: 'string' },
          },
        },
        'model.pkg.dim_users': {
          columns: {
            user_id: { type: 'integer' },
            name: { type: 'string' },
          },
        },
      },
      sources: {
        'source.pkg.raw_users': {
          columns: {
            id: { type: 'integer' },
            name: { type: 'string' },
          },
        },
      },
    };

    // 3. Build graph
    const graph = new ManifestGraph(manifest as unknown as ParsedManifest);
    graph.addFieldNodes(catalog as unknown as ParsedCatalog);

    // 4. Analyze SQL and add edges
    const analyzer = new SQLAnalyzer();
    for (const [uid, node] of Object.entries(manifest.nodes)) {
      if (node.compiled_code) {
        const deps = analyzer.analyze(node.compiled_code, 'postgresql');
        graph.addFieldEdges(uid, deps);
      }
    }

    // 5. Query lineage for dim_users.user_id
    const result = DependencyService.getDependencies(
      graph,
      'model.pkg.dim_users#user_id',
      'upstream',
    );

    const depIds = result.dependencies.map((d) => d.unique_id);

    // Should depend on stg_users.id
    expect(depIds).toContain('model.pkg.stg_users#id');

    // Should depend on raw_users.id (if we trace all the way back)
    expect(depIds).toContain('source.pkg.raw_users#id');

    // Should also include parent models due to internal edges
    expect(depIds).toContain('model.pkg.dim_users');
    expect(depIds).toContain('model.pkg.stg_users');
  });
});
