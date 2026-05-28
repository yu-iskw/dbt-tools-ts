// @ts-expect-error - workspace package, TypeScript resolves via package.json
import { parseManifest } from 'dbt-artifacts-parser/manifest';
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import { loadTestManifest } from 'dbt-artifacts-parser/test-utils';
import { describe, it, expect, beforeEach } from 'vitest';

import { ManifestGraph } from '../manifest/graph';

import { queryDependencies } from './query';

describe('queryDependencies', () => {
  let graph: ManifestGraph;
  let nodeWithUpstream: string | null = null;

  beforeEach(() => {
    const manifestJson = loadTestManifest('v12', 'manifest_1.10.json');
    const manifest = parseManifest(manifestJson as Record<string, unknown>);
    graph = new ManifestGraph(manifest);

    const g = graph.getGraph();
    g.forEachNode((nodeId) => {
      if (nodeWithUpstream == null && g.inboundNeighbors(nodeId).length > 0) {
        nodeWithUpstream = nodeId;
      }
    });
  });

  it('omits SQL fields by default', () => {
    if (nodeWithUpstream == null) return;

    const result = queryDependencies(graph, {
      uniqueId: nodeWithUpstream,
      direction: 'upstream',
      depth: 1,
    });

    expect(result.dependencies.length).toBeGreaterThan(0);
    for (const dep of result.dependencies) {
      expect(dep).not.toHaveProperty('raw_code');
      expect(dep).not.toHaveProperty('compiled_code');
      expect(dep.unique_id).toBeTruthy();
      expect(dep.name).toBeTruthy();
    }
  });

  it('returns identity-only dependency nodes without manifest metadata fields', () => {
    if (nodeWithUpstream == null) return;

    const full = queryDependencies(graph, {
      uniqueId: nodeWithUpstream,
      direction: 'upstream',
      depth: 1,
      includeCode: true,
    });

    expect(full.dependencies.length).toBeGreaterThan(0);
    for (const dep of full.dependencies) {
      expect(dep).toHaveProperty('unique_id');
      expect(dep).toHaveProperty('resource_type');
      expect(dep).toHaveProperty('name');
      expect(dep).toHaveProperty('package_name');
      expect(dep).toHaveProperty('depth');
      expect(dep).not.toHaveProperty('path');
      expect(dep).not.toHaveProperty('tags');
    }
  });

  it('includes SQL when includeCode is true', () => {
    if (nodeWithUpstream == null) return;

    const slim = queryDependencies(graph, {
      uniqueId: nodeWithUpstream,
      direction: 'upstream',
      depth: 1,
    });
    const withCode = queryDependencies(graph, {
      uniqueId: nodeWithUpstream,
      direction: 'upstream',
      depth: 1,
      includeCode: true,
    });

    const slimIds = new Set(slim.dependencies.map((d) => d.unique_id));
    const codeDep = withCode.dependencies.find(
      (d) => slimIds.has(d.unique_id) && ('raw_code' in d || 'compiled_code' in d),
    );
    expect(codeDep != null || withCode.dependencies.length === 0).toBe(true);
  });
});
