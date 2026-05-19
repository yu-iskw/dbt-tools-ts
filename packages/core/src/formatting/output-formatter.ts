import {
  ADAPTER_METRIC_DESCRIPTORS,
  formatAdapterMetricValue,
} from '../analysis/adapter/descriptors';
import type { AdapterTotalsSnapshot } from '../analysis/adapter/metrics';
import type { NodeExecution } from '../analysis/execution/analyzer';
import type { AdapterHeavyResult } from '../analysis/search/run-results';

type DepNode = {
  unique_id: string;
  resource_type: string;
  name: string;
  depth?: number;
  dependencies?: unknown[];
};

function formatDepsTreeNode(node: DepNode, prefix: string, isLast: boolean, lines: string[]): void {
  const depthStr = typeof node.depth === 'number' ? ` [depth ${node.depth}]` : '';
  const connector = isLast ? '└── ' : '├── ';
  lines.push(
    `${prefix}${connector}${node.unique_id} (${node.resource_type}) - ${node.name}${depthStr}`,
  );

  const children = (node.dependencies ?? []) as DepNode[];
  const childPrefix = prefix + (isLast ? '    ' : '│   ');
  for (let i = 0; i < children.length; i++) {
    formatDepsTreeNode(children[i], childPrefix, i === children.length - 1, lines);
  }
}

function formatDepsTree(result: {
  resource_id: string;
  direction: 'upstream' | 'downstream';
  dependencies: Array<DepNode & { [key: string]: unknown }>;
  count: number;
}): string {
  const rootName = result.resource_id.split('.').pop() ?? result.resource_id;
  const lines: string[] = [];
  lines.push(`${rootName} (${result.direction})`);
  lines.push(`Count: ${result.count}`);
  lines.push('');

  for (let i = 0; i < result.dependencies.length; i++) {
    formatDepsTreeNode(result.dependencies[i], '', i === result.dependencies.length - 1, lines);
  }

  return lines.join('\n');
}

/**
 * Check if stdout is a TTY
 */
export function isTTY(): boolean {
  return process.stdout.isTTY === true;
}

/**
 * Determine if output should be JSON
 */
export function shouldOutputJSON(forceJson?: boolean, forceNoJson?: boolean): boolean {
  if (forceNoJson === true) {
    return false;
  }
  if (forceJson === true) {
    return true;
  }
  return !isTTY();
}

/**
 * Format output as JSON or human-readable based on context
 */
export function formatOutput(data: unknown, forceJson?: boolean, forceNoJson?: boolean): string {
  const useJson = shouldOutputJSON(forceJson, forceNoJson);

  if (useJson) {
    return JSON.stringify(data, null, 2);
  }

  return String(data);
}

/**
 * Format summary command output
 */
export function formatSummary(summary: {
  total_nodes: number;
  total_edges: number;
  has_cycles: boolean;
  nodes_by_type: Record<string, number>;
}): string {
  const lines: string[] = [];
  lines.push('dbt Project Summary');
  lines.push('===================');
  lines.push(`Total Nodes: ${summary.total_nodes}`);
  lines.push(`Total Edges: ${summary.total_edges}`);
  lines.push(`Has Cycles: ${summary.has_cycles ? 'Yes' : 'No'}`);
  lines.push('\nNodes by Type:');
  for (const [type, count] of Object.entries(summary.nodes_by_type)) {
    lines.push(`  ${type}: ${count}`);
  }
  return lines.join('\n');
}

/**
 * Format deps command output (flat or tree)
 */
export function formatDeps(
  result: {
    resource_id: string;
    direction: 'upstream' | 'downstream';
    dependencies: Array<{
      unique_id: string;
      resource_type: string;
      name: string;
      package_name: string;
      depth?: number;
      dependencies?: unknown[];
      [key: string]: unknown;
    }>;
    count: number;
  },
  format?: 'flat' | 'tree',
): string {
  if (format === 'tree') {
    return formatDepsTree(result);
  }

  const lines: string[] = [];
  lines.push(`Dependencies for ${result.resource_id}`);
  lines.push(`Direction: ${result.direction}`);
  lines.push(`Count: ${result.count}`);
  lines.push('\nDependencies:');

  if (result.dependencies.length === 0) {
    lines.push('  (none)');
  } else {
    for (const dep of result.dependencies) {
      const depthStr = typeof dep.depth === 'number' ? ` [depth ${dep.depth}]` : '';
      lines.push(`  - ${dep.unique_id} (${dep.resource_type}) - ${dep.name}${depthStr}`);
    }
  }

  return lines.join('\n');
}

/**
 * Bottleneck node for formatting
 */
export interface BottleneckNodeForFormat {
  unique_id: string;
  name?: string;
  execution_time: number;
  rank: number;
  pct_of_total: number;
  status: string;
}

/**
 * Format bottleneck section for human-readable output
 */
export function formatBottlenecks(
  bottlenecks: {
    nodes: BottleneckNodeForFormat[];
    total_execution_time: number;
    criteria_used: 'top_n' | 'threshold';
  },
  topLabel?: string,
): string {
  if (bottlenecks.nodes.length === 0) {
    return '\nBottlenecks: (none)\n';
  }

  const criteriaLabel = topLabel ?? (bottlenecks.criteria_used === 'top_n' ? 'top N' : 'threshold');
  const lines: string[] = [];
  lines.push(`\nBottlenecks (${criteriaLabel} by execution time):`);
  lines.push('  Rank  Node                              Time (s)  % of Total');

  const maxIdLen = 34;
  for (const node of bottlenecks.nodes) {
    const label = node.name ?? node.unique_id;
    const idDisplay = label.length > maxIdLen ? label.slice(0, maxIdLen - 3) + '...' : label;
    const padded = idDisplay.padEnd(maxIdLen);
    const timeStr = node.execution_time.toFixed(2).padStart(8);
    lines.push(
      `  ${String(node.rank).padStart(2)}     ${padded}  ${timeStr}    ${node.pct_of_total.toFixed(1)}%`,
    );
  }

  return lines.join('\n') + '\n';
}

export function formatAdapterTotalsHuman(totals: AdapterTotalsSnapshot): string {
  const lines: string[] = [];
  lines.push('\nAdapter metrics (from run_results adapter_response):');
  lines.push(`  Nodes with adapter data: ${totals.nodesWithAdapterData}`);
  if (totals.totalBytesProcessed !== undefined) {
    lines.push(`  Total bytes processed: ${totals.totalBytesProcessed.toLocaleString('en-US')}`);
  }
  if (totals.totalBytesBilled !== undefined) {
    lines.push(`  Total bytes billed: ${totals.totalBytesBilled.toLocaleString('en-US')}`);
  }
  if (totals.totalSlotMs !== undefined) {
    lines.push(`  Total slot-ms: ${totals.totalSlotMs.toLocaleString('en-US')}`);
  }
  if (totals.totalRowsAffected !== undefined) {
    lines.push(`  Total rows affected: ${totals.totalRowsAffected.toLocaleString('en-US')}`);
  }
  if (totals.totalRowsInserted !== undefined) {
    lines.push(`  Total rows inserted: ${totals.totalRowsInserted.toLocaleString('en-US')}`);
  }
  if (totals.totalRowsUpdated !== undefined) {
    lines.push(`  Total rows updated: ${totals.totalRowsUpdated.toLocaleString('en-US')}`);
  }
  if (totals.totalRowsDeleted !== undefined) {
    lines.push(`  Total rows deleted: ${totals.totalRowsDeleted.toLocaleString('en-US')}`);
  }
  if (totals.totalRowsDuplicated !== undefined) {
    lines.push(`  Total rows duplicated: ${totals.totalRowsDuplicated.toLocaleString('en-US')}`);
  }
  return lines.join('\n') + '\n';
}

export function formatAdapterNodeDetailsHuman(executions: NodeExecution[], limit = 5): string {
  const rows = executions.filter((execution) => execution.adapterMetrics != null);
  if (rows.length === 0) {
    return '\nAdapter-aware nodes: (none)\n';
  }

  const lines: string[] = [];
  lines.push('\nAdapter-aware nodes:');

  for (const execution of rows.slice(0, Math.max(1, limit))) {
    const label = execution.unique_id;
    lines.push(`  - ${label}`);
    const visibleMetrics = ADAPTER_METRIC_DESCRIPTORS.filter(
      (descriptor) => execution.adapterMetrics?.[descriptor.key] !== undefined,
    );
    for (const descriptor of visibleMetrics) {
      lines.push(
        `      ${descriptor.label}: ${formatAdapterMetricValue(
          descriptor,
          execution.adapterMetrics?.[descriptor.key],
        )}`,
      );
    }
  }

  if (rows.length > limit) {
    lines.push(`  … ${rows.length - limit} more node(s) with adapter metrics`);
  }

  return lines.join('\n') + '\n';
}

export function formatAdapterHeavyHuman(result: AdapterHeavyResult, title?: string): string {
  if (result.nodes.length === 0) {
    return `\n${title ?? `Adapter top by ${result.metric}`}: (none)\n`;
  }

  const label = title ?? `Top nodes by ${result.metric}`;
  const lines: string[] = [];
  lines.push(
    `\n${label} (total ${result.metric}: ${result.total_metric.toLocaleString('en-US')}):`,
  );
  lines.push('  Rank  Node                              Metric value    % of total  Time (s)');

  const maxIdLen = 34;
  for (const node of result.nodes) {
    const nameLabel = node.name ?? node.unique_id;
    const idDisplay =
      nameLabel.length > maxIdLen ? nameLabel.slice(0, maxIdLen - 3) + '...' : nameLabel;
    const padded = idDisplay.padEnd(maxIdLen);
    const metricStr = node.metric_value.toLocaleString('en-US').padStart(12);
    const timeStr = node.execution_time.toFixed(2).padStart(8);
    lines.push(
      `  ${String(node.rank).padStart(2)}     ${padded}  ${metricStr}    ${node.pct_of_total.toFixed(1)}%      ${timeStr}`,
    );
  }

  return lines.join('\n') + '\n';
}

/**
 * Format run-report command output
 */
export function formatRunReport(
  summary: {
    total_execution_time: number;
    total_nodes: number;
    nodes_by_status: Record<string, number>;
    critical_path?: {
      path: string[];
      total_time: number;
    };
  },
  bottlenecks?: {
    nodes: BottleneckNodeForFormat[];
    total_execution_time: number;
    criteria_used: 'top_n' | 'threshold';
  },
  bottlenecksTopLabel?: string,
  adapterAppend?: string,
): string {
  const lines: string[] = [];
  lines.push('dbt Execution Report');
  lines.push('===================');
  lines.push(`Total Execution Time: ${summary.total_execution_time.toFixed(2)}s`);
  lines.push(`Total Nodes: ${summary.total_nodes}`);
  lines.push('\nNodes by Status:');
  for (const [status, count] of Object.entries(summary.nodes_by_status)) {
    lines.push(`  ${status}: ${count}`);
  }

  if (summary.critical_path) {
    lines.push('\nCritical Path:');
    lines.push(`  Path: ${summary.critical_path.path.join(' -> ')}`);
    lines.push(`  Total Time: ${summary.critical_path.total_time.toFixed(2)}s`);
  }

  if (bottlenecks) {
    lines.push(formatBottlenecks(bottlenecks, bottlenecksTopLabel));
  }

  if (adapterAppend) {
    lines.push(adapterAppend);
  }

  return lines.join('\n');
}

/**
 * Format human-readable output for a specific command type
 */
export function formatHumanReadable(
  data: unknown,
  format: 'summary' | 'deps' | 'run-report',
): string {
  switch (format) {
    case 'summary':
      return formatSummary(data as Parameters<typeof formatSummary>[0]);
    case 'deps':
      return formatDeps(data as Parameters<typeof formatDeps>[0]);
    case 'run-report':
      return formatRunReport(data as Parameters<typeof formatRunReport>[0]);
    default:
      return String(data);
  }
}
