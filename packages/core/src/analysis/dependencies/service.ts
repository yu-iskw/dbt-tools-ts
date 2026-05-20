import { FieldFilter } from '../../formatting/field-filter';

import type { GraphNodeAttributes } from '../../types';
import type { ManifestGraph } from '../manifest/graph';

/**
 * Dependency analysis result (flat format)
 */
export interface DependencyResult {
  resource_id: string;
  direction: 'downstream' | 'upstream';
  build_order?: boolean;
  dependencies: Array<{
    unique_id: string;
    resource_type: string;
    name: string;
    package_name: string;
    depth: number;
    [key: string]: unknown;
  }>;
  count: number;
}

/**
 * Nested dependency node for tree format
 */
export interface DependencyTreeNode {
  unique_id: string;
  resource_type: string;
  name: string;
  package_name: string;
  depth: number;
  dependencies: DependencyTreeNode[];
  [key: string]: unknown;
}

/**
 * Dependency result in tree format
 */
export interface DependencyResultTree {
  resource_id: string;
  direction: 'downstream' | 'upstream';
  dependencies: DependencyTreeNode[];
  count: number;
}

/**
 * DependencyService wraps ManifestGraph dependency methods with formatting
 * and field filtering capabilities.
 */
export class DependencyService {
  /**
   * Get dependencies for a resource with optional field filtering, depth limit, output format, and build order.
   * @param depth - Optional max traversal depth; 1 = immediate neighbors, undefined = all levels
   * @param format - Output structure: flat list or nested tree
   * @param buildOrder - When true and direction is upstream, return dependencies in topological build order
   */
  static getDependencies(
    graph: ManifestGraph,
    resourceId: string,
    direction: 'downstream' | 'upstream',
    fields?: string,
    depth?: number,
    format?: 'flat' | 'tree',
    buildOrder?: boolean,
  ): DependencyResult | DependencyResultTree {
    if (format === 'tree' && !(direction === 'upstream' && buildOrder)) {
      return this.getDependenciesTree(graph, resourceId, direction, fields, depth);
    }

    // Flat format (or tree with buildOrder: use flat + build order)
    const dependencyEntries =
      direction === 'upstream' && buildOrder
        ? graph.getUpstreamBuildOrder(resourceId, depth)
        : direction === 'upstream'
          ? graph.getUpstream(resourceId, depth)
          : graph.getDownstream(resourceId, depth);

    const graphologyGraph = graph.getGraph();

    const dependencies: DependencyResult['dependencies'] = dependencyEntries.map(
      ({ nodeId, depth: depDepth }) => {
        const attributes = graphologyGraph.getNodeAttributes(nodeId) as GraphNodeAttributes;

        return {
          ...attributes,
          unique_id: nodeId,
          resource_type: attributes.resource_type || 'unknown',
          name: attributes.name || nodeId,
          package_name: attributes.package_name || '',
          depth: depDepth,
        };
      },
    );

    let filteredDependencies = dependencies;
    if (fields) {
      filteredDependencies = FieldFilter.filterArrayFields(
        dependencies,
        fields,
      ) as DependencyResult['dependencies'];
    }

    return {
      resource_id: resourceId,
      direction,
      ...(buildOrder && direction === 'upstream' && { build_order: true }),
      dependencies: filteredDependencies,
      count: filteredDependencies.length,
    };
  }

  /**
   * Build nested tree from BFS entries with parent tracking
   */
  private static getDependenciesTree(
    graph: ManifestGraph,
    resourceId: string,
    direction: 'downstream' | 'upstream',
    fields?: string,
    depth?: number,
  ): DependencyResultTree {
    const entries =
      direction === 'upstream'
        ? graph.getUpstreamWithParents(resourceId, depth)
        : graph.getDownstreamWithParents(resourceId, depth);

    const graphologyGraph = graph.getGraph();

    // Build parent -> children map (parentId is the BFS predecessor)
    const childrenByParent = new Map<string, Array<{ nodeId: string; depth: number }>>();
    for (const { nodeId, depth: depDepth, parentId } of entries) {
      const existing = childrenByParent.get(parentId) ?? [];
      existing.push({ nodeId, depth: depDepth });
      childrenByParent.set(parentId, existing);
    }

    const buildNode = (nodeId: string, depDepth: number): DependencyTreeNode => {
      const attributes = graphologyGraph.getNodeAttributes(nodeId) as GraphNodeAttributes;

      const childEntries = childrenByParent.get(nodeId) ?? [];
      const childNodes = childEntries.map(({ nodeId: cId, depth: cDepth }) =>
        buildNode(cId, cDepth),
      );

      const node: DependencyTreeNode = {
        ...attributes,
        unique_id: nodeId,
        resource_type: attributes.resource_type || 'unknown',
        name: attributes.name || nodeId,
        package_name: attributes.package_name || '',
        depth: depDepth,
        dependencies: childNodes,
      };

      if (fields) {
        const filtered = FieldFilter.filterFields(node, fields) as Record<string, unknown>;
        return {
          ...filtered,
          dependencies: node.dependencies,
        } as DependencyTreeNode;
      }

      return node;
    };

    const rootChildren = childrenByParent.get(resourceId) ?? [];
    const dependencyTrees = rootChildren.map(({ nodeId, depth: d }) => buildNode(nodeId, d));

    return {
      resource_id: resourceId,
      direction,
      dependencies: dependencyTrees,
      count: entries.length,
    };
  }
}
