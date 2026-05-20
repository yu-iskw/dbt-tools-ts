import { DirectedGraph } from 'graphology';
import { hasCycle, topologicalSort } from 'graphology-dag';

import { getObjectProperty, incrementMapCount, recordFromMap } from '../../util/typed-map';
import { isSupportedVersion, getVersionInfo, MIN_SUPPORTED_SCHEMA_VERSION } from '../../version';

import type { ColumnDependencyMap } from './sql-analyzer';
import type {
  GraphNodeAttributes,
  GraphEdgeAttributes,
  GraphSummary,
  DbtResourceType,
} from '../../types';
import type { ParsedCatalog } from 'dbt-artifacts-parser/catalog';
import type { ParsedManifest } from 'dbt-artifacts-parser/manifest';

type ManifestEntryMap = Record<string, unknown>;
type OptionalManifestCollections = ParsedManifest & {
  metrics?: ManifestEntryMap;
  semantic_models?: ManifestEntryMap;
  unit_tests?: ManifestEntryMap;
};

function getManifestMetrics(manifest: ParsedManifest): ManifestEntryMap | undefined {
  return (manifest as OptionalManifestCollections).metrics;
}

function getManifestSemanticModels(manifest: ParsedManifest): ManifestEntryMap | undefined {
  return (manifest as OptionalManifestCollections).semantic_models;
}

function getManifestUnitTests(manifest: ParsedManifest): ManifestEntryMap | undefined {
  return (manifest as OptionalManifestCollections).unit_tests;
}
/**
 * ManifestGraph builds and manages a directed graph from a dbt manifest.
 *
 * This class transforms dbt artifacts into a graphology graph, enabling
 * efficient graph operations like cycle detection, path finding, and traversal.
 */
export class ManifestGraph {
  private graph: DirectedGraph<GraphNodeAttributes, GraphEdgeAttributes>;
  private relationMap: Map<string, string> = new Map(); // relation_name -> unique_id

  constructor(manifest: ParsedManifest) {
    if (!isSupportedVersion(manifest)) {
      const versionInfo = getVersionInfo(manifest);
      throw new Error(
        `Unsupported dbt version. ` +
          `Schema version: ${versionInfo.schema_version || 'unknown'}, ` +
          `dbt version: ${versionInfo.dbt_version || 'unknown'}. ` +
          `Requires dbt 1.10+ (manifest schema v${MIN_SUPPORTED_SCHEMA_VERSION}+)`,
      );
    }
    this.graph = new DirectedGraph<GraphNodeAttributes, GraphEdgeAttributes>();
    this.buildGraph(manifest);
  }

  /**
   * Build the graph from manifest data
   */
  private buildGraph(manifest: ParsedManifest): void {
    // Add all nodes from manifest
    this.addNodes(manifest);

    // Add edges based on dependencies
    this.addEdges(manifest);
  }

  /**
   * Add nodes from manifest to the graph
   */
  /** Map relation_name (lowercase) to unique_id when present on manifest entries. */
  private registerRelationName(uniqueId: string, relationName: unknown): void {
    if (!relationName) return;
    this.relationMap.set((relationName as string).toLowerCase(), uniqueId);
  }

  private optionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value !== '' ? value : undefined;
  }

  private optionalStringArray(value: unknown): string[] | undefined {
    return Array.isArray(value) ? (value as string[]) : undefined;
  }

  private baseNodeAttributes(
    uniqueId: string,
    entry: Record<string, unknown>,
  ): Partial<GraphNodeAttributes> {
    return {
      unique_id: uniqueId,
      name: this.optionalString(entry.name) ?? uniqueId,
      package_name: this.optionalString(entry.package_name) ?? '',
      path: this.optionalString(entry.path),
      original_file_path: this.optionalString(entry.original_file_path),
      tags: this.optionalStringArray(entry.tags),
      description: this.optionalString(entry.description),
    };
  }

  private addManifestEntries(
    entries: ManifestEntryMap | undefined,
    buildAttributes: (uniqueId: string, entry: Record<string, unknown>) => GraphNodeAttributes,
    relationNameField?: string,
  ): void {
    if (!entries) return;
    for (const [uniqueId, entry] of Object.entries(entries)) {
      const entryRecord = entry as Record<string, unknown>;
      this.graph.addNode(uniqueId, buildAttributes(uniqueId, entryRecord));
      if (relationNameField != null) {
        this.registerRelationName(uniqueId, getObjectProperty(entryRecord, relationNameField));
      }
    }
  }

  private readMaterialized(config: Record<string, unknown> | undefined): string | undefined {
    const materializedRaw = config?.materialized;
    return typeof materializedRaw === 'string' && materializedRaw.trim() !== ''
      ? materializedRaw
      : undefined;
  }

  private metricArrayStrings(value: unknown, field: string): string[] | undefined {
    if (!Array.isArray(value)) return undefined;
    return (value as Array<Record<string, unknown>>)
      .map((entry) => getObjectProperty(entry, field))
      .filter((entry): entry is string => typeof entry === 'string');
  }

  private buildNodeEntryAttributes(
    uniqueId: string,
    node: Record<string, unknown>,
  ): GraphNodeAttributes {
    const resourceType = this.extractResourceType(
      this.optionalString(node.resource_type) ?? 'model',
    );
    const config = node.config as Record<string, unknown> | undefined;
    const materialized = this.readMaterialized(config);
    return {
      ...this.baseNodeAttributes(uniqueId, node),
      resource_type: resourceType,
      patch_path: this.optionalString(node.patch_path),
      database: this.optionalString(node.database),
      schema: this.optionalString(node.schema),
      compiled_code: this.optionalString(node.compiled_code),
      raw_code: this.optionalString(node.raw_code) ?? this.optionalString(node.raw_sql),
      ...(materialized != null ? { materialized } : {}),
    } as GraphNodeAttributes;
  }

  private buildSourceEntryAttributes(
    uniqueId: string,
    source: Record<string, unknown>,
  ): GraphNodeAttributes {
    return {
      ...this.baseNodeAttributes(uniqueId, source),
      resource_type: 'source',
    } as GraphNodeAttributes;
  }

  private buildMacroEntryAttributes(
    uniqueId: string,
    macro: Record<string, unknown>,
  ): GraphNodeAttributes {
    return {
      ...this.baseNodeAttributes(uniqueId, macro),
      resource_type: 'macro',
      raw_code: this.optionalString(macro.macro_sql),
    } as GraphNodeAttributes;
  }

  private buildExposureEntryAttributes(
    uniqueId: string,
    exposure: Record<string, unknown>,
  ): GraphNodeAttributes {
    return {
      ...this.baseNodeAttributes(uniqueId, exposure),
      resource_type: 'exposure',
    } as GraphNodeAttributes;
  }

  private buildMetricEntryAttributes(
    uniqueId: string,
    metric: Record<string, unknown>,
  ): GraphNodeAttributes {
    const typeParams = metric.type_params as Record<string, unknown> | undefined;
    const filter = metric.filter as Record<string, unknown> | undefined;
    const dependsOn = metric.depends_on as Record<string, unknown> | undefined;
    const tagsValue = metric.tags;
    const tags = typeof tagsValue === 'string' ? [tagsValue] : this.optionalStringArray(tagsValue);
    return {
      ...this.baseNodeAttributes(uniqueId, metric),
      resource_type: 'metric',
      label: this.optionalString(metric.label),
      metric_type: this.optionalString(metric.type),
      metric_expression: this.optionalString(typeParams?.expr),
      metric_measure: this.optionalString(
        (typeParams?.measure as Record<string, unknown> | undefined)?.name,
      ),
      metric_input_measures: this.metricArrayStrings(typeParams?.input_measures, 'name'),
      metric_input_metrics: this.metricArrayStrings(typeParams?.metrics, 'name'),
      metric_time_granularity: this.optionalString(metric.time_granularity),
      metric_filters: this.metricArrayStrings(filter?.where_filters, 'where_sql_template'),
      metric_source_reference: (dependsOn?.nodes as string[] | undefined)?.[0] ?? undefined,
      tags,
    } as GraphNodeAttributes;
  }

  private traverseNeighbors(
    nodeId: string,
    options: {
      maxDepth?: number;
      getNeighbors: (currentNodeId: string) => string[];
      includeParents: boolean;
    },
  ): Array<{ nodeId: string; depth: number; parentId?: string }> {
    if (!this.graph.hasNode(nodeId)) {
      return [];
    }

    const result: Array<{ nodeId: string; depth: number; parentId?: string }> = [];
    const visited = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [];
    let head = 0;

    const enqueueNeighbors = (parentId: string, depth: number) => {
      for (const neighborId of options.getNeighbors(parentId)) {
        if (visited.has(neighborId)) continue;
        visited.add(neighborId);
        result.push(
          options.includeParents
            ? { nodeId: neighborId, depth, parentId }
            : { nodeId: neighborId, depth },
        );
        if (options.maxDepth === undefined || depth < options.maxDepth) {
          queue.push({ id: neighborId, depth });
        }
      }
    };

    enqueueNeighbors(nodeId, 1);

    while (head < queue.length) {
      const { id, depth } = queue[head++];
      enqueueNeighbors(id, depth + 1);
    }

    return result;
  }

  private addNodes(manifest: ParsedManifest): void {
    this.addNodeEntries(manifest.nodes);
    this.addSourceEntries(manifest.sources);
    this.addMacroEntries(manifest.macros);
    this.addExposureEntries(manifest.exposures);
    this.addMetricEntries(getManifestMetrics(manifest));
    this.addSemanticModelEntries(getManifestSemanticModels(manifest));
    this.addUnitTestEntries(getManifestUnitTests(manifest));
  }

  private addNodeEntries(nodes: ParsedManifest['nodes'] | undefined): void {
    this.addManifestEntries(
      nodes as ManifestEntryMap | undefined,
      (uniqueId, node) => this.buildNodeEntryAttributes(uniqueId, node),
      'relation_name',
    );
  }

  private addSourceEntries(sources: ParsedManifest['sources'] | undefined): void {
    this.addManifestEntries(
      sources as ManifestEntryMap | undefined,
      (uniqueId, source) => this.buildSourceEntryAttributes(uniqueId, source),
      'relation_name',
    );
  }

  private addMacroEntries(macros: ParsedManifest['macros'] | undefined): void {
    this.addManifestEntries(macros as ManifestEntryMap | undefined, (uniqueId, macro) =>
      this.buildMacroEntryAttributes(uniqueId, macro),
    );
  }

  private addExposureEntries(exposures: ParsedManifest['exposures'] | undefined): void {
    this.addManifestEntries(exposures as ManifestEntryMap | undefined, (uniqueId, exposure) =>
      this.buildExposureEntryAttributes(uniqueId, exposure),
    );
  }

  private addMetricEntries(metrics: ManifestEntryMap | undefined): void {
    this.addManifestEntries(metrics, (uniqueId, metric) =>
      this.buildMetricEntryAttributes(uniqueId, metric),
    );
  }

  private addSemanticModelEntries(semanticModels: ManifestEntryMap | undefined): void {
    if (!semanticModels) return;
    for (const [uniqueId, semanticModel] of Object.entries(semanticModels)) {
      const sm = semanticModel as Record<string, unknown>;
      this.graph.addNode(uniqueId, {
        unique_id: uniqueId,
        resource_type: 'semantic_model',
        name: (sm.name as string) || uniqueId,
        package_name: (sm.package_name as string) || '',
        path: (sm.path as string) || undefined,
        original_file_path: (sm.original_file_path as string) || undefined,
        description: (sm.description as string) || undefined,
        label: (sm.label as string) || undefined,
        semantic_model_reference: (sm.model as string) || undefined,
        semantic_model_default_time_dimension:
          ((sm.defaults as Record<string, unknown> | undefined)?.agg_time_dimension as
            | string
            | undefined) || undefined,
        semantic_model_entities: Array.isArray(sm.entities)
          ? (sm.entities as Array<Record<string, unknown>>)
              .map((entry) => entry.name)
              .filter((entry): entry is string => typeof entry === 'string')
          : undefined,
        semantic_model_measures: Array.isArray(sm.measures)
          ? (sm.measures as Array<Record<string, unknown>>)
              .map((entry) => entry.name)
              .filter((entry): entry is string => typeof entry === 'string')
          : undefined,
        semantic_model_dimensions: Array.isArray(sm.dimensions)
          ? (sm.dimensions as Array<Record<string, unknown>>)
              .map((entry) => entry.name)
              .filter((entry): entry is string => typeof entry === 'string')
          : undefined,
      });
    }
  }

  private addUnitTestEntries(unitTests: ManifestEntryMap | undefined): void {
    if (!unitTests) return;
    for (const [uniqueId, unitTest] of Object.entries(unitTests)) {
      const ut = unitTest as Record<string, unknown>;
      this.graph.addNode(uniqueId, {
        unique_id: uniqueId,
        resource_type: 'unit_test',
        name: (ut.name as string) || uniqueId,
        package_name: (ut.package_name as string) || '',
      });
    }
  }

  /**
   * Add edges based on dependencies
   */
  private addEdges(manifest: ParsedManifest): void {
    if (manifest.parent_map) {
      this.addEdgesFromParentMap(manifest.parent_map);
    }
    this.addEdgesFromNodeDependsOn(manifest.nodes);
    this.addEdgesFromExposureDependsOn(manifest.exposures);
    this.addEdgesFromMetricDependsOn(getManifestMetrics(manifest));
  }

  private addEdgesFromParentMap(parentMap: Record<string, string[]>): void {
    for (const [childId, parentIds] of Object.entries(parentMap)) {
      if (!this.graph.hasNode(childId)) continue;
      for (const parentId of parentIds) {
        if (this.graph.hasNode(parentId) && !this.graph.hasEdge(parentId, childId)) {
          this.graph.addEdge(parentId, childId, {
            dependency_type: this.inferDependencyType(parentId),
          });
        }
      }
    }
  }

  private addEdgesFromDependsOn(
    childId: string,
    dependsOn: { nodes?: string[]; macros?: string[] },
  ): void {
    if (dependsOn.nodes) {
      for (const depId of dependsOn.nodes) {
        if (this.graph.hasNode(depId) && !this.graph.hasEdge(depId, childId)) {
          this.graph.addEdge(depId, childId, { dependency_type: 'node' });
        }
      }
    }
    if (dependsOn.macros) {
      for (const macroId of dependsOn.macros) {
        if (this.graph.hasNode(macroId) && !this.graph.hasEdge(macroId, childId)) {
          this.graph.addEdge(macroId, childId, { dependency_type: 'macro' });
        }
      }
    }
  }

  private addEdgesFromNodeDependsOn(nodes: ParsedManifest['nodes'] | undefined): void {
    if (!nodes) return;
    for (const [uniqueId, node] of Object.entries(nodes)) {
      const dep = (node as Record<string, unknown>).depends_on as
        | { nodes?: string[]; macros?: string[] }
        | undefined;
      if (dep) this.addEdgesFromDependsOn(uniqueId, dep);
    }
  }

  private addEdgesFromExposureDependsOn(exposures: ParsedManifest['exposures'] | undefined): void {
    if (!exposures) return;
    for (const [uniqueId, exposure] of Object.entries(exposures)) {
      const dep = (exposure as Record<string, unknown>).depends_on as
        | { nodes?: string[]; macros?: string[] }
        | undefined;
      if (dep?.nodes) this.addEdgesFromDependsOn(uniqueId, dep);
    }
  }

  private addEdgesFromMetricDependsOn(metrics: ManifestEntryMap | undefined): void {
    if (!metrics) return;
    for (const [uniqueId, metric] of Object.entries(metrics)) {
      const dep = (metric as Record<string, unknown>).depends_on as
        | { nodes?: string[]; macros?: string[] }
        | undefined;
      if (dep?.nodes) this.addEdgesFromDependsOn(uniqueId, dep);
    }
  }

  /**
   * Extract resource type from manifest node
   */
  private extractResourceType(resourceType: string): DbtResourceType {
    const normalized = resourceType.toLowerCase();
    if (
      [
        'model',
        'source',
        'seed',
        'snapshot',
        'test',
        'analysis',
        'macro',
        'exposure',
        'metric',
        'semantic_model',
        'unit_test',
        'function',
      ].includes(normalized)
    ) {
      return normalized as DbtResourceType;
    }
    return 'model'; // Default fallback
  }

  /**
   * Infer dependency type from node ID
   */
  private inferDependencyType(nodeId: string): 'macro' | 'node' | 'source' {
    if (nodeId.startsWith('macro.')) {
      return 'macro';
    }
    if (nodeId.startsWith('source.')) {
      return 'source';
    }
    return 'node';
  }

  /**
   * Get the underlying graphology graph
   */
  getGraph(): DirectedGraph<GraphNodeAttributes, GraphEdgeAttributes> {
    return this.graph;
  }

  /**
   * Get summary statistics about the graph
   */
  getSummary(): GraphSummary {
    const nodesByType = new Map<string, number>();
    let totalNodes = 0;

    // Count nodes by type
    this.graph.forEachNode((_nodeId, attributes) => {
      totalNodes++;
      const type = attributes.resource_type || 'unknown';
      incrementMapCount(nodesByType, type);
    });

    // Detect cycles using graphology-dag
    const hasCycles = hasCycle(this.graph);

    return {
      total_nodes: totalNodes,
      nodes_by_type: recordFromMap(nodesByType),
      total_edges: this.graph.size,
      has_cycles: hasCycles,
    };
  }

  /**
   * Get all upstream dependencies of a node using BFS.
   * @param nodeId - The node to find upstream dependencies for
   * @param maxDepth - Optional limit; 1 = immediate neighbors only, undefined = all levels
   * @returns Array of { nodeId, depth } where depth is the shortest distance from the node
   */
  getUpstream(nodeId: string, maxDepth?: number): Array<{ nodeId: string; depth: number }> {
    return this.traverseNeighbors(nodeId, {
      maxDepth,
      getNeighbors: (currentNodeId) => this.graph.inboundNeighbors(currentNodeId),
      includeParents: false,
    }).map(({ nodeId: id, depth }) => ({ nodeId: id, depth }));
  }

  /**
   * Get all downstream dependents of a node using BFS.
   * @param nodeId - The node to find downstream dependents for
   * @param maxDepth - Optional limit; 1 = immediate neighbors only, undefined = all levels
   * @returns Array of { nodeId, depth } where depth is the shortest distance from the node
   */
  getDownstream(nodeId: string, maxDepth?: number): Array<{ nodeId: string; depth: number }> {
    return this.traverseNeighbors(nodeId, {
      maxDepth,
      getNeighbors: (currentNodeId) => this.graph.outboundNeighbors(currentNodeId),
      includeParents: false,
    }).map(({ nodeId: id, depth }) => ({ nodeId: id, depth }));
  }

  /**
   * Get upstream dependencies with parent info for tree construction.
   * @returns Array of { nodeId, depth, parentId } where parentId is the BFS predecessor
   */
  getUpstreamWithParents(
    nodeId: string,
    maxDepth?: number,
  ): Array<{ nodeId: string; depth: number; parentId: string }> {
    return this.traverseNeighbors(nodeId, {
      maxDepth,
      getNeighbors: (currentNodeId) => this.graph.inboundNeighbors(currentNodeId),
      includeParents: true,
    }).map(({ nodeId: id, depth, parentId }) => ({
      nodeId: id,
      depth,
      parentId: parentId ?? nodeId,
    }));
  }

  /**
   * Get upstream dependencies in build order (topological sort).
   * Sources and root models first, then models that depend on them.
   * @param nodeId - The node to find upstream dependencies for
   * @param maxDepth - Optional limit; 1 = immediate neighbors only, undefined = all levels
   * @returns Array of { nodeId, depth } in build order
   */
  getUpstreamBuildOrder(
    nodeId: string,
    maxDepth?: number,
  ): Array<{ nodeId: string; depth: number }> {
    const entries = this.getUpstream(nodeId, maxDepth);
    if (entries.length === 0) {
      return [];
    }

    const nodeIds = new Set(entries.map((e) => e.nodeId));
    const depthByNode = new Map(entries.map((e) => [e.nodeId, e.depth]));

    const subgraph = new DirectedGraph<GraphNodeAttributes, GraphEdgeAttributes>();
    for (const nid of nodeIds) {
      subgraph.addNode(nid, this.graph.getNodeAttributes(nid));
    }
    this.graph.forEachEdge((_edge, attr, source, target) => {
      if (nodeIds.has(source) && nodeIds.has(target)) {
        if (!subgraph.hasEdge(source, target)) {
          subgraph.addEdge(source, target, attr);
        }
      }
    });

    const orderedIds = topologicalSort(subgraph);
    return orderedIds.map((nid) => ({
      nodeId: nid,
      depth: depthByNode.get(nid) ?? 0,
    }));
  }

  /**
   * Get downstream dependents with parent info for tree construction.
   * @returns Array of { nodeId, depth, parentId } where parentId is the BFS predecessor
   */
  getDownstreamWithParents(
    nodeId: string,
    maxDepth?: number,
  ): Array<{ nodeId: string; depth: number; parentId: string }> {
    return this.traverseNeighbors(nodeId, {
      maxDepth,
      getNeighbors: (currentNodeId) => this.graph.outboundNeighbors(currentNodeId),
      includeParents: true,
    }).map(({ nodeId: id, depth, parentId }) => ({
      nodeId: id,
      depth,
      parentId: parentId ?? nodeId,
    }));
  }

  /**
   * Add field nodes from catalog metadata
   */
  public addFieldNodes(catalog: ParsedCatalog): void {
    if (catalog.nodes) {
      for (const [uniqueId, node] of Object.entries(catalog.nodes)) {
        if (this.graph.hasNode(uniqueId)) {
          const columns = (node as unknown as Record<string, unknown>).columns as
            | Record<string, unknown>
            | undefined;
          this.processCatalogColumns(uniqueId, columns);
        }
      }
    }

    if (catalog.sources) {
      for (const [uniqueId, source] of Object.entries(catalog.sources)) {
        if (this.graph.hasNode(uniqueId)) {
          const columns = (source as unknown as Record<string, unknown>).columns as
            | Record<string, unknown>
            | undefined;
          this.processCatalogColumns(uniqueId, columns);
        }
      }
    }
  }

  private processCatalogColumns(
    parentUniqueId: string,
    columns: Record<string, unknown> | undefined,
  ): void {
    if (!columns) return;

    const parentNode = this.graph.getNodeAttributes(parentUniqueId);

    for (const [colName, colAttr] of Object.entries(columns)) {
      const fieldUniqueId = `${parentUniqueId}#${colName}`;
      const attr = colAttr as Record<string, unknown> | undefined;
      const description =
        (attr?.comment as string | undefined) ?? (attr?.description as string | undefined);

      // Add field node if it doesn't exist
      if (!this.graph.hasNode(fieldUniqueId)) {
        this.graph.addNode(fieldUniqueId, {
          unique_id: fieldUniqueId,
          resource_type: 'field',
          name: colName,
          package_name: parentNode.package_name,
          parent_id: parentUniqueId,
          description,
        });

        // Add internal edge from parent to field
        this.graph.addEdge(parentUniqueId, fieldUniqueId, {
          dependency_type: 'internal',
        });
      }
    }
  }

  /**
   * Add field-to-field edges based on SQL analysis
   */
  public addFieldEdges(childNodeId: string, dependencies: ColumnDependencyMap): void {
    if (!this.graph.hasNode(childNodeId)) return;

    for (const [targetCol, sourceCols] of Object.entries(dependencies)) {
      const targetFieldId = `${childNodeId}#${targetCol}`;

      // Ensure target field node exists
      this.ensureFieldNode(childNodeId, targetCol);

      for (const source of sourceCols) {
        // Resolve source table name/relation name to unique ID
        const sourceNodeId = this.resolveRelationToUniqueId(source.sourceTable);
        if (!sourceNodeId) continue;

        const sourceFieldId = `${sourceNodeId}#${source.sourceColumn}`;
        this.ensureFieldNode(sourceNodeId, source.sourceColumn);

        // Add field edge from source field to target field
        if (!this.graph.hasEdge(sourceFieldId, targetFieldId)) {
          this.graph.addEdge(sourceFieldId, targetFieldId, {
            dependency_type: 'field',
          });
        }
      }
    }
  }

  private ensureFieldNode(parentNodeId: string, colName: string): string {
    const fieldId = `${parentNodeId}#${colName}`;
    if (!this.graph.hasNode(fieldId)) {
      const parentAttr = this.graph.getNodeAttributes(parentNodeId);
      this.graph.addNode(fieldId, {
        unique_id: fieldId,
        resource_type: 'field',
        name: colName,
        package_name: parentAttr.package_name,
        parent_id: parentNodeId,
      });
      // Add internal edge
      this.graph.addEdge(parentNodeId, fieldId, {
        dependency_type: 'internal',
      });
    }
    return fieldId;
  }

  /**
   * Resolve a relation / table identifier from manifest `relation_name` metadata
   * to a node `unique_id` (models, seeds, snapshots, sources when registered).
   */
  tryResolveRelationName(relationName: string): string | undefined {
    return this.resolveRelationToUniqueId(relationName);
  }

  private resolveRelationToUniqueId(relationName: string): string | undefined {
    // Try exact match
    const normalized = relationName.toLowerCase();
    if (this.relationMap.has(normalized)) {
      return this.relationMap.get(normalized);
    }

    // Try stripping quotes if any
    const unquoted = normalized.replace(/["`]/g, '');
    if (this.relationMap.has(unquoted)) {
      return this.relationMap.get(unquoted);
    }

    // Try partial match if it's just the table name (alias)
    // We also strip quotes from the mapped relations for comparison
    for (const [rel, uid] of this.relationMap.entries()) {
      const relUnquoted = rel.replace(/["`]/g, '');
      if (relUnquoted.endsWith(`.${unquoted}`) || relUnquoted === unquoted) {
        return uid;
      }
    }

    return undefined;
  }

  /**
   * Build a focused subgraph centred on a single node.
   *
   * @param focusId - unique_id of the focal node (must exist in the graph)
   * @param direction - which edges to traverse: "upstream", "downstream", or "both"
   * @param depth - optional max traversal hops (undefined = unlimited)
   * @param resourceTypes - optional set of resource_type values to keep (undefined = keep all)
   * @returns A new DirectedGraph containing only the focal node, the reachable
   *          nodes in the requested direction(s), and the edges between them.
   * @throws Error if focusId is not found in the graph
   */
  buildSubgraph(
    focusId: string,
    direction: 'both' | 'downstream' | 'upstream',
    depth?: number,
    resourceTypes?: Set<string>,
  ): DirectedGraph<GraphNodeAttributes, GraphEdgeAttributes> {
    if (!this.graph.hasNode(focusId)) {
      throw new Error(`Focus node not found in manifest: ${focusId}`);
    }

    const included = new Set<string>([focusId]);

    if (direction === 'upstream' || direction === 'both') {
      for (const { nodeId } of this.getUpstream(focusId, depth)) {
        included.add(nodeId);
      }
    }
    if (direction === 'downstream' || direction === 'both') {
      for (const { nodeId } of this.getDownstream(focusId, depth)) {
        included.add(nodeId);
      }
    }

    const subgraph = new DirectedGraph<GraphNodeAttributes, GraphEdgeAttributes>();

    for (const nodeId of included) {
      if (!this.graph.hasNode(nodeId)) continue;
      const attrs = this.graph.getNodeAttributes(nodeId);
      // Always include the focal node itself; resource-type filter only applies to
      // traversed neighbours so the subgraph is never empty when the node exists.
      const isFocusNode = nodeId === focusId;
      if (!isFocusNode && resourceTypes && !resourceTypes.has(attrs.resource_type.toLowerCase())) {
        continue;
      }
      subgraph.addNode(nodeId, attrs);
    }

    this.graph.forEachEdge((_edgeId, attrs, source, target) => {
      if (subgraph.hasNode(source) && subgraph.hasNode(target)) {
        if (!subgraph.hasEdge(source, target)) {
          subgraph.addEdge(source, target, attrs);
        }
      }
    });

    return subgraph;
  }
}
