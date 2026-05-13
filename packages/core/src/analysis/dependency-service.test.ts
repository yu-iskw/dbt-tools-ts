import { describe, it, expect, beforeEach } from 'vitest';
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import { parseManifest } from 'dbt-artifacts-parser/manifest';
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import { loadTestManifest } from 'dbt-artifacts-parser/test-utils';
import type { ParsedCatalog } from 'dbt-artifacts-parser/catalog';
import { ManifestGraph } from './manifest-graph';
import { DependencyService } from './dependency-service';

describe('DependencyService', () => {
  let graph: ManifestGraph;

  beforeEach(() => {
    const manifestJson = loadTestManifest('v12', 'manifest_1.10.json');
    const manifest = parseManifest(manifestJson as Record<string, unknown>);
    graph = new ManifestGraph(manifest);
  });

  describe('getDependencies', () => {
    it('should get downstream dependencies', () => {
      const graphologyGraph = graph.getGraph();
      let testNodeId: string | null = null;

      // Find a node that has downstream dependents
      graphologyGraph.forEachNode((nodeId) => {
        const outbound = graphologyGraph.outboundNeighbors(nodeId);
        if (outbound.length > 0 && !testNodeId) {
          testNodeId = nodeId;
        }
      });

      if (testNodeId) {
        const result = DependencyService.getDependencies(graph, testNodeId, 'downstream');
        expect(result.resource_id).toBe(testNodeId);
        expect(result.direction).toBe('downstream');
        expect(result.dependencies).toBeInstanceOf(Array);
        expect(result.count).toBeGreaterThan(0);
        expect(result.dependencies.length).toBe(result.count);
      }
    });

    it('should get upstream dependencies', () => {
      const graphologyGraph = graph.getGraph();
      let testNodeId: string | null = null;

      // Find a node that has upstream dependencies
      graphologyGraph.forEachNode((nodeId) => {
        const inbound = graphologyGraph.inboundNeighbors(nodeId);
        if (inbound.length > 0 && !testNodeId) {
          testNodeId = nodeId;
        }
      });

      if (testNodeId) {
        const result = DependencyService.getDependencies(graph, testNodeId, 'upstream');
        expect(result.resource_id).toBe(testNodeId);
        expect(result.direction).toBe('upstream');
        expect(result.dependencies).toBeInstanceOf(Array);
        expect(result.count).toBeGreaterThan(0);
      }
    });

    it('should return empty list for non-existent resource', () => {
      const result = DependencyService.getDependencies(
        graph,
        'non.existent.resource',
        'downstream',
      );
      expect(result.resource_id).toBe('non.existent.resource');
      expect(result.dependencies).toEqual([]);
      expect(result.count).toBe(0);
    });

    it('should filter fields when specified', () => {
      const graphologyGraph = graph.getGraph();
      let testNodeId: string | null = null;

      graphologyGraph.forEachNode((nodeId) => {
        const outbound = graphologyGraph.outboundNeighbors(nodeId);
        if (outbound.length > 0 && !testNodeId) {
          testNodeId = nodeId;
        }
      });

      if (testNodeId) {
        const result = DependencyService.getDependencies(
          graph,
          testNodeId,
          'downstream',
          'unique_id,name',
        );
        expect(result.dependencies.length).toBeGreaterThan(0);
        const firstDep = result.dependencies[0];
        expect(firstDep).toHaveProperty('unique_id');
        expect(firstDep).toHaveProperty('name');
        // Should not have other fields (or they should be minimal)
        const keys = Object.keys(firstDep);
        expect(keys.length).toBeLessThanOrEqual(4); // unique_id, name, resource_type, package_name (minimal)
      }
    });

    it('should include all required fields in dependencies', () => {
      const graphologyGraph = graph.getGraph();
      let testNodeId: string | null = null;

      graphologyGraph.forEachNode((nodeId) => {
        const outbound = graphologyGraph.outboundNeighbors(nodeId);
        if (outbound.length > 0 && !testNodeId) {
          testNodeId = nodeId;
        }
      });

      if (testNodeId) {
        const result = DependencyService.getDependencies(graph, testNodeId, 'downstream');
        expect(result.dependencies.length).toBeGreaterThan(0);
        const firstDep = result.dependencies[0];
        expect(firstDep).toHaveProperty('unique_id');
        expect(firstDep).toHaveProperty('resource_type');
        expect(firstDep).toHaveProperty('name');
        expect(firstDep).toHaveProperty('package_name');
        expect(firstDep).toHaveProperty('depth');
      }
    });

    it('should limit traversal depth when depth option is provided', () => {
      const resultAll = DependencyService.getDependencies(
        graph,
        'model.jaffle_shop.stg_customers',
        'downstream',
      );
      const resultDepth1 = DependencyService.getDependencies(
        graph,
        'model.jaffle_shop.stg_customers',
        'downstream',
        undefined,
        1,
      );
      expect(resultDepth1.count).toBeLessThanOrEqual(resultAll.count);
      expect(resultDepth1.dependencies.every((d) => d.depth === 1)).toBe(true);
    });

    it('should return nested tree when format is tree', () => {
      const result = DependencyService.getDependencies(
        graph,
        'model.jaffle_shop.stg_customers',
        'downstream',
        undefined,
        undefined,
        'tree',
      );
      expect(result.resource_id).toBe('model.jaffle_shop.stg_customers');
      expect(result.direction).toBe('downstream');
      expect(result.dependencies).toBeInstanceOf(Array);
      expect(result.dependencies.length).toBeGreaterThan(0);
      expect(result.count).toBeGreaterThan(0);

      const firstDep = result.dependencies[0];
      expect(firstDep).toHaveProperty('dependencies');
      expect(Array.isArray(firstDep.dependencies)).toBe(true);
      expect(firstDep).toHaveProperty('unique_id');
      expect(firstDep).toHaveProperty('depth');
    });

    it('should match count between flat and tree format', () => {
      const flatResult = DependencyService.getDependencies(
        graph,
        'model.jaffle_shop.stg_customers',
        'downstream',
      );
      const treeResult = DependencyService.getDependencies(
        graph,
        'model.jaffle_shop.stg_customers',
        'downstream',
        undefined,
        undefined,
        'tree',
      );
      expect(treeResult.count).toBe(flatResult.count);
    });

    it('should return empty tree for non-existent resource when format is tree', () => {
      const result = DependencyService.getDependencies(
        graph,
        'non.existent.resource',
        'downstream',
        undefined,
        undefined,
        'tree',
      );
      expect(result.resource_id).toBe('non.existent.resource');
      expect(result.dependencies).toEqual([]);
      expect(result.count).toBe(0);
    });

    it('should return nested tree for upstream when format is tree', () => {
      const result = DependencyService.getDependencies(
        graph,
        'model.jaffle_shop.customers',
        'upstream',
        undefined,
        undefined,
        'tree',
      );
      expect(result.direction).toBe('upstream');
      expect(result.dependencies).toBeInstanceOf(Array);
      result.dependencies.forEach((node) => {
        expect(node).toHaveProperty('dependencies');
        expect(Array.isArray(node.dependencies)).toBe(true);
      });
    });

    it('should respect depth limit in tree format', () => {
      const resultAll = DependencyService.getDependencies(
        graph,
        'model.jaffle_shop.stg_customers',
        'downstream',
        undefined,
        undefined,
        'tree',
      );
      const resultDepth1 = DependencyService.getDependencies(
        graph,
        'model.jaffle_shop.stg_customers',
        'downstream',
        undefined,
        1,
        'tree',
      );
      expect(resultDepth1.count).toBeLessThanOrEqual(resultAll.count);
      const checkDepth1 = (nodes: typeof resultDepth1.dependencies): boolean => {
        for (const n of nodes) {
          if (n.depth !== 1) return false;
          if (!checkDepth1(n.dependencies)) return false;
        }
        return true;
      };
      expect(checkDepth1(resultDepth1.dependencies)).toBe(true);
    });

    it('should have parent-child edges consistent with graph in tree format', () => {
      const graphologyGraph = graph.getGraph();
      const treeResult = DependencyService.getDependencies(
        graph,
        'model.jaffle_shop.stg_customers',
        'downstream',
        undefined,
        undefined,
        'tree',
      );
      const rootId = 'model.jaffle_shop.stg_customers';
      const checkEdge = (parentId: string, nodes: typeof treeResult.dependencies): void => {
        for (const node of nodes) {
          expect(graphologyGraph.hasEdge(parentId, node.unique_id)).toBe(true);
          checkEdge(node.unique_id, node.dependencies);
        }
      };
      checkEdge(rootId, treeResult.dependencies);
    });
  });

  describe('field-level lineage', () => {
    it('should get dependencies for a specific field', () => {
      // Mock catalog data
      const catalog = {
        nodes: {
          'model.jaffle_shop.customers': {
            columns: {
              id: { type: 'integer' },
              name: { type: 'string' },
            },
          },
          'model.jaffle_shop.stg_customers': {
            columns: {
              id: { type: 'integer' },
            },
          },
        },
      };

      graph.addFieldNodes(catalog as unknown as ParsedCatalog);

      // For this test, relationMap lookup would be needed, but we can mock it.
      // ManifestGraph.addFieldEdges uses relationMap, so manually add the edge.
      const graphologyGraph = graph.getGraph();
      graphologyGraph.addDirectedEdge(
        'model.jaffle_shop.stg_customers#id',
        'model.jaffle_shop.customers#id',
        { dependency_type: 'field' },
      );

      const result = DependencyService.getDependencies(
        graph,
        'model.jaffle_shop.customers#id',
        'upstream',
      );

      expect(result.resource_id).toBe('model.jaffle_shop.customers#id');
      expect(result.count).toBeGreaterThan(0);

      const depIds = result.dependencies.map((d) => d.unique_id);
      expect(depIds).toContain('model.jaffle_shop.stg_customers#id');
      expect(depIds).toContain('model.jaffle_shop.customers'); // Internal dependency
    });
  });
});
