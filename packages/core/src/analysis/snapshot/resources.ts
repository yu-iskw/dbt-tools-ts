import { getObjectProperty, setObjectProperty } from '../../util/typed-map';
import { buildNodeExecutionSemantics } from '../execution/semantics';

import { buildResourceDefinition, sortResources, statusLabel, statusTone } from './shared';
import { buildTestAttachedTargetDisplay } from './test-target';

import type { GraphLike, ManifestEntryLookup } from './internal';
import type {
  AnalysisArtifactInputs,
  AnalysisSnapshot,
  CatalogResourceStats,
  ResourceNode,
  SourceFreshnessDetails,
} from './types';
import type { NodeExecution } from '../execution/analyzer';

function optionalStringField(obj: Record<string, unknown>, key: string): string | null {
  const v = getObjectProperty(obj, key);
  return typeof v === 'string' ? v : null;
}

function readGraphResourceCore(uniqueId: string, attributes: Record<string, unknown>) {
  const tags = Array.isArray(attributes.tags)
    ? attributes.tags.filter((tag): tag is string => typeof tag === 'string')
    : undefined;
  return {
    uniqueId,
    name: String(attributes.name || uniqueId),
    resourceType: String(attributes.resource_type || 'unknown'),
    packageName: String(attributes.package_name || ''),
    ...(tags !== undefined ? { tags } : {}),
    path: optionalStringField(attributes, 'path'),
    originalFilePath: optionalStringField(attributes, 'original_file_path'),
    patchPath: optionalStringField(attributes, 'patch_path'),
    database: optionalStringField(attributes, 'database'),
    schema: optionalStringField(attributes, 'schema'),
    description: optionalStringField(attributes, 'description'),
  };
}

function optionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function buildCatalogLookup(
  catalogJson?: AnalysisArtifactInputs['catalogJson'],
): Map<string, Record<string, unknown>> {
  const lookup = new Map<string, Record<string, unknown>>();
  if (catalogJson == null) return lookup;
  for (const groupKey of ['nodes', 'sources'] as const) {
    const group =
      groupKey === 'nodes'
        ? catalogJson.nodes
        : groupKey === 'sources'
          ? catalogJson.sources
          : undefined;
    if (group == null || typeof group !== 'object') continue;
    for (const [uniqueId, value] of Object.entries(group)) {
      if (value != null && typeof value === 'object') {
        lookup.set(uniqueId, value as Record<string, unknown>);
      }
    }
  }
  return lookup;
}

function buildCatalogStats(
  entry: Record<string, unknown> | undefined,
): CatalogResourceStats | null {
  if (entry == null) return null;
  const columns =
    entry.columns != null && typeof entry.columns === 'object'
      ? (entry.columns as Record<string, unknown>)
      : undefined;
  const metadata =
    entry.metadata != null && typeof entry.metadata === 'object'
      ? (entry.metadata as Record<string, unknown>)
      : undefined;
  const stats =
    entry.stats != null && typeof entry.stats === 'object'
      ? (entry.stats as Record<string, unknown>)
      : undefined;

  return {
    columnCount: columns == null ? 0 : Object.keys(columns).length,
    tableType:
      typeof metadata?.type === 'string'
        ? metadata.type
        : typeof metadata?.table_type === 'string'
          ? metadata.table_type
          : null,
    bytes:
      optionalNumber(stats?.bytes) ??
      optionalNumber(stats?.num_bytes) ??
      optionalNumber(stats?.size),
    rowCount:
      optionalNumber(stats?.row_count) ??
      optionalNumber(stats?.num_rows) ??
      optionalNumber(stats?.rows),
  };
}

function buildSourcesLookup(
  sourcesJson?: AnalysisArtifactInputs['sourcesJson'],
): Map<string, Record<string, unknown>> {
  const lookup = new Map<string, Record<string, unknown>>();
  const results = sourcesJson?.results;
  if (!Array.isArray(results)) return lookup;
  for (const result of results) {
    if (result == null || typeof result !== 'object') continue;
    const entry = result as Record<string, unknown>;
    const uniqueId = entry.unique_id;
    if (typeof uniqueId === 'string' && uniqueId.length > 0) {
      lookup.set(uniqueId, entry);
    }
  }
  return lookup;
}

function buildDurationThreshold(value: unknown): string | null {
  if (value == null || typeof value !== 'object') return null;
  const count =
    typeof (value as Record<string, unknown>).count === 'number'
      ? (value as Record<string, unknown>).count
      : null;
  const period =
    typeof (value as Record<string, unknown>).period === 'string'
      ? (value as Record<string, unknown>).period
      : null;
  if (count == null || period == null) return null;
  return `${count} ${period}`;
}

function buildSourceFreshness(
  resourceType: string,
  entry: Record<string, unknown> | undefined,
): SourceFreshnessDetails | null {
  if (resourceType !== 'source' || entry == null) return null;
  const criteria =
    entry.criteria != null && typeof entry.criteria === 'object'
      ? (entry.criteria as Record<string, unknown>)
      : undefined;
  const rawStatus =
    typeof entry.status === 'string' && entry.status.trim() !== '' ? entry.status : undefined;

  return {
    status: rawStatus == null ? 'Unknown' : statusLabel(rawStatus),
    statusTone: statusTone(rawStatus),
    maxLoadedAt: typeof entry.max_loaded_at === 'string' ? entry.max_loaded_at : null,
    snapshottedAt: typeof entry.snapshotted_at === 'string' ? entry.snapshotted_at : null,
    ageSeconds: optionalNumber(entry.max_loaded_at_time_ago_in_s),
    criteria:
      criteria == null
        ? null
        : {
            warnAfter: buildDurationThreshold(criteria.warn_after),
            errorAfter: buildDurationThreshold(criteria.error_after),
            filter: typeof criteria.filter === 'string' ? criteria.filter : null,
          },
    error:
      typeof entry.error === 'string'
        ? entry.error
        : typeof entry.message === 'string'
          ? entry.message
          : null,
  };
}

function mapDependencyNeighbors(
  graph: GraphLike,
  graphologyGraph: ReturnType<GraphLike['getGraph']>,
  uniqueId: string,
) {
  const mapNeighbor = (entry: { nodeId: string; depth: number }) => {
    const attrs = graphologyGraph.getNodeAttributes(entry.nodeId);
    return {
      uniqueId: entry.nodeId,
      name: String(attrs?.name || entry.nodeId),
      resourceType: String(attrs?.resource_type || 'unknown'),
      depth: entry.depth,
    };
  };
  const upstream = graph.getUpstream(uniqueId, 1);
  const downstream = graph.getDownstream(uniqueId, 1);
  return {
    upstreamCount: upstream.length,
    downstreamCount: downstream.length,
    upstream: upstream.map(mapNeighbor),
    downstream: downstream.map(mapNeighbor),
  };
}

function buildResourceNode(
  uniqueId: string,
  attributes: Record<string, unknown>,
  execution: NodeExecution | undefined,
  manifestEntry: Record<string, unknown> | undefined,
  graph: GraphLike,
  manifestEntryLookup: ManifestEntryLookup,
  adapterType: string | null | undefined,
  enrichment: {
    catalogEntry?: Record<string, unknown>;
    sourcesEntry?: Record<string, unknown>;
  },
): ResourceNode {
  const withValue = <T extends object, K extends string, V>(
    condition: boolean,
    key: K,
    value: V,
  ): Record<string, V> | T => (condition ? { [key]: value } : {});

  const core = readGraphResourceCore(uniqueId, attributes);
  const { resourceType } = core;
  const materializedRaw = optionalStringField(attributes, 'materialized');
  const mat = materializedRaw != null && materializedRaw.trim() !== '' ? materializedRaw : null;
  const semantics = buildNodeExecutionSemantics({
    resourceType,
    materialized: mat,
    manifestEntry: manifestEntryLookup.get(uniqueId) ?? null,
    adapterType: adapterType ?? null,
  });
  const isTest = resourceType === 'test' || resourceType === 'unit_test';
  const testAttachedTarget = isTest ? buildTestAttachedTargetDisplay(manifestEntry, graph) : null;
  const runMsg = execution?.message;
  const runResultMessage =
    typeof runMsg === 'string' && runMsg.trim() !== '' ? runMsg.trim() : null;
  const executionTime =
    typeof execution?.execution_time === 'number' ? execution.execution_time : null;
  const threadId = typeof execution?.thread_id === 'string' ? execution.thread_id : null;
  const catalogStats = buildCatalogStats(enrichment.catalogEntry);
  const sourceFreshness = buildSourceFreshness(resourceType, enrichment.sourcesEntry);

  return {
    ...core,
    compiledCode: null,
    rawCode: null,
    definition: buildResourceDefinition(resourceType, attributes),
    status: execution?.status ? statusLabel(execution.status) : null,
    statusTone: statusTone(execution?.status),
    executionTime,
    threadId,
    semantics,
    ...withValue(testAttachedTarget != null, 'testAttachedTarget', testAttachedTarget),
    ...withValue(runResultMessage != null, 'runResultMessage', runResultMessage),
    ...withValue(execution?.adapterMetrics != null, 'adapterMetrics', execution?.adapterMetrics),
    ...withValue(
      execution?.adapterResponseFields != null,
      'adapterResponseFields',
      execution?.adapterResponseFields,
    ),
    ...withValue(catalogStats != null, 'catalogStats', catalogStats),
    ...withValue(sourceFreshness != null, 'sourceFreshness', sourceFreshness),
  };
}

export function buildResourcesAndDependencyIndex(
  graph: GraphLike,
  executionById: Map<string, NodeExecution>,
  manifestEntryLookup: ManifestEntryLookup,
  adapterType: string | null | undefined,
  artifactInputs: Pick<AnalysisArtifactInputs, 'catalogJson' | 'sourcesJson'>,
): {
  resources: AnalysisSnapshot['resources'];
  dependencyIndex: AnalysisSnapshot['dependencyIndex'];
} {
  const resources: AnalysisSnapshot['resources'] = [];
  const dependencyIndex: AnalysisSnapshot['dependencyIndex'] = {};
  const graphologyGraph = graph.getGraph();
  const catalogLookup = buildCatalogLookup(artifactInputs.catalogJson);
  const sourcesLookup = buildSourcesLookup(artifactInputs.sourcesJson);

  graphologyGraph.forEachNode((uniqueId: string, attributes: Record<string, unknown>) => {
    const execution = executionById.get(uniqueId);
    const manifestEntry = manifestEntryLookup.get(uniqueId);
    resources.push(
      buildResourceNode(
        uniqueId,
        attributes,
        execution,
        manifestEntry,
        graph,
        manifestEntryLookup,
        adapterType,
        {
          catalogEntry: catalogLookup.get(uniqueId),
          sourcesEntry: sourcesLookup.get(uniqueId),
        },
      ),
    );
    setObjectProperty(
      dependencyIndex as Record<string, unknown>,
      uniqueId,
      mapDependencyNeighbors(graph, graphologyGraph, uniqueId),
    );
  });

  resources.sort(sortResources);
  return { resources, dependencyIndex };
}
