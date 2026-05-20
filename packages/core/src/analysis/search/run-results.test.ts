// @ts-expect-error - workspace package, TypeScript resolves via package.json
import { parseManifest } from 'dbt-artifacts-parser/manifest';
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import { parseRunResults } from 'dbt-artifacts-parser/run_results';
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import { loadTestManifest, loadTestRunResults } from 'dbt-artifacts-parser/test-utils';
import { describe, it, expect } from 'vitest';

import { ExecutionAnalyzer } from '../execution/analyzer';
import { ManifestGraph } from '../manifest/graph';

import {
  applyWarehouseSearchBlock,
  detectAdapterHeavyNodes,
  detectBottlenecks,
  searchRunResults,
  sortByExecutionSortKey,
} from './run-results';

import type { NodeExecution } from '../execution/analyzer';

function makeExecution(overrides: Partial<NodeExecution> & { unique_id: string }): NodeExecution {
  return {
    unique_id: overrides.unique_id,
    status: overrides.status ?? 'success',
    execution_time: overrides.execution_time ?? 0,
    ...overrides,
  };
}

describe('search/run-results', () => {
  describe('searchRunResults', () => {
    const fixtures: NodeExecution[] = [
      makeExecution({
        unique_id: 'model.a.slow',
        execution_time: 10,
        status: 'success',
      }),
      makeExecution({
        unique_id: 'model.a.fast',
        execution_time: 0.5,
        status: 'success',
      }),
      makeExecution({
        unique_id: 'model.b.medium',
        execution_time: 5,
        status: 'success',
      }),
      makeExecution({
        unique_id: 'model.b.failed',
        execution_time: 2,
        status: 'error',
      }),
      makeExecution({
        unique_id: 'test.c.spec',
        execution_time: 1,
        status: 'pass',
      }),
    ];

    it('filters by min_execution_time', () => {
      const result = searchRunResults(fixtures, {
        min_execution_time: 5,
      });
      expect(result).toHaveLength(2);
      expect(result.map((e) => e.unique_id)).toContain('model.a.slow');
      expect(result.map((e) => e.unique_id)).toContain('model.b.medium');
    });

    it('filters by max_execution_time', () => {
      const result = searchRunResults(fixtures, {
        max_execution_time: 2,
      });
      expect(result).toHaveLength(3);
      expect(result.map((e) => e.unique_id)).toContain('model.a.fast');
      expect(result.map((e) => e.unique_id)).toContain('model.b.failed');
      expect(result.map((e) => e.unique_id)).toContain('test.c.spec');
    });

    it('filters by status (string)', () => {
      const result = searchRunResults(fixtures, {
        status: 'error',
      });
      expect(result).toHaveLength(1);
      expect(result[0].unique_id).toBe('model.b.failed');
    });

    it('filters by status (array)', () => {
      const result = searchRunResults(fixtures, {
        status: ['success', 'pass'],
      });
      expect(result).toHaveLength(4);
    });

    it('filters by unique_id pattern (glob)', () => {
      const result = searchRunResults(fixtures, {
        unique_id_pattern: 'model.b.*',
      });
      expect(result).toHaveLength(2);
      expect(result.map((e) => e.unique_id)).toContain('model.b.medium');
      expect(result.map((e) => e.unique_id)).toContain('model.b.failed');
    });

    it('filters by unique_id pattern (RegExp)', () => {
      const result = searchRunResults(fixtures, {
        unique_id_pattern: /^model\.(a|b)\./,
      });
      expect(result).toHaveLength(4);
    });

    it('sorts by execution_time_desc and limits', () => {
      const result = searchRunResults(fixtures, {
        sort: 'execution_time_desc',
        limit: 3,
      });
      expect(result).toHaveLength(3);
      expect(result[0].execution_time).toBe(10);
      expect(result[1].execution_time).toBe(5);
      expect(result[2].execution_time).toBe(2);
    });

    it('sorts by execution_time_asc', () => {
      const result = searchRunResults(fixtures, {
        sort: 'execution_time_asc',
      });
      expect(result[0].execution_time).toBe(0.5);
      expect(result[result.length - 1].execution_time).toBe(10);
    });

    it('sorts by unique_id', () => {
      const result = searchRunResults(fixtures, {
        sort: 'unique_id',
      });
      let previousUniqueId: string | undefined;
      for (const row of result) {
        if (previousUniqueId !== undefined) {
          expect(previousUniqueId.localeCompare(row.unique_id)).toBeLessThanOrEqual(0);
        }
        previousUniqueId = row.unique_id;
      }
    });

    it('returns new array (immutable)', () => {
      const result = searchRunResults(fixtures, { limit: 1 });
      expect(result).not.toBe(fixtures);
      expect(fixtures).toHaveLength(5);
    });

    it('filters by canonical adapter text fields', () => {
      const result = searchRunResults(
        [
          makeExecution({
            unique_id: 'model.a',
            adapterMetrics: {
              rawKeys: ['query_id', 'code'],
              queryId: 'job-123',
              adapterCode: 'INSERT',
            },
          }),
          makeExecution({ unique_id: 'model.b' }),
        ],
        { adapter_text: 'job-123' },
      );
      expect(result.map((entry) => entry.unique_id)).toEqual(['model.a']);
    });

    it('sorts by warehouse adapter metrics via block', () => {
      const executions = [
        makeExecution({
          unique_id: 'model.a',
          adapterMetrics: { rawKeys: ['bytes_billed'], bytesBilled: 10 },
        }),
        makeExecution({
          unique_id: 'model.b',
          adapterMetrics: { rawKeys: ['bytes_billed'], bytesBilled: 50 },
        }),
      ];
      const filtered = applyWarehouseSearchBlock(executions, {
        adapter: 'bigquery',
        criteria: {},
      });
      const result = sortByExecutionSortKey(filtered, 'bytes_billed_desc');
      expect(result.map((entry) => entry.unique_id)).toEqual(['model.b', 'model.a']);
    });
  });

  describe('detectBottlenecks', () => {
    const fixtures: NodeExecution[] = [
      makeExecution({ unique_id: 'model.a.slow', execution_time: 10 }),
      makeExecution({ unique_id: 'model.b.medium', execution_time: 5 }),
      makeExecution({ unique_id: 'model.c.small', execution_time: 2 }),
      makeExecution({ unique_id: 'model.d.tiny', execution_time: 1 }),
    ];

    it('top_n mode returns top N nodes with rank and pct_of_total', () => {
      const result = detectBottlenecks(fixtures, { mode: 'top_n', top: 2 });
      expect(result.nodes).toHaveLength(2);
      expect(result.criteria_used).toBe('top_n');
      expect(result.total_execution_time).toBe(18);

      expect(result.nodes[0].unique_id).toBe('model.a.slow');
      expect(result.nodes[0].rank).toBe(1);
      expect(result.nodes[0].execution_time).toBe(10);
      expect(result.nodes[0].pct_of_total).toBeCloseTo(55.6, 1);

      expect(result.nodes[1].unique_id).toBe('model.b.medium');
      expect(result.nodes[1].rank).toBe(2);
      expect(result.nodes[1].execution_time).toBe(5);
      expect(result.nodes[1].pct_of_total).toBeCloseTo(27.8, 1);
    });

    it('top_n with top greater than execution count returns all', () => {
      const result = detectBottlenecks(fixtures, { mode: 'top_n', top: 10 });
      expect(result.nodes).toHaveLength(4);
      expect(result.nodes[3].rank).toBe(4);
    });

    it('threshold mode returns only nodes >= min_seconds', () => {
      const result = detectBottlenecks(fixtures, {
        mode: 'threshold',
        min_seconds: 3,
      });
      expect(result.nodes).toHaveLength(2);
      expect(result.nodes[0].unique_id).toBe('model.a.slow');
      expect(result.nodes[1].unique_id).toBe('model.b.medium');
      expect(result.criteria_used).toBe('threshold');
    });

    it('threshold mode with high threshold returns empty', () => {
      const result = detectBottlenecks(fixtures, {
        mode: 'threshold',
        min_seconds: 100,
      });
      expect(result.nodes).toHaveLength(0);
      expect(result.total_execution_time).toBe(18);
    });

    it('enriches with node name when graph is provided', () => {
      const runResultsJson = loadTestRunResults('v6', 'run_results.json');
      const runResults = parseRunResults(runResultsJson as Record<string, unknown>);
      const manifestJson = loadTestManifest('v12', 'manifest_1.10.json');
      const manifest = parseManifest(manifestJson as Record<string, unknown>);
      const graph = new ManifestGraph(manifest);

      const analyzer = new ExecutionAnalyzer(runResults, graph);
      const executions = analyzer.getNodeExecutions();

      if (executions.length === 0) return;

      const result = detectBottlenecks(executions, {
        mode: 'top_n',
        top: 3,
        graph,
      });

      expect(result.nodes.length).toBeGreaterThan(0);
      for (const node of result.nodes) {
        expect(node.unique_id).toBeDefined();
        expect(typeof node.execution_time).toBe('number');
        expect(typeof node.rank).toBe('number');
        expect(typeof node.pct_of_total).toBe('number');
        expect(node.status).toBeDefined();
        if (graph.getGraph().hasNode(node.unique_id)) {
          expect(node.name).toBeDefined();
        }
      }
    });

    it('pct_of_total sums to approximately 100 for top_n covering all nodes', () => {
      const result = detectBottlenecks(fixtures, { mode: 'top_n', top: 10 });
      const sumPct = result.nodes.reduce((s, n) => s + n.pct_of_total, 0);
      expect(sumPct).toBeGreaterThanOrEqual(99);
      expect(sumPct).toBeLessThanOrEqual(101);
    });
  });

  describe('detectAdapterHeavyNodes', () => {
    it('ranks rows by newly supported adapter metrics', () => {
      const result = detectAdapterHeavyNodes(
        [
          makeExecution({
            unique_id: 'model.a',
            adapterMetrics: { rawKeys: ['rows_inserted'], rowsInserted: 5 },
          }),
          makeExecution({
            unique_id: 'model.b',
            adapterMetrics: { rawKeys: ['rows_inserted'], rowsInserted: 15 },
          }),
        ],
        { metric: 'rows_inserted', top: 5 },
      );
      expect(result.total_metric).toBe(20);
      expect(result.nodes.map((entry) => entry.unique_id)).toEqual(['model.b', 'model.a']);
    });
  });
});
