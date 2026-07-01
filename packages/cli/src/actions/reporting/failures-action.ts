/**
 * CLI action: bounded bundle of non-successful run_results rows for agents/operators.
 */
import * as path from 'node:path';

import {
  ManifestGraph,
  loadManifest,
  loadRunResults,
  buildNodeExecutionsFromRunResults,
  existsValidated,
  validateSafePath,
  FieldFilter,
  formatOutput,
  shouldOutputJSON,
  searchRunResults,
  type GraphNodeAttributes,
  type NodeExecution,
  incrementMapCount,
  recordFromMap,
} from '@dbt-tools/core';

import {
  resolveCliArtifactPaths,
  type ArtifactRootCliOptions,
} from '../../internal/cli-artifact-resolve.js';
import { parseListOffset, resolveFailuresLimit } from '../../internal/cli-pagination.js';

export type FailuresOptions = ArtifactRootCliOptions & {
  fields?: string;
  json?: boolean;
  noJson?: boolean;
  status?: string;
  limit?: number;
  offset?: number;
  messageMaxChars?: number;
  includePath?: boolean;
  includeCompiled?: boolean;
  compiledMaxChars?: number;
};

type ManifestNodeGraph = ReturnType<ManifestGraph['getGraph']>;

export type FailureRow = {
  unique_id: string;
  status: string;
  execution_time: number;
  started_at?: string;
  completed_at?: string;
  message?: string;
  message_truncated?: boolean;
  resource_type?: string;
  name?: string;
  path?: string;
  original_file_path?: string;
  compiled_code?: string;
  raw_code?: string;
  compiled_truncated?: boolean;
};

export type FailuresOutput = {
  schema_version: 1;
  target_dir?: string;
  invocation?: Record<string, unknown>;
  summary: {
    statuses: Record<string, number>;
    non_success_total: number;
    returned: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
  failures: FailureRow[];
  next_commands: string[];
  primitive_commands: string[];
};

const DEFAULT_MESSAGE_MAX = 4_000;
const DEFAULT_COMPILED_MAX = 8_000;

function isNonSuccessStatus(status: string): boolean {
  const s = status.toLowerCase();
  return s !== 'success' && s !== 'pass';
}

function truncateField(
  value: string | undefined,
  maxChars: number,
): { text: string | undefined; truncated: boolean } {
  if (value === undefined || value === '') {
    return { text: undefined, truncated: false };
  }
  if (value.length <= maxChars) {
    return { text: value, truncated: false };
  }
  return { text: value.slice(0, maxChars), truncated: true };
}

function sortFailuresStable(rows: NodeExecution[]): NodeExecution[] {
  return [...rows].sort((a, b) => {
    const as = a.started_at ?? '';
    const bs = b.started_at ?? '';
    const cmp = bs.localeCompare(as);
    if (cmp !== 0) return cmp;
    return a.unique_id.localeCompare(b.unique_id);
  });
}

function filterExecutions(
  executions: NodeExecution[],
  statusCsv: string | undefined,
): NodeExecution[] {
  if (statusCsv?.trim()) {
    const statuses = statusCsv
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return searchRunResults(executions, { status: statuses });
  }
  return executions.filter((e) => isNonSuccessStatus(e.status));
}

function countStatuses(rows: NodeExecution[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const r of rows) {
    incrementMapCount(counts, r.status || 'unknown');
  }
  return recordFromMap(counts);
}

function buildDbtHints(rows: FailureRow[], g: ManifestNodeGraph | undefined): string[] {
  const hints = new Set<string>();
  for (const row of rows) {
    const attrs =
      g && g.hasNode(row.unique_id)
        ? (g.getNodeAttributes(row.unique_id) as GraphNodeAttributes)
        : undefined;
    const name =
      row.name ||
      (typeof attrs?.name === 'string' ? attrs.name : undefined) ||
      row.unique_id.split('.').pop() ||
      row.unique_id;
    const rt = (row.resource_type || attrs?.resource_type || '').toLowerCase();
    if (rt === 'test') {
      hints.add(`dbt test -s ${name}`);
    } else if (rt === 'snapshot') {
      hints.add(`dbt snapshot -s ${name}`);
    } else if (rt === 'seed') {
      hints.add(`dbt seed -s ${name}`);
    } else {
      hints.add(`dbt run -s ${name}`);
    }
    if (hints.size >= 20) break;
  }
  return [...hints];
}

function buildPrimitiveCommands(
  dbtTarget: string | undefined,
  sampleUniqueId: string | undefined,
): string[] {
  const t = dbtTarget ?? '.';
  const out: string[] = [
    `dbt-tools timeline --dbt-target "${t}" --failed-only --json`,
    `dbt-tools run-summary --dbt-target "${t}" --json`,
    `dbt-tools query-executions --dbt-target "${t}" --status error,fail,skipped --limit 50 --json`,
  ];
  if (sampleUniqueId) {
    out.push(
      `dbt-tools explain "${sampleUniqueId}" --dbt-target "${t}" --json`,
      `dbt-tools deps "${sampleUniqueId}" --dbt-target "${t}" --direction downstream --json`,
    );
  }
  return out;
}

function getNodeAttrs(
  g: ManifestNodeGraph | undefined,
  uniqueId: string,
): GraphNodeAttributes | undefined {
  if (!g?.hasNode(uniqueId)) return undefined;
  return g.getNodeAttributes(uniqueId) as GraphNodeAttributes;
}

function applyManifestNameFromAttrs(row: FailureRow, attrs: GraphNodeAttributes | undefined): void {
  if (!attrs?.name) return;
  row.name = attrs.name as string;
}

function applyIncludePathFields(row: FailureRow, attrs: GraphNodeAttributes | undefined): void {
  if (!attrs) return;
  row.resource_type = attrs.resource_type as string | undefined;
  if (typeof attrs.path === 'string') row.path = attrs.path;
  if (typeof attrs.original_file_path === 'string') {
    row.original_file_path = attrs.original_file_path;
  }
}

function applyIncludeCompiledFields(
  row: FailureRow,
  attrs: GraphNodeAttributes | undefined,
  compiledMax: number,
): void {
  if (!attrs) return;
  const comp = truncateField(
    typeof attrs.compiled_code === 'string' ? attrs.compiled_code : undefined,
    compiledMax,
  );
  const raw = truncateField(
    typeof attrs.raw_code === 'string' ? attrs.raw_code : undefined,
    compiledMax,
  );
  if (comp.text !== undefined) {
    row.compiled_code = comp.text;
    if (comp.truncated) row.compiled_truncated = true;
  }
  if (raw.text !== undefined) {
    row.raw_code = raw.text;
    if (raw.truncated) row.compiled_truncated = true;
  }
}

function enrichRow(
  base: NodeExecution,
  nodeGraph: ManifestNodeGraph | undefined,
  options: FailuresOptions,
  messageMax: number,
  compiledMax: number,
): FailureRow {
  const msg = truncateField(base.message, messageMax);
  const row: FailureRow = {
    unique_id: base.unique_id,
    status: base.status,
    execution_time: base.execution_time,
    started_at: base.started_at,
    completed_at: base.completed_at,
    message: msg.text,
    ...(msg.truncated ? { message_truncated: true } : {}),
  };

  const attrs = getNodeAttrs(nodeGraph, base.unique_id);
  applyManifestNameFromAttrs(row, attrs);
  if (options.includePath) {
    applyIncludePathFields(row, attrs);
  }
  if (options.includeCompiled) {
    applyIncludeCompiledFields(row, attrs, compiledMax);
  }

  return row;
}

export function formatFailuresHuman(output: FailuresOutput): string {
  const lines: string[] = [];
  lines.push('dbt-tools failures (non-success)');
  lines.push('==============================');
  lines.push(
    `Non-success nodes: ${output.summary.non_success_total} (showing ${output.summary.returned}, limit ${output.summary.limit}, offset ${output.summary.offset})`,
  );
  if (output.summary.has_more) {
    lines.push('(more rows available — increase --limit or --offset)');
  }
  lines.push('');
  if (output.failures.length === 0) {
    lines.push('(no matching failures)');
  } else {
    for (const f of output.failures) {
      lines.push(`${f.unique_id}  [${f.status}]  ${f.execution_time}s`);
      if (f.message) {
        const oneLine = f.message.replace(/\s+/g, ' ').trim();
        lines.push(`  ${oneLine.slice(0, 200)}${oneLine.length > 200 ? '…' : ''}`);
      }
    }
  }
  return lines.join('\n');
}

export async function failuresAction(
  options: FailuresOptions,
  handleError: (error: unknown, preferStructuredErrors: boolean) => void,
): Promise<void> {
  try {
    const paths = await resolveCliArtifactPaths(
      { dbtTarget: options.dbtTarget },
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
    if (hasManifest) {
      const manifest = loadManifest(paths.manifest);
      graph = new ManifestGraph(manifest);
      adapterType = manifest.metadata?.adapter_type ?? null;
    }

    const executions = buildNodeExecutionsFromRunResults(runResults, adapterType);
    const filtered = filterExecutions(executions, options.status);
    const sorted = sortFailuresStable(filtered);
    const nonSuccessTotal = sorted.length;

    const limit = resolveFailuresLimit(options.limit);
    const offset = parseListOffset(options.offset);

    const page = sorted.slice(offset, offset + limit);
    const hasMore = offset + page.length < nonSuccessTotal;

    const nodeGraph = graph?.getGraph();

    const messageMax =
      typeof options.messageMaxChars === 'number' &&
      Number.isFinite(options.messageMaxChars) &&
      options.messageMaxChars > 0
        ? Math.floor(options.messageMaxChars)
        : DEFAULT_MESSAGE_MAX;
    const compiledMax =
      typeof options.compiledMaxChars === 'number' &&
      Number.isFinite(options.compiledMaxChars) &&
      options.compiledMaxChars > 0
        ? Math.floor(options.compiledMaxChars)
        : DEFAULT_COMPILED_MAX;

    const failures: FailureRow[] = page.map((row) =>
      enrichRow(row, nodeGraph, options, messageMax, compiledMax),
    );

    const invocationRaw = (runResults as { metadata?: unknown }).metadata;
    const invocation =
      invocationRaw && typeof invocationRaw === 'object'
        ? (invocationRaw as Record<string, unknown>)
        : undefined;

    const output: FailuresOutput = {
      schema_version: 1,
      target_dir: path.dirname(paths.runResults),
      ...(invocation ? { invocation } : {}),
      summary: {
        statuses: countStatuses(sorted),
        non_success_total: nonSuccessTotal,
        returned: failures.length,
        limit,
        offset,
        has_more: hasMore,
      },
      failures,
      next_commands: buildDbtHints(failures, nodeGraph),
      primitive_commands: buildPrimitiveCommands(options.dbtTarget, failures[0]?.unique_id),
    };

    const useJson = shouldOutputJSON(options.json, options.noJson);
    if (useJson) {
      let out: unknown = output;
      if (options.fields) {
        out = FieldFilter.filterFields(output, options.fields);
      }
      console.log(formatOutput(out, true));
    } else {
      console.log(formatFailuresHuman(output));
    }
  } catch (error) {
    handleError(error, shouldOutputJSON(options.json, options.noJson));
  }
}
