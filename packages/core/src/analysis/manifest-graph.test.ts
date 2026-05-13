import { describe, it, expect } from 'vitest';
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import { parseManifest } from 'dbt-artifacts-parser/manifest';
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import { loadTestManifest } from 'dbt-artifacts-parser/test-utils';
import type { ParsedCatalog } from 'dbt-artifacts-parser/catalog';
import { ManifestGraph } from './manifest-graph';

describe('ManifestGraph', () => {
  describe('version validation', () => {
    it('should accept v12 manifest', () => {
      const manifestJson = loadTestManifest('v12', 'manifest_1.10.json');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      expect(() => new ManifestGraph(manifest)).not.toThrow();
    });

    it('should accept v11 manifest', () => {
      const manifestJson = loadTestManifest('v11', 'manifest.json');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      expect(() => new ManifestGraph(manifest)).not.toThrow();
    });

    it('should accept v10 manifest', () => {
      const manifestJson = loadTestManifest('v10', 'manifest.json');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      expect(() => new ManifestGraph(manifest)).not.toThrow();
    });

    it('should reject v9 manifest with appropriate error', () => {
      const manifestJson = loadTestManifest('v9', 'manifest.json', 'jaffle_shop_at_1.5rc1');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      expect(() => new ManifestGraph(manifest)).toThrow(/Unsupported dbt version/);
      expect(() => new ManifestGraph(manifest)).toThrow(/Requires dbt 1.10\+/);
    });

    it('should include version information in error message', () => {
      const manifestJson = loadTestManifest('v9', 'manifest.json', 'jaffle_shop_at_1.5rc1');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      try {
        new ManifestGraph(manifest);
        expect.fail('Should have thrown an error');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        expect(errorMessage).toContain('Schema version');
        expect(errorMessage).toContain('v10+');
      }
    });
  });

  describe('graph building', () => {
    it('should build a graph from manifest v12', () => {
      const manifestJson = loadTestManifest('v12', 'manifest_1.10.json');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const graphologyGraph = graph.getGraph();
      expect(graphologyGraph.order).toBeGreaterThan(0);
      expect(graphologyGraph.size).toBeGreaterThanOrEqual(0);
    });

    it('should build a graph from manifest v11', () => {
      const manifestJson = loadTestManifest('v11', 'manifest.json');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const graphologyGraph = graph.getGraph();
      expect(graphologyGraph.order).toBeGreaterThan(0);
    });

    it('should build a graph from manifest v10', () => {
      const manifestJson = loadTestManifest('v10', 'manifest.json');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const graphologyGraph = graph.getGraph();
      expect(graphologyGraph.order).toBeGreaterThan(0);
    });

    it('should add nodes from manifest', () => {
      const manifestJson = loadTestManifest('v12', 'manifest_1.10.json');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const graphologyGraph = graph.getGraph();
      let hasModelNode = false;
      let hasSourceNode = false;

      graphologyGraph.forEachNode((nodeId, attributes) => {
        if (nodeId.startsWith('model.')) {
          hasModelNode = true;
          expect(attributes.resource_type).toBeDefined();
          expect(attributes.name).toBeDefined();
        }
        if (nodeId.startsWith('source.')) {
          hasSourceNode = true;
          expect(attributes.resource_type).toBe('source');
        }
      });

      expect(hasModelNode).toBe(true);
      expect(hasSourceNode).toBe(true);
    });

    it('should add edges based on dependencies', () => {
      const manifestJson = loadTestManifest('v12', 'manifest_1.10.json');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const graphologyGraph = graph.getGraph();
      let hasEdges = false;

      graphologyGraph.forEachEdge((edgeId, attributes, source, target) => {
        hasEdges = true;
        expect(attributes.dependency_type).toBeDefined();
        expect(graphologyGraph.hasNode(source)).toBe(true);
        expect(graphologyGraph.hasNode(target)).toBe(true);
      });

      // The graph should have edges if there are dependencies
      if (graphologyGraph.order > 1) {
        expect(hasEdges).toBe(true);
      }
    });

    it('merges parent_map with node depends_on so incomplete parent_map does not drop refs', () => {
      const manifestJson = loadTestManifest('v12', 'manifest_1.10.json');
      const raw = structuredClone(manifestJson) as Record<string, unknown>;
      const testId =
        'test.jaffle_shop.relationships_stg_order_items_order_id__order_id__ref_stg_orders_.dbe9930c54';
      const parentMap = raw.parent_map as Record<string, string[]>;
      expect(parentMap[testId]?.length).toBeGreaterThanOrEqual(1);
      // Simulate manifests where parent_map lists fewer parents than depends_on.nodes
      parentMap[testId] = ['model.jaffle_shop.stg_order_items'];

      const manifest = parseManifest(raw);
      const graph = new ManifestGraph(manifest);
      const g = graph.getGraph();
      const inbound = [...g.inboundNeighbors(testId)];

      expect(inbound).toContain('model.jaffle_shop.stg_order_items');
      expect(inbound).toContain('model.jaffle_shop.stg_orders');
    });
  });

  describe('getSummary', () => {
    it('should generate summary statistics', () => {
      const manifestJson = loadTestManifest('v12', 'manifest_1.10.json');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const summary = graph.getSummary();

      expect(summary.total_nodes).toBeGreaterThan(0);
      expect(summary.total_edges).toBeGreaterThanOrEqual(0);
      expect(summary.nodes_by_type).toBeDefined();
      expect(typeof summary.has_cycles).toBe('boolean');
    });

    it('should count nodes by type correctly', () => {
      const manifestJson = loadTestManifest('v12', 'manifest_1.10.json');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const summary = graph.getSummary();

      // Verify that the sum of nodes_by_type equals total_nodes
      const sumByType = Object.values(summary.nodes_by_type).reduce((sum, count) => sum + count, 0);
      expect(sumByType).toBe(summary.total_nodes);
    });

    it('should detect cycles correctly', () => {
      const manifestJson = loadTestManifest('v12', 'manifest_1.10.json');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const summary = graph.getSummary();

      // dbt graphs should typically be acyclic (DAG)
      // But we just verify the property exists and is boolean
      expect(typeof summary.has_cycles).toBe('boolean');
    });
  });

  describe('getUpstream', () => {
    it('should return upstream dependencies for a node', () => {
      const manifestJson = loadTestManifest('v12', 'manifest_1.10.json');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

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
        const upstream = graph.getUpstream(testNodeId);
        expect(Array.isArray(upstream)).toBe(true);
        expect(upstream.length).toBeGreaterThan(0);

        // Verify format: { nodeId, depth }
        for (const entry of upstream) {
          expect(entry).toHaveProperty('nodeId');
          expect(entry).toHaveProperty('depth');
          expect(typeof entry.depth).toBe('number');
          expect(entry.depth).toBeGreaterThanOrEqual(1);
          expect(graphologyGraph.hasNode(entry.nodeId)).toBe(true);
        }
      }
    });

    it('should return empty array for non-existent node', () => {
      const manifestJson = loadTestManifest('v12', 'manifest_1.10.json');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const upstream = graph.getUpstream('non.existent.node');
      expect(upstream).toEqual([]);
    });

    it('should return empty array for root nodes', () => {
      const manifestJson = loadTestManifest('v12', 'manifest_1.10.json');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const graphologyGraph = graph.getGraph();
      let rootNodeId: string | null = null;

      // Find a root node (no inbound neighbors)
      graphologyGraph.forEachNode((nodeId) => {
        const inbound = graphologyGraph.inboundNeighbors(nodeId);
        if (inbound.length === 0 && !rootNodeId) {
          rootNodeId = nodeId;
        }
      });

      if (rootNodeId) {
        const upstream = graph.getUpstream(rootNodeId);
        expect(upstream).toEqual([]);
      }
    });
  });

  describe('getDownstream', () => {
    it('should return downstream dependents for a node', () => {
      const manifestJson = loadTestManifest('v12', 'manifest_1.10.json');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

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
        const downstream = graph.getDownstream(testNodeId);
        expect(Array.isArray(downstream)).toBe(true);
        expect(downstream.length).toBeGreaterThan(0);

        // Verify format: { nodeId, depth }
        for (const entry of downstream) {
          expect(entry).toHaveProperty('nodeId');
          expect(entry).toHaveProperty('depth');
          expect(typeof entry.depth).toBe('number');
          expect(entry.depth).toBeGreaterThanOrEqual(1);
          expect(graphologyGraph.hasNode(entry.nodeId)).toBe(true);
        }
      }
    });

    it('should return empty array for non-existent node', () => {
      const manifestJson = loadTestManifest('v12', 'manifest_1.10.json');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const downstream = graph.getDownstream('non.existent.node');
      expect(downstream).toEqual([]);
    });

    it('should return empty array for leaf nodes', () => {
      const manifestJson = loadTestManifest('v12', 'manifest_1.10.json');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const graphologyGraph = graph.getGraph();
      let leafNodeId: string | null = null;

      // Find a leaf node (no outbound neighbors)
      graphologyGraph.forEachNode((nodeId) => {
        const outbound = graphologyGraph.outboundNeighbors(nodeId);
        if (outbound.length === 0 && !leafNodeId) {
          leafNodeId = nodeId;
        }
      });

      if (leafNodeId) {
        const downstream = graph.getDownstream(leafNodeId);
        expect(downstream).toEqual([]);
      }
    });

    it('should limit downstream by depth when maxDepth is specified', () => {
      const manifestJson = loadTestManifest('v12', 'manifest_1.10.json');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const graphologyGraph = graph.getGraph();
      let testNodeId: string | null = null;

      graphologyGraph.forEachNode((nodeId) => {
        const outbound = graphologyGraph.outboundNeighbors(nodeId);
        if (outbound.length > 0 && !testNodeId) {
          testNodeId = nodeId;
        }
      });

      if (testNodeId) {
        const full = graph.getDownstream(testNodeId);
        const depth1 = graph.getDownstream(testNodeId, 1);

        expect(depth1.length).toBeLessThanOrEqual(full.length);
        depth1.forEach((entry) => {
          expect(entry.depth).toBe(1);
        });
      }
    });

    it('should limit upstream by depth when maxDepth is specified', () => {
      const manifestJson = loadTestManifest('v12', 'manifest_1.10.json');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const graphologyGraph = graph.getGraph();
      let testNodeId: string | null = null;

      graphologyGraph.forEachNode((nodeId) => {
        const inbound = graphologyGraph.inboundNeighbors(nodeId);
        if (inbound.length > 0 && !testNodeId) {
          testNodeId = nodeId;
        }
      });

      if (testNodeId) {
        const full = graph.getUpstream(testNodeId);
        const depth1 = graph.getUpstream(testNodeId, 1);

        expect(depth1.length).toBeLessThanOrEqual(full.length);
        depth1.forEach((entry) => {
          expect(entry.depth).toBe(1);
        });
      }
    });
  });

  describe('getUpstreamWithParents', () => {
    it('should return parentId for each upstream node', () => {
      const manifestJson = loadTestManifest('v12', 'manifest_1.10.json');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const graphologyGraph = graph.getGraph();
      let testNodeId: string | null = null;

      graphologyGraph.forEachNode((nodeId) => {
        const inbound = graphologyGraph.inboundNeighbors(nodeId);
        if (inbound.length > 0 && !testNodeId) {
          testNodeId = nodeId;
        }
      });

      if (testNodeId) {
        const result = graph.getUpstreamWithParents(testNodeId!);
        expect(result.length).toBeGreaterThan(0);
        for (const { nodeId, depth, parentId } of result) {
          expect(typeof nodeId).toBe('string');
          expect(typeof depth).toBe('number');
          expect(typeof parentId).toBe('string');
          expect(graphologyGraph.hasNode(parentId)).toBe(true);
        }
      }
    });

    it('should return empty array for non-existent node', () => {
      const manifestJson = loadTestManifest('v12', 'manifest_1.10.json');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      expect(graph.getUpstreamWithParents('non.existent.node')).toEqual([]);
    });

    it('should return empty array for root node (no inbound)', () => {
      const manifestJson = loadTestManifest('v12', 'manifest_1.10.json');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);
      const graphologyGraph = graph.getGraph();

      let rootNodeId: string | null = null;
      graphologyGraph.forEachNode((nodeId) => {
        if (graphologyGraph.inboundNeighbors(nodeId).length === 0 && !rootNodeId) {
          rootNodeId = nodeId;
        }
      });

      if (rootNodeId) {
        expect(graph.getUpstreamWithParents(rootNodeId)).toEqual([]);
      }
    });

    it('should limit by maxDepth when specified', () => {
      const manifestJson = loadTestManifest('v12', 'manifest_1.10.json');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const full = graph.getUpstreamWithParents('model.jaffle_shop.customers');
      const depth1 = graph.getUpstreamWithParents('model.jaffle_shop.customers', 1);
      expect(depth1.length).toBeLessThanOrEqual(full.length);
      depth1.forEach(({ depth }) => expect(depth).toBe(1));
    });

    it('should have parentId equal to root for depth-1 nodes', () => {
      const manifestJson = loadTestManifest('v12', 'manifest_1.10.json');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);
      const rootId = 'model.jaffle_shop.customers';

      const result = graph.getUpstreamWithParents(rootId);
      const depth1Entries = result.filter((e) => e.depth === 1);
      depth1Entries.forEach(({ parentId }) => {
        expect(parentId).toBe(rootId);
      });
    });
  });

  describe('getDownstreamWithParents', () => {
    it('should return parentId for each downstream node', () => {
      const manifestJson = loadTestManifest('v12', 'manifest_1.10.json');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const graphologyGraph = graph.getGraph();
      let testNodeId: string | null = null;

      graphologyGraph.forEachNode((nodeId) => {
        const outbound = graphologyGraph.outboundNeighbors(nodeId);
        if (outbound.length > 0 && !testNodeId) {
          testNodeId = nodeId;
        }
      });

      if (testNodeId) {
        const result = graph.getDownstreamWithParents(testNodeId!);
        expect(result.length).toBeGreaterThan(0);
        for (const { nodeId, depth, parentId } of result) {
          expect(typeof nodeId).toBe('string');
          expect(typeof depth).toBe('number');
          expect(typeof parentId).toBe('string');
          expect(graphologyGraph.hasNode(parentId)).toBe(true);
        }
      }
    });

    it('should return empty array for non-existent node', () => {
      const manifestJson = loadTestManifest('v12', 'manifest_1.10.json');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      expect(graph.getDownstreamWithParents('non.existent.node')).toEqual([]);
    });

    it('should return empty array for leaf node (no outbound)', () => {
      const manifestJson = loadTestManifest('v12', 'manifest_1.10.json');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);
      const graphologyGraph = graph.getGraph();

      let leafNodeId: string | null = null;
      graphologyGraph.forEachNode((nodeId) => {
        if (graphologyGraph.outboundNeighbors(nodeId).length === 0 && !leafNodeId) {
          leafNodeId = nodeId;
        }
      });

      if (leafNodeId) {
        expect(graph.getDownstreamWithParents(leafNodeId)).toEqual([]);
      }
    });

    it('should limit by maxDepth when specified', () => {
      const manifestJson = loadTestManifest('v12', 'manifest_1.10.json');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const full = graph.getDownstreamWithParents('model.jaffle_shop.stg_customers');
      const depth1 = graph.getDownstreamWithParents('model.jaffle_shop.stg_customers', 1);
      expect(depth1.length).toBeLessThanOrEqual(full.length);
      depth1.forEach(({ depth }) => expect(depth).toBe(1));
    });

    it('should have parentId equal to root for depth-1 nodes', () => {
      const manifestJson = loadTestManifest('v12', 'manifest_1.10.json');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);
      const rootId = 'model.jaffle_shop.stg_customers';

      const result = graph.getDownstreamWithParents(rootId);
      const depth1Entries = result.filter((e) => e.depth === 1);
      depth1Entries.forEach(({ parentId }) => {
        expect(parentId).toBe(rootId);
      });
    });
  });

  describe('getGraph', () => {
    it('should return the underlying graphology graph', () => {
      const manifestJson = loadTestManifest('v12', 'manifest_1.10.json');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const graphologyGraph = graph.getGraph();
      expect(graphologyGraph).toBeDefined();
      expect(typeof graphologyGraph.order).toBe('number');
      expect(typeof graphologyGraph.size).toBe('number');
    });
  });

  describe('field-level lineage', () => {
    it('should add field nodes from catalog', () => {
      const manifestJson = loadTestManifest('v12', 'manifest_1.10.json');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const catalog = {
        nodes: {
          'model.jaffle_shop.customers': {
            columns: {
              id: { type: 'integer', comment: 'Primary key' },
              name: { type: 'string' },
            },
          },
        },
        sources: {},
      };

      graph.addFieldNodes(catalog as unknown as ParsedCatalog);
      const graphologyGraph = graph.getGraph();

      expect(graphologyGraph.hasNode('model.jaffle_shop.customers#id')).toBe(true);
      expect(graphologyGraph.hasNode('model.jaffle_shop.customers#name')).toBe(true);

      const idAttr = graphologyGraph.getNodeAttributes('model.jaffle_shop.customers#id');
      expect(idAttr.resource_type).toBe('field');
      expect(idAttr.parent_id).toBe('model.jaffle_shop.customers');

      expect(
        graphologyGraph.hasEdge('model.jaffle_shop.customers', 'model.jaffle_shop.customers#id'),
      ).toBe(true);
      const edgeAttr = graphologyGraph.getEdgeAttributes(
        'model.jaffle_shop.customers',
        'model.jaffle_shop.customers#id',
      );
      expect(edgeAttr.dependency_type).toBe('internal');
    });

    it('should add field-to-field edges and resolve relation names', () => {
      const manifestJson = loadTestManifest('v12', 'manifest_1.10.json');
      // Add relation_name to a node for testing resolution
      const rawManifest = manifestJson as Record<string, Record<string, Record<string, unknown>>>;
      rawManifest['nodes']['model.jaffle_shop.stg_customers']['relation_name'] =
        '"analytics"."core"."stg_customers"';

      const manifest = parseManifest(rawManifest);
      const graph = new ManifestGraph(manifest);

      const dependencies = {
        customer_id: [
          {
            sourceTable: '"analytics"."core"."stg_customers"',
            sourceColumn: 'id',
          },
        ],
      };

      graph.addFieldEdges('model.jaffle_shop.customers', dependencies);
      const graphologyGraph = graph.getGraph();

      expect(graphologyGraph.hasNode('model.jaffle_shop.customers#customer_id')).toBe(true);
      expect(graphologyGraph.hasNode('model.jaffle_shop.stg_customers#id')).toBe(true);

      expect(
        graphologyGraph.hasEdge(
          'model.jaffle_shop.stg_customers#id',
          'model.jaffle_shop.customers#customer_id',
        ),
      ).toBe(true);
      const edgeAttr = graphologyGraph.getEdgeAttributes(
        'model.jaffle_shop.stg_customers#id',
        'model.jaffle_shop.customers#customer_id',
      );
      expect(edgeAttr.dependency_type).toBe('field');
    });
  });
});
