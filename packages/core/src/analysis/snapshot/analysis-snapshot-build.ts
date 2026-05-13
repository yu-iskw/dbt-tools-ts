import type { ParsedManifest } from 'dbt-artifacts-parser/manifest';
import type { ParsedCatalog } from 'dbt-artifacts-parser/catalog';
import type { ParsedRunResults } from 'dbt-artifacts-parser/run_results';
import type { ParsedSources } from 'dbt-artifacts-parser/sources';
import { buildAdapterTotals } from '../adapter-response-metrics';
import { detectBottlenecks } from '../run-results-search';
import type { ExecutionSummary } from '../execution-analyzer';
import { ExecutionAnalyzer } from '../execution-analyzer';
import { ManifestGraph } from '../manifest-graph';
import type {
  AnalysisArtifactInputs,
  AnalysisSnapshot,
  AnalysisSnapshotBuildTimings,
  ParsedAnalysisArtifactInputs,
} from './analysis-snapshot-types';
import type { GraphLike, GraphologyAttrsGraph, NeighborGraph } from './analysis-snapshot-internal';
import {
  buildInvocationId,
  buildResourceGroups,
  buildTimelineProjectName,
  buildWarehouseType,
  inferPackageNameFromUniqueId,
  inferResourceTypeFromId,
  now,
  statusLabel,
  statusTone,
} from './analysis-snapshot-shared';
import { buildResourcesAndDependencyIndex } from './analysis-snapshot-resources';
import {
  buildManifestEntryLookup,
  buildSyntheticSourceRows,
  buildSyntheticSourceRowsFromExecutedDependents,
  compareGanttItems,
  enrichGanttItemRow,
} from './analysis-snapshot-gantt';
import {
  buildStatusBreakdown,
  buildThreadStats,
  buildTimelineAdjacency,
} from './analysis-snapshot-executions';

function buildEmptyExecutionSummary(): ExecutionSummary {
  return {
    total_execution_time: 0,
    total_nodes: 0,
    nodes_by_status: {},
    node_executions: [],
  };
}

export function buildAnalysisSnapshotFromParsedArtifactBundle(
  artifactInputs: ParsedAnalysisArtifactInputs,
): {
  analysis: AnalysisSnapshot;
  timings: AnalysisSnapshotBuildTimings;
  graph: ManifestGraph;
} {
  const { manifestJson, runResultsJson, catalogJson, sourcesJson, manifest, runResults } =
    artifactInputs;
  const graphStart = now();
  const graph = new ManifestGraph(manifest);
  const warehouseType = buildWarehouseType(manifestJson);
  const analyzer =
    runResults == null ? null : new ExecutionAnalyzer(runResults, graph, warehouseType);
  const graphBuildMs = now() - graphStart;

  const snapshotStart = now();
  const summary = analyzer?.getSummary() ?? buildEmptyExecutionSummary();
  const manifestEntryLookup = buildManifestEntryLookup(manifestJson);
  const ganttData = analyzer?.getGanttData() ?? [];
  const nodeExecutions = analyzer?.getNodeExecutions() ?? [];
  const startTimestamps = nodeExecutions
    .map((e) => (e.started_at ? new Date(e.started_at).getTime() : null))
    .filter((t): t is number => t !== null);
  const runStartedAt: number | null =
    startTimestamps.length > 0 ? Math.min(...startTimestamps) : null;

  const bottlenecks =
    summary.node_executions.length === 0
      ? undefined
      : detectBottlenecks(summary.node_executions, {
          mode: 'top_n',
          top: 5,
          graph,
        });
  const graphSummary = graph.getSummary();
  const ganttById = new Map(ganttData.map((item) => [item.unique_id, item]));
  const executionById = new Map(nodeExecutions.map((e) => [e.unique_id, e]));

  const graphologyGraph = graph.getGraph();

  const { resources, dependencyIndex } = buildResourcesAndDependencyIndex(
    graph as unknown as GraphLike,
    executionById,
    manifestEntryLookup,
    warehouseType,
    { catalogJson, sourcesJson },
  );
  const timelineProjectName = buildTimelineProjectName(
    manifestJson,
    nodeExecutions,
    graphologyGraph,
  );
  const enrichedGanttData = ganttData.map((item) =>
    enrichGanttItemRow(
      item,
      graph as unknown as GraphLike,
      graphologyGraph as GraphologyAttrsGraph,
      manifestEntryLookup,
      warehouseType,
    ),
  );
  const syntheticSourceRows = buildSyntheticSourceRows(
    enrichedGanttData,
    graphologyGraph as GraphologyAttrsGraph,
    manifestEntryLookup,
    warehouseType,
  );
  const combinedAfterSourceTests = [...enrichedGanttData, ...syntheticSourceRows];
  const syntheticSourceFromDependents = buildSyntheticSourceRowsFromExecutedDependents(
    combinedAfterSourceTests,
    graphologyGraph as Parameters<typeof buildSyntheticSourceRowsFromExecutedDependents>[1],
    timelineProjectName,
    manifestEntryLookup,
    warehouseType,
  );
  const timelineGanttData = [
    ...enrichedGanttData,
    ...syntheticSourceRows,
    ...syntheticSourceFromDependents,
  ].sort(compareGanttItems);

  const timelineAdjacency = buildTimelineAdjacency(
    graphologyGraph as unknown as NeighborGraph,
    timelineGanttData.map((g) => g.unique_id),
  );

  const semanticsByResourceId = new Map(resources.map((r) => [r.uniqueId, r.semantics]));

  const executions = nodeExecutions
    .map((execution) => {
      const attrs = graphologyGraph.hasNode(execution.unique_id)
        ? graphologyGraph.getNodeAttributes(execution.unique_id)
        : undefined;
      const gantt = ganttById.get(execution.unique_id);
      const semantics = semanticsByResourceId.get(execution.unique_id);
      return {
        uniqueId: execution.unique_id,
        name: String(attrs?.name || execution.unique_id),
        resourceType: String(attrs?.resource_type || inferResourceTypeFromId(execution.unique_id)),
        packageName: (() => {
          const pkg = attrs?.package_name;
          if (typeof pkg === 'string' && pkg.length > 0) return pkg;
          return inferPackageNameFromUniqueId(execution.unique_id);
        })(),
        path:
          typeof attrs?.original_file_path === 'string'
            ? attrs.original_file_path
            : typeof attrs?.path === 'string'
              ? attrs.path
              : null,
        status: statusLabel(execution.status),
        statusTone: statusTone(execution.status),
        executionTime: execution.execution_time ?? 0,
        threadId: typeof execution.thread_id === 'string' ? execution.thread_id : null,
        start: gantt?.start ?? null,
        end: gantt?.end ?? null,
        ...(execution.adapterMetrics != null ? { adapterMetrics: execution.adapterMetrics } : {}),
        ...(execution.adapterResponseFields != null
          ? { adapterResponseFields: execution.adapterResponseFields }
          : {}),
        ...(semantics != null ? { semantics } : {}),
      };
    })
    .sort((a, b) => b.executionTime - a.executionTime);

  const adapterTotals = buildAdapterTotals(nodeExecutions.map((e) => e.adapterMetrics));

  const resourceGroups = buildResourceGroups(resources);
  const statusBreakdown = buildStatusBreakdown(summary, nodeExecutions);
  const threadStats = buildThreadStats(executions);
  const selectedResourceId =
    resources.find((r) => r.resourceType === 'model')?.uniqueId ?? resources[0]?.uniqueId ?? null;

  const analysis: AnalysisSnapshot = {
    summary,
    projectName: timelineProjectName,
    warehouseType,
    runStartedAt,
    ganttData: timelineGanttData,
    bottlenecks,
    graphSummary: {
      totalNodes: graphSummary.total_nodes,
      totalEdges: graphSummary.total_edges,
      hasCycles: graphSummary.has_cycles,
      nodesByType: graphSummary.nodes_by_type,
    },
    resources,
    resourceGroups,
    executions,
    statusBreakdown,
    threadStats,
    dependencyIndex,
    timelineAdjacency,
    selectedResourceId,
    invocationId: runResultsJson == null ? null : buildInvocationId(runResultsJson),
    ...(adapterTotals != null ? { adapterTotals } : {}),
  };

  return {
    analysis,
    timings: {
      graphBuildMs,
      snapshotBuildMs: now() - snapshotStart,
    },
    graph,
  };
}

export function buildAnalysisSnapshotFromParsedArtifacts(
  manifestJson: Record<string, unknown>,
  runResultsJson: Record<string, unknown>,
  manifest: ParsedManifest,
  runResults: ParsedRunResults,
): {
  analysis: AnalysisSnapshot;
  timings: AnalysisSnapshotBuildTimings;
  graph: ManifestGraph;
} {
  return buildAnalysisSnapshotFromParsedArtifactBundle({
    manifestJson,
    runResultsJson,
    manifest,
    runResults,
  });
}

export async function buildAnalysisSnapshotFromArtifacts(
  manifestJson: Record<string, unknown>,
  runResultsJson: Record<string, unknown>,
): Promise<AnalysisSnapshot> {
  return buildAnalysisSnapshotFromArtifactBundle({
    manifestJson,
    runResultsJson,
  });
}

export async function buildAnalysisSnapshotFromArtifactBundle(
  artifactInputs: AnalysisArtifactInputs,
): Promise<AnalysisSnapshot> {
  const { manifestJson, runResultsJson, catalogJson, sourcesJson } = artifactInputs;
  const [{ parseManifest }, { parseRunResults }] = await Promise.all([
    import('dbt-artifacts-parser/manifest') as Promise<{
      parseManifest: (nextManifestJson: Record<string, unknown>) => ParsedManifest;
    }>,
    import('dbt-artifacts-parser/run_results') as Promise<{
      parseRunResults: (nextRunResultsJson: Record<string, unknown>) => ParsedRunResults;
    }>,
  ]);
  const manifest = parseManifest(manifestJson);
  const parsedPromises: Array<Promise<ParsedRunResults | ParsedCatalog | ParsedSources>> = [];

  if (runResultsJson != null) {
    parsedPromises.push(
      Promise.resolve(parseRunResults(runResultsJson)) as Promise<ParsedRunResults>,
    );
  }
  if (catalogJson != null) {
    parsedPromises.push(
      import('dbt-artifacts-parser/catalog').then(({ parseCatalog }) =>
        parseCatalog(catalogJson),
      ) as Promise<ParsedCatalog>,
    );
  }
  if (sourcesJson != null) {
    parsedPromises.push(
      import('dbt-artifacts-parser/sources').then(({ parseSources }) =>
        parseSources(sourcesJson),
      ) as Promise<ParsedSources>,
    );
  }

  const parsedValues = await Promise.all(parsedPromises);
  let parsedIndex = 0;
  const runResults =
    runResultsJson != null ? (parsedValues[parsedIndex++] as ParsedRunResults) : undefined;
  const catalog = catalogJson != null ? (parsedValues[parsedIndex++] as ParsedCatalog) : undefined;
  const sources = sourcesJson != null ? (parsedValues[parsedIndex++] as ParsedSources) : undefined;

  return buildAnalysisSnapshotFromParsedArtifactBundle({
    manifestJson,
    runResultsJson,
    catalogJson,
    sourcesJson,
    manifest,
    runResults,
    catalog,
    sources,
  }).analysis;
}
