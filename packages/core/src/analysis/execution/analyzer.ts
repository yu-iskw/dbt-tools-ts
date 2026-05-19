import {
  adapterMetricsHasData,
  coerceAdapterResponseInput,
  extractAdapterResponseFields,
  isAdapterResponseObject,
} from '../adapter/metrics';
import { normalizeAdapterResponseWithContext } from '../adapter/response';

import type { AdapterResponseField, AdapterResponseMetrics } from '../adapter/metrics';
import type { ManifestGraph } from '../manifest/graph';
import type { ParsedRunResults } from 'dbt-artifacts-parser/run_results';

type RunResultLike = {
  unique_id: string;
  status: string;
  execution_time: number;
  thread_id?: string | null;
  message?: string | null;
  adapter_response?: unknown;
  timing: Array<{
    name: string;
    started_at?: string | null;
    completed_at?: string | null;
  }>;
};
/**
 * Execution timing information for a single node
 */
export interface NodeExecution {
  unique_id: string;
  status: string;
  execution_time: number;
  started_at?: string;
  completed_at?: string;
  thread_id?: string;
  /** dbt `results[].message` when non-empty (often failure / warning detail). */
  message?: string;
  /** Present when run_results included a non-empty adapter_response. */
  adapterMetrics?: AdapterResponseMetrics;
  /** Present when adapter_response was an object, even if it was empty. */
  adapterResponseFields?: AdapterResponseField[];
}

/**
 * Critical path analysis result
 */
export interface CriticalPath {
  path: string[];
  total_time: number;
}

/**
 * Execution summary statistics
 */
export interface ExecutionSummary {
  total_execution_time: number;
  total_nodes: number;
  nodes_by_status: Record<string, number>;
  critical_path?: CriticalPath;
  node_executions: NodeExecution[];
}

/**
 * ExecutionAnalyzer processes run_results.json to extract timing information
 * and correlate it with the dependency graph.
 */
/**
 * Build node execution rows from parsed run_results (no manifest required).
 * Used by the CLI when only run_results.json is provided.
 *
 * @param runResults - Parsed run_results.json
 * @param adapterType - Optional adapter type from manifest metadata for parser dispatch
 */
export function buildNodeExecutionsFromRunResults(
  runResults: ParsedRunResults,
  adapterType?: string | null,
): NodeExecution[] {
  if (!runResults.results || !Array.isArray(runResults.results)) {
    return [];
  }

  const results = runResults.results as unknown as RunResultLike[];

  const pickTiming = (result: RunResultLike) => {
    const timingArray = result.timing || [];
    return (
      timingArray.find((t) => t.name === 'execute') ||
      timingArray.find((t) => t.name === 'compile') ||
      timingArray[0]
    );
  };

  const normalizeMessage = (messageRaw: unknown): string | undefined =>
    typeof messageRaw === 'string' && messageRaw.trim() !== '' ? messageRaw.trim() : undefined;

  const buildAdapterDetails = (adapterRaw: unknown) => {
    const adapterMetrics = normalizeAdapterResponseWithContext(adapterRaw, {
      adapterType,
    });
    return {
      adapterMetrics,
      includeAdapter: adapterMetrics.rawKeys.length > 0 || adapterMetricsHasData(adapterMetrics),
      adapterResponseFields: extractAdapterResponseFields(adapterRaw),
      includeAdapterFields: isAdapterResponseObject(adapterRaw),
    };
  };

  return results.map((result) => {
    const timing = pickTiming(result);
    const adapterRaw = coerceAdapterResponseInput(result.adapter_response);
    const { adapterMetrics, includeAdapter, adapterResponseFields, includeAdapterFields } =
      buildAdapterDetails(adapterRaw);
    const message = normalizeMessage(result.message);

    return {
      unique_id: result.unique_id || '',
      status: result.status || 'unknown',
      execution_time: result.execution_time || 0,
      started_at: timing?.started_at ?? undefined,
      completed_at: timing?.completed_at ?? undefined,
      thread_id: result.thread_id ?? undefined,
      ...(message != null ? { message } : {}),
      ...(includeAdapter ? { adapterMetrics } : {}),
      ...(includeAdapterFields ? { adapterResponseFields } : {}),
    };
  });
}

export class ExecutionAnalyzer {
  private runResults: ParsedRunResults;
  private graph: ManifestGraph;
  private adapterType?: string | null;

  constructor(runResults: ParsedRunResults, graph: ManifestGraph, adapterType?: string | null) {
    this.runResults = runResults;
    this.graph = graph;
    this.adapterType = adapterType;
  }

  /**
   * Get execution summary with statistics
   */
  getSummary(): ExecutionSummary {
    const nodeExecutions = this.getNodeExecutions();
    const nodesByStatus: Record<string, number> = {};
    let totalExecutionTime = 0;

    for (const execution of nodeExecutions) {
      // Count by status
      const status = execution.status || 'unknown';
      nodesByStatus[status] = (nodesByStatus[status] || 0) + 1;

      // Sum execution time
      totalExecutionTime += execution.execution_time || 0;
    }

    // Calculate critical path
    const criticalPath = this.calculateCriticalPath(nodeExecutions);

    return {
      total_execution_time: totalExecutionTime,
      total_nodes: nodeExecutions.length,
      nodes_by_status: nodesByStatus,
      critical_path: criticalPath,
      node_executions: nodeExecutions,
    };
  }

  /**
   * Extract execution information for each node
   */
  getNodeExecutions(): NodeExecution[] {
    return buildNodeExecutionsFromRunResults(this.runResults, this.adapterType);
  }

  /**
   * Calculate the critical path (longest path through the dependency graph)
   */
  calculateCriticalPath(nodeExecutions: NodeExecution[]): CriticalPath | undefined {
    // Create a map of node executions by unique_id
    const executionMap = new Map<string, NodeExecution>();
    for (const exec of nodeExecutions) {
      executionMap.set(exec.unique_id, exec);
    }

    // Find all leaf nodes (nodes with no downstream dependents)
    const leafNodes: string[] = [];
    const graph = this.graph.getGraph();

    graph.forEachNode((nodeId) => {
      const outboundNeighbors = graph.outboundNeighbors(nodeId);
      if (outboundNeighbors.length === 0 && executionMap.has(nodeId)) {
        leafNodes.push(nodeId);
      }
    });

    if (leafNodes.length === 0) {
      return undefined;
    }

    // For each leaf node, find the longest path from root
    let maxPath: string[] = [];
    let maxTime = 0;

    for (const leafNode of leafNodes) {
      const path = this.findLongestPathToRoot(leafNode, executionMap);
      const pathTime = this.calculatePathTime(path, executionMap);

      if (pathTime > maxTime) {
        maxTime = pathTime;
        maxPath = path;
      }
    }

    if (maxPath.length === 0) {
      return undefined;
    }

    return {
      path: maxPath,
      total_time: maxTime,
    };
  }

  /**
   * Find the longest path from a node to root (nodes with no dependencies)
   */
  private findLongestPathToRoot(
    startNode: string,
    executionMap: Map<string, NodeExecution>,
  ): string[] {
    const graph = this.graph.getGraph();
    const visited = new Set<string>();
    let longestPath: string[] = [];

    const dfs = (currentNode: string, currentPath: string[]): void => {
      if (visited.has(currentNode)) {
        return;
      }

      visited.add(currentNode);
      const newPath = [...currentPath, currentNode];

      // Update longest path if this is longer
      if (newPath.length > longestPath.length) {
        longestPath = newPath;
      }

      // Traverse upstream (inbound neighbors)
      const inboundNeighbors = graph.inboundNeighbors(currentNode);
      for (const neighbor of inboundNeighbors) {
        if (executionMap.has(neighbor)) {
          dfs(neighbor, newPath);
        }
      }

      visited.delete(currentNode);
    };

    dfs(startNode, []);
    return longestPath.reverse(); // Reverse to get root-to-leaf order
  }

  /**
   * Calculate total execution time for a path
   */
  private calculatePathTime(path: string[], executionMap: Map<string, NodeExecution>): number {
    let totalTime = 0;
    for (const nodeId of path) {
      const exec = executionMap.get(nodeId);
      if (exec) {
        totalTime += exec.execution_time || 0;
      }
    }
    return totalTime;
  }

  /**
   * Returns the absolute epoch-ms timestamp of the earliest executed node,
   * or null if no timing data is available. Useful for converting relative
   * Gantt offsets to wall-clock timestamps.
   */
  getRunStartedAt(): number | null {
    const executions = this.getNodeExecutions();
    const timestamps = executions
      .map((exec) => (exec.started_at ? new Date(exec.started_at).getTime() : null))
      .filter((t): t is number => t !== null);
    if (timestamps.length === 0) return null;
    return Math.min(...timestamps);
  }

  private parseTimingInterval(
    timing: Record<string, unknown> | undefined,
  ): { start: number; end: number } | null {
    if (!timing) return null;
    const started = timing.started_at as string | undefined;
    const completed = timing.completed_at as string | undefined;
    if (!started || !completed) return null;
    const startMs = new Date(started).getTime();
    const endMs = new Date(completed).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) return null;
    return { start: startMs, end: endMs };
  }

  /**
   * Wall-clock span and optional compile/execute intervals (epoch ms).
   */
  private wallClockFromResult(result: RunResultLike): {
    wallStart: number;
    wallEnd: number;
    compile: { start: number; end: number } | null;
    execute: { start: number; end: number } | null;
  } | null {
    const timingArray = result.timing || [];
    const executeTiming = timingArray.find((t) => t.name === 'execute');
    const compileTiming = timingArray.find((t) => t.name === 'compile');
    const compile = this.parseTimingInterval(compileTiming);
    const execute = this.parseTimingInterval(executeTiming);

    const starts: number[] = [];
    const ends: number[] = [];
    if (compile) {
      starts.push(compile.start);
      ends.push(compile.end);
    }
    if (execute) {
      starts.push(execute.start);
      ends.push(execute.end);
    }
    if (starts.length === 0) return null;

    return {
      wallStart: Math.min(...starts),
      wallEnd: Math.max(...ends),
      compile,
      execute,
    };
  }

  /**
   * Get Gantt chart data for visualization
   */
  getGanttData(): Array<{
    unique_id: string;
    name: string;
    start: number;
    end: number;
    duration: number;
    status: string;
    compileStart: number | null;
    compileEnd: number | null;
    executeStart: number | null;
    executeEnd: number | null;
  }> {
    if (!this.runResults.results || !Array.isArray(this.runResults.results)) {
      return [];
    }

    const graphologyGraph = this.graph.getGraph();

    const rows: Array<{
      unique_id: string;
      name: string;
      status: string;
      wall: {
        wallStart: number;
        wallEnd: number;
        compile: { start: number; end: number } | null;
        execute: { start: number; end: number } | null;
      };
    }> = [];

    for (const result of this.runResults.results as unknown as RunResultLike[]) {
      const uniqueId = result.unique_id || '';
      if (!uniqueId) continue;
      const wall = this.wallClockFromResult(result);
      if (!wall) continue;

      const nodeAttributes = graphologyGraph.hasNode(uniqueId)
        ? graphologyGraph.getNodeAttributes(uniqueId)
        : undefined;
      const name = nodeAttributes?.name || uniqueId;
      const status = result.status || 'unknown';

      rows.push({ unique_id: uniqueId, name, status, wall });
    }

    if (rows.length === 0) return [];

    const minStart = Math.min(...rows.map((r) => r.wall.wallStart));

    return rows.map((row) => {
      const { wall } = row;
      const rel = (t: number) => t - minStart;
      return {
        unique_id: row.unique_id,
        name: row.name,
        start: rel(wall.wallStart),
        end: rel(wall.wallEnd),
        duration: wall.wallEnd - wall.wallStart,
        status: row.status,
        compileStart: wall.compile ? rel(wall.compile.start) : null,
        compileEnd: wall.compile ? rel(wall.compile.end) : null,
        executeStart: wall.execute ? rel(wall.execute.start) : null,
        executeEnd: wall.execute ? rel(wall.execute.end) : null,
      };
    });
  }
}
