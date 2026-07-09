/**
 * Run-report CLI action handler and helpers.
 */
import {
  ManifestGraph,
  ExecutionAnalyzer,
  buildNodeExecutionsFromRunResults,
  existsValidated,
  loadManifest,
  loadRunResults,
  validateSafePath,
  FieldFilter,
  detectBottlenecks,
  buildAdapterTotals,
  detectAdapterHeavyNodes,
  filterAdapterMetricMins,
  formatOutput,
  formatRunReport,
  formatAdapterTotalsHuman,
  formatAdapterHeavyHuman,
  formatAdapterNodeDetailsHuman,
  shouldOutputJSON,
  type ExecutionSummary,
  type NodeExecution,
  type AdapterHeavyMetric,
  incrementMapCount,
  recordFromMap,
} from '@dbt-tools/core';

import {
  resolveCliArtifactPaths,
  type ArtifactRootCliOptions,
} from '../../internal/cli-artifact-resolve';
import {
  parseListOffset,
  assertOffsetRequiresLimit,
  parseOptionalListLimit,
} from '../../internal/cli-pagination';

type RunReportOptions = ArtifactRootCliOptions & {
  fields?: string;
  bottlenecks?: boolean;
  bottlenecksTop?: number;
  bottlenecksThreshold?: number;
  json?: boolean;
  noJson?: boolean;
  adapterSummary?: boolean;
  adapterTopBy?: AdapterHeavyMetric;
  adapterTopN?: number;
  adapterMinBytes?: number;
  adapterMinSlotMs?: number;
  adapterMinRowsAffected?: number;
  /** CLI `--limit` — aliases `nodeExecutionsLimit` for JSON `node_executions` paging. */
  limit?: number;
  /** CLI `--offset` — aliases `nodeExecutionsOffset`. */
  offset?: number;
  /** When set with JSON output, slice `node_executions` after computing summaries. */
  nodeExecutionsLimit?: number;
  nodeExecutionsOffset?: number;
};

function sortNodeExecutionsForSlice(executions: NodeExecution[]): NodeExecution[] {
  return [...executions].sort((a, b) => {
    const cmp = (a.started_at ?? '').localeCompare(b.started_at ?? '');
    if (cmp !== 0) return cmp;
    return a.unique_id.localeCompare(b.unique_id);
  });
}

/** Create a reduced summary when manifest.json is unavailable. */
function createMinimalSummary(runResults: ReturnType<typeof loadRunResults>): ExecutionSummary {
  const nodesByStatus = new Map<string, number>();
  if (runResults.results) {
    for (const result of runResults.results) {
      incrementMapCount(nodesByStatus, result.status || 'unknown');
    }
  }
  return {
    total_execution_time: runResults.elapsed_time || 0,
    total_nodes: runResults.results?.length || 0,
    nodes_by_status: recordFromMap(nodesByStatus),
    node_executions: [],
  };
}

/** Compute bottlenecks from summary and options */
function computeBottlenecksSection(
  summary: ExecutionSummary,
  options: RunReportOptions,
  graph: ManifestGraph | undefined,
): {
  bottlenecks:
    | {
        nodes: Array<{
          unique_id: string;
          name?: string;
          execution_time: number;
          rank: number;
          pct_of_total: number;
          status: string;
        }>;
        total_execution_time: number;
        criteria_used: 'threshold' | 'top_n';
      }
    | undefined;
  bottlenecksTopLabel: string | undefined;
} {
  if (!options.bottlenecks || !summary.node_executions?.length) {
    return { bottlenecks: undefined, bottlenecksTopLabel: undefined };
  }

  const topN = options.bottlenecksTop ?? 10;
  const threshold = options.bottlenecksThreshold;

  if (options.bottlenecksTop !== undefined && options.bottlenecksThreshold !== undefined) {
    throw new Error('Cannot use both --bottlenecks-top and --bottlenecks-threshold; choose one');
  }

  if (threshold !== undefined && threshold > 0) {
    const bottlenecks = detectBottlenecks(summary.node_executions, {
      mode: 'threshold',
      min_seconds: threshold,
      graph,
    });
    return { bottlenecks, bottlenecksTopLabel: `>= ${threshold}s` };
  }

  const bottlenecks = detectBottlenecks(summary.node_executions, {
    mode: 'top_n',
    top: topN > 0 ? topN : 10,
    graph,
  });
  return { bottlenecks, bottlenecksTopLabel: `top ${topN}` };
}

function filterExecutionsForAdapterTop(
  executions: NodeExecution[],
  options: RunReportOptions,
): NodeExecution[] {
  return filterAdapterMetricMins(executions, {
    minBytesProcessed: options.adapterMinBytes,
    minSlotMs: options.adapterMinSlotMs,
    minRowsAffected: options.adapterMinRowsAffected,
  });
}

function buildAdapterSections(
  adapterSource: NodeExecution[],
  options: RunReportOptions,
  graph: ManifestGraph | undefined,
): {
  jsonParts: Record<string, unknown>;
  humanAppend: string;
} {
  const jsonParts: Record<string, unknown> = {};
  const humanParts: string[] = [];

  const adapterTotals = buildAdapterTotals(adapterSource.map((e) => e.adapterMetrics));
  const summaryMetrics: Array<{
    metric: AdapterHeavyMetric;
    label: string;
  }> = [
    { metric: 'slot_ms', label: 'Top 5 by slot_ms (summary)' },
    {
      metric: 'bytes_processed',
      label: 'Top 5 by bytes_processed (summary)',
    },
    { metric: 'rows_affected', label: 'Top 5 by rows_affected (summary)' },
  ];

  if (options.adapterSummary && adapterTotals != null) {
    jsonParts.adapter_totals = adapterTotals;
    humanParts.push(formatAdapterTotalsHuman(adapterTotals));
    humanParts.push(formatAdapterNodeDetailsHuman(adapterSource));

    if (!options.adapterTopBy && adapterTotals.nodesWithAdapterData > 0) {
      for (const summaryMetric of summaryMetrics) {
        const heavy = detectAdapterHeavyNodes(adapterSource, {
          metric: summaryMetric.metric,
          top: 5,
          graph,
        });
        if (heavy.total_metric > 0) {
          humanParts.push(formatAdapterHeavyHuman(heavy, summaryMetric.label));
        }
      }
    }
  }

  if (options.adapterTopBy) {
    const filtered = filterExecutionsForAdapterTop(adapterSource, options);
    const topN = options.adapterTopN ?? 10;
    const adapterTop = detectAdapterHeavyNodes(filtered, {
      metric: options.adapterTopBy,
      top: topN > 0 ? topN : 10,
      graph,
    });
    jsonParts.adapter_top = adapterTop;
    humanParts.push(formatAdapterHeavyHuman(adapterTop));
  }

  return {
    jsonParts,
    humanAppend: humanParts.join(''),
  };
}

/**
 * Run report action handler
 */
export async function runReportAction(
  options: RunReportOptions,
  handleError: (error: unknown, preferStructuredErrors: boolean) => void,
): Promise<void> {
  try {
    const paths = await resolveCliArtifactPaths(
      {
        dbtTarget: options.dbtTarget,
      },
      { manifest: false, runResults: true },
    );

    validateSafePath(paths.runResults);
    const hasManifest = existsValidated(paths.manifest);
    if (hasManifest) {
      validateSafePath(paths.manifest);
    }

    const runResults = loadRunResults(paths.runResults);

    let graph: ManifestGraph | undefined;
    let adapterType: string | null | undefined;
    let summary: ExecutionSummary;
    if (hasManifest) {
      const manifest = loadManifest(paths.manifest);
      graph = new ManifestGraph(manifest);
      adapterType = manifest.metadata?.adapter_type ?? null;
      const analyzer = new ExecutionAnalyzer(runResults, graph, adapterType);
      summary = analyzer.getSummary();
    } else {
      summary = {
        ...createMinimalSummary(runResults),
        node_executions: buildNodeExecutionsFromRunResults(runResults, adapterType),
      };
    }

    const adapterSource = summary.node_executions;

    const { bottlenecks, bottlenecksTopLabel } = computeBottlenecksSection(summary, options, graph);

    const wantsAdapter = options.adapterSummary === true || options.adapterTopBy != null;
    const { jsonParts: adapterJson, humanAppend: adapterHumanAppend } = wantsAdapter
      ? buildAdapterSections(adapterSource, options, graph)
      : { jsonParts: {}, humanAppend: '' };

    let filteredSummary: ExecutionSummary = summary;
    if (options.fields) {
      filteredSummary = FieldFilter.filterFields(summary, options.fields) as ExecutionSummary;
    }

    const useJson = shouldOutputJSON(options.json, options.noJson);

    if (useJson) {
      const report: Record<string, unknown> = { ...filteredSummary };
      if (bottlenecks) {
        report.bottlenecks = bottlenecks;
      }
      Object.assign(report, adapterJson);

      const lim = parseOptionalListLimit(options.nodeExecutionsLimit ?? options.limit);
      const off = parseListOffset(options.nodeExecutionsOffset ?? options.offset);
      assertOffsetRequiresLimit(lim, off);
      if (lim !== undefined) {
        const full = filteredSummary.node_executions;
        const sorted = sortNodeExecutionsForSlice(full);
        const page = sorted.slice(off, off + lim);
        report.node_executions = page;
        const fullLen = sorted.length;
        const hasMore = off + page.length < fullLen;
        report.node_executions_has_more = hasMore;
        report.node_executions_truncated = off > 0 || hasMore;
        report.node_executions_limit = lim;
        report.node_executions_offset = off;
      }

      console.log(formatOutput(report, true));
    } else {
      console.log(
        formatRunReport(
          filteredSummary,
          bottlenecks,
          bottlenecksTopLabel,
          adapterHumanAppend || undefined,
        ),
      );
    }
  } catch (error) {
    handleError(error, shouldOutputJSON(options.json, options.noJson));
  }
}
