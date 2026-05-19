/**
 * Timeline CLI action handler – per-node execution records from run_results.json.
 * Distinct from run-report: this command exposes row-level timeline entries,
 * not aggregated stats.
 */
import {
  ManifestGraph,
  loadManifest,
  loadRunResults,
  validateSafePath,
  buildNodeExecutionsFromRunResults,
  formatAdapterMetricValue,
  getAdapterMetricValue,
  getPresentAdapterMetricDescriptors,
  searchRunResults,
  sortByExecutionSortKey,
  formatOutput,
  shouldOutputJSON,
  type NodeExecution,
  type AdapterResponseMetrics,
  type ArtifactPaths,
  type ExecutionSortKey,
} from '@dbt-tools/core';

import {
  resolveCliArtifactPaths,
  type ArtifactRootCliOptions,
} from '../../internal/cli-artifact-resolve';

export type TimelineOptions = ArtifactRootCliOptions & {
  sort?: string;
  top?: number;
  failedOnly?: boolean;
  status?: string;
  adapterText?: string;
  format?: string;
  json?: boolean;
  noJson?: boolean;
};

export type TimelineEntry = {
  unique_id: string;
  name?: string;
  resource_type?: string;
  status: string;
  execution_time: number;
  started_at?: string;
  completed_at?: string;
  thread_id?: string;
  message?: string;
  adapter_metrics?: AdapterResponseMetrics;
};

export type TimelineResult = {
  total: number;
  entries: TimelineEntry[];
};

/** Build a name/type lookup map from a ManifestGraph */
function buildNodeLookup(
  graph: ManifestGraph,
): Map<string, { name: string; resource_type: string }> {
  const map = new Map<string, { name: string; resource_type: string }>();
  const g = graph.getGraph();
  g.forEachNode((_id, attrs) => {
    map.set(attrs.unique_id, {
      name: attrs.name,
      resource_type: attrs.resource_type,
    });
  });
  return map;
}

/** Map NodeExecution to TimelineEntry, enriching with manifest data when available */
function toTimelineEntry(
  exec: NodeExecution,
  lookup: Map<string, { name: string; resource_type: string }> | undefined,
): TimelineEntry {
  const meta = lookup?.get(exec.unique_id);
  return {
    unique_id: exec.unique_id,
    name: meta?.name,
    resource_type: meta?.resource_type,
    status: exec.status,
    execution_time: exec.execution_time,
    started_at: exec.started_at,
    completed_at: exec.completed_at,
    thread_id: exec.thread_id,
    message: exec.message,
    adapter_metrics: exec.adapterMetrics,
  };
}

/**
 * Format timeline as a human-readable table.
 */
export function formatTimeline(result: TimelineResult): string {
  const lines: string[] = [];
  lines.push('dbt Execution Timeline');
  lines.push('======================');
  lines.push(`Total entries: ${result.total}`);

  if (result.entries.length === 0) {
    lines.push('(no matching executions)');
    return lines.join('\n');
  }

  lines.push('');
  const descriptors = getPresentAdapterMetricDescriptors(
    result.entries.map((entry) => entry.adapter_metrics),
  ).filter((descriptor) => descriptor.key !== 'adapterMessage' && descriptor.key !== 'projectId');

  lines.push('  #     Status     Time (s)  Type              Name / unique_id');
  lines.push(
    '  ----  ---------  --------  ----------------  ----------------------------------------',
  );

  for (let i = 0; i < result.entries.length; i++) {
    const e = result.entries[i];
    const rank = String(i + 1).padStart(4);
    const status = (e.status || 'unknown').padEnd(9).slice(0, 9);
    const time = e.execution_time.toFixed(2).padStart(8);
    const rt = (e.resource_type || '').padEnd(16).slice(0, 16);
    const label = e.name ?? e.unique_id;
    lines.push(`  ${rank}  ${status}  ${time}  ${rt}  ${label}`);
    for (const descriptor of descriptors) {
      const value = getAdapterMetricValue(e.adapter_metrics, descriptor.key);
      if (value === undefined) continue;
      lines.push(`        ${descriptor.label}: ${formatAdapterMetricValue(descriptor, value)}`);
    }
  }

  return lines.join('\n');
}

/** Format timeline as CSV */
export function formatTimelineCsv(entries: TimelineEntry[]): string {
  const descriptors = getPresentAdapterMetricDescriptors(
    entries.map((entry) => entry.adapter_metrics),
  );
  const header = [
    'unique_id',
    'name',
    'resource_type',
    'status',
    'execution_time',
    'started_at',
    'completed_at',
    'thread_id',
    'message',
    ...descriptors.map((descriptor) => descriptor.key),
  ].join(',');
  const escape = (v: string | undefined): string => {
    const s = v ?? '';
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const rows = entries.map((e) =>
    [
      escape(e.unique_id),
      escape(e.name),
      escape(e.resource_type),
      escape(e.status),
      String(e.execution_time),
      escape(e.started_at),
      escape(e.completed_at),
      escape(e.thread_id),
      escape(e.message),
      ...descriptors.map((descriptor) =>
        escape(
          (() => {
            const value = getAdapterMetricValue(e.adapter_metrics, descriptor.key);
            return value === undefined ? undefined : String(value);
          })(),
        ),
      ),
    ].join(','),
  );
  return [header, ...rows].join('\n');
}

const ALLOWED_SORTS = new Set([
  'duration',
  'start',
  'query_id',
  'adapter_code',
  'adapter_message',
  'bytes_processed',
  'bytes_billed',
  'slot_ms',
  'rows_affected',
  'rows_inserted',
  'rows_updated',
  'rows_deleted',
  'rows_duplicated',
]);

type TimelineLookup = Map<string, { name: string; resource_type: string }>;

function normalizeTimelineSortKey(sort: string | undefined): string {
  return (sort ?? 'duration').toLowerCase();
}

function validateTimelineSortKey(sortKey: string): void {
  if (!ALLOWED_SORTS.has(sortKey)) {
    throw new Error(`--sort must be one of: ${[...ALLOWED_SORTS].join(', ')}`);
  }
}

function loadTimelineContext(
  paths: ArtifactPaths,
  enrichWithManifest: boolean,
): {
  runResults: ReturnType<typeof loadRunResults>;
  adapterType: string | null | undefined;
  executions: NodeExecution[];
  lookup: TimelineLookup | undefined;
} {
  const runResults = loadRunResults(paths.runResults);
  let adapterType: string | null | undefined;
  let executions: NodeExecution[] = buildNodeExecutionsFromRunResults(runResults);
  let lookup: TimelineLookup | undefined;

  if (enrichWithManifest) {
    validateSafePath(paths.manifest);
    try {
      const manifest = loadManifest(paths.manifest);
      const graph = new ManifestGraph(manifest);
      lookup = buildNodeLookup(graph);
      adapterType = manifest.metadata?.adapter_type ?? null;
      executions = buildNodeExecutionsFromRunResults(runResults, adapterType);
    } catch {
      // manifest loading is best-effort for enrichment
    }
  }

  return { runResults, adapterType, executions, lookup };
}

function applyTimelineFilters(
  executions: NodeExecution[],
  options: TimelineOptions,
): NodeExecution[] {
  let nextExecutions = executions;
  if (options.failedOnly) {
    nextExecutions = nextExecutions.filter((e) => e.status !== 'success' && e.status !== 'pass');
  } else if (options.status) {
    const statuses = options.status
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    nextExecutions = searchRunResults(nextExecutions, { status: statuses });
  }
  if (options.adapterText) {
    nextExecutions = searchRunResults(nextExecutions, {
      adapter_text: options.adapterText,
    });
  }
  return nextExecutions;
}

function sortTimelineExecutions(executions: NodeExecution[], sortKey: string): NodeExecution[] {
  if (sortKey === 'duration') {
    return searchRunResults(executions, {
      sort: 'execution_time_desc',
    });
  }
  if (sortKey === 'start') {
    return [...executions].sort((a, b) => {
      const aTs = a.started_at ?? '';
      const bTs = b.started_at ?? '';
      return aTs.localeCompare(bTs);
    });
  }

  const descendingSortKeys = new Set([
    'bytes_processed',
    'bytes_billed',
    'slot_ms',
    'rows_affected',
    'rows_inserted',
    'rows_updated',
    'rows_deleted',
    'rows_duplicated',
  ]);
  const searchSortKey =
    `${sortKey}${descendingSortKeys.has(sortKey) ? '_desc' : ''}` as ExecutionSortKey;
  return sortByExecutionSortKey(executions, searchSortKey);
}

function formatTimelineOutput(result: TimelineResult, options: TimelineOptions): string {
  const outputFormat = (options.format ?? '').toLowerCase();
  const useJson = shouldOutputJSON(options.json, options.noJson);
  if (outputFormat === 'csv') {
    return formatTimelineCsv(result.entries);
  }
  if (outputFormat === 'table' || (!useJson && outputFormat !== 'json')) {
    return formatTimeline(result);
  }
  return formatOutput(result, true);
}

/**
 * Timeline action handler
 */
export async function timelineAction(
  options: TimelineOptions,
  handleError: (error: unknown, preferStructuredErrors: boolean) => void,
): Promise<void> {
  try {
    const sortKey = normalizeTimelineSortKey(options.sort);
    validateTimelineSortKey(sortKey);

    const paths = await resolveCliArtifactPaths(
      {
        dbtTarget: options.dbtTarget,
      },
      { manifest: false, runResults: true },
    );
    validateSafePath(paths.runResults);

    const context = loadTimelineContext(paths, true);
    let executions = applyTimelineFilters(context.executions, options);
    executions = sortTimelineExecutions(executions, sortKey);

    // Top N
    if (options.top !== undefined && options.top > 0) {
      executions = executions.slice(0, options.top);
    }

    const entries = executions.map((e) => toTimelineEntry(e, context.lookup));
    const result: TimelineResult = { total: entries.length, entries };
    console.log(formatTimelineOutput(result, options));
  } catch (error) {
    handleError(error, shouldOutputJSON(options.json, options.noJson));
  }
}
