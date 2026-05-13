import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isTTY,
  shouldOutputJSON,
  formatOutput,
  formatSummary,
  formatDeps,
  formatRunReport,
  formatBottlenecks,
  formatHumanReadable,
} from './output-formatter';

describe('OutputFormatter', () => {
  const originalIsTTY = process.stdout.isTTY;

  beforeEach(() => {
    // Reset to original state
    Object.defineProperty(process.stdout, 'isTTY', {
      value: originalIsTTY,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: originalIsTTY,
      writable: true,
      configurable: true,
    });
  });

  describe('isTTY', () => {
    it('should detect TTY when stdout is TTY', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        writable: true,
        configurable: true,
      });
      expect(isTTY()).toBe(true);
    });

    it('should detect non-TTY when stdout is not TTY', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: false,
        writable: true,
        configurable: true,
      });
      expect(isTTY()).toBe(false);
    });
  });

  describe('shouldOutputJSON', () => {
    it('should return false for TTY when no flags', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        writable: true,
        configurable: true,
      });
      expect(shouldOutputJSON()).toBe(false);
    });

    it('should return true for non-TTY when no flags', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: false,
        writable: true,
        configurable: true,
      });
      expect(shouldOutputJSON()).toBe(true);
    });

    it('should respect --json flag', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        writable: true,
        configurable: true,
      });
      expect(shouldOutputJSON(true)).toBe(true);
    });

    it('should respect --no-json flag', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: false,
        writable: true,
        configurable: true,
      });
      expect(shouldOutputJSON(undefined, true)).toBe(false);
    });

    it('should prioritize --no-json over --json', () => {
      expect(shouldOutputJSON(true, true)).toBe(false);
    });
  });

  describe('formatOutput', () => {
    it('should format as JSON when shouldOutputJSON is true', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: false,
        writable: true,
        configurable: true,
      });
      const data = { test: 'value' };
      const output = formatOutput(data);
      expect(output).toBe(JSON.stringify(data, null, 2));
    });

    it('should format as string when shouldOutputJSON is false', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        writable: true,
        configurable: true,
      });
      const data = { test: 'value' };
      const output = formatOutput(data);
      expect(typeof output).toBe('string');
    });

    it('should respect forceJson flag', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        writable: true,
        configurable: true,
      });
      const data = { test: 'value' };
      const output = formatOutput(data, true);
      expect(output).toBe(JSON.stringify(data, null, 2));
    });
  });

  describe('formatSummary', () => {
    it('should format summary output correctly', () => {
      const summary = {
        total_nodes: 10,
        total_edges: 15,
        has_cycles: false,
        nodes_by_type: { model: 8, test: 2 },
      };
      const output = formatSummary(summary);
      expect(output).toContain('dbt Project Summary');
      expect(output).toContain('Total Nodes: 10');
      expect(output).toContain('Total Edges: 15');
      expect(output).toContain('Has Cycles: No');
      expect(output).toContain('model: 8');
      expect(output).toContain('test: 2');
    });
  });

  describe('formatDeps', () => {
    it('should format deps output correctly', () => {
      const result = {
        resource_id: 'model.my_project.customers',
        direction: 'downstream' as const,
        dependencies: [
          {
            unique_id: 'model.my_project.orders',
            resource_type: 'model',
            name: 'orders',
            package_name: 'my_project',
          },
        ],
        count: 1,
      };
      const output = formatDeps(result);
      expect(output).toContain('Dependencies for model.my_project.customers');
      expect(output).toContain('Direction: downstream');
      expect(output).toContain('Count: 1');
      expect(output).toContain('model.my_project.orders');
    });

    it('should handle empty dependencies', () => {
      const result = {
        resource_id: 'model.my_project.customers',
        direction: 'downstream' as const,
        dependencies: [],
        count: 0,
      };
      const output = formatDeps(result);
      expect(output).toContain('(none)');
    });

    it('should format tree output when format is tree', () => {
      const result = {
        resource_id: 'model.jaffle_shop.stg_customers',
        direction: 'downstream' as const,
        dependencies: [
          {
            unique_id: 'model.jaffle_shop.customers',
            resource_type: 'model',
            name: 'customers',
            depth: 1,
            dependencies: [
              {
                unique_id: 'test.jaffle_shop.not_null_customers',
                resource_type: 'test',
                name: 'not_null_customers',
                depth: 2,
                dependencies: [],
              },
            ],
          },
        ],
        count: 2,
      };
      const output = formatDeps(result, 'tree');
      expect(output).toContain('stg_customers');
      expect(output).toContain('downstream');
      expect(output).toContain('model.jaffle_shop.customers');
      expect(output).toContain('test.jaffle_shop.not_null_customers');
      expect(output).toContain('[depth 1]');
      expect(output).toContain('[depth 2]');
      expect(output).toMatch(/├──|└──/);
    });

    it('should format empty tree when format is tree and no dependencies', () => {
      const result = {
        resource_id: 'model.test.leaf',
        direction: 'downstream' as const,
        dependencies: [],
        count: 0,
      };
      const output = formatDeps(result, 'tree');
      expect(output).toContain('leaf');
      expect(output).toContain('downstream');
      expect(output).toContain('Count: 0');
      expect(output).not.toMatch(/├──|└──/);
    });

    it('should format tree with single root-level node (no children)', () => {
      const result = {
        resource_id: 'model.test.root',
        direction: 'downstream' as const,
        dependencies: [
          {
            unique_id: 'model.test.only_child',
            resource_type: 'model',
            name: 'only_child',
            depth: 1,
            dependencies: [],
          },
        ],
        count: 1,
      };
      const output = formatDeps(result, 'tree');
      expect(output).toContain('root');
      expect(output).toContain('model.test.only_child');
      expect(output).toContain('[depth 1]');
      expect(output).toMatch(/└──/);
    });
  });

  describe('formatRunReport', () => {
    it('should format run report output correctly', () => {
      const summary = {
        total_execution_time: 123.45,
        total_nodes: 10,
        nodes_by_status: { success: 8, error: 2 },
      };
      const output = formatRunReport(summary);
      expect(output).toContain('dbt Execution Report');
      expect(output).toContain('Total Execution Time: 123.45s');
      expect(output).toContain('Total Nodes: 10');
      expect(output).toContain('success: 8');
      expect(output).toContain('error: 2');
    });

    it('should include critical path when present', () => {
      const summary = {
        total_execution_time: 123.45,
        total_nodes: 10,
        nodes_by_status: { success: 10 },
        critical_path: {
          path: ['model.a', 'model.b', 'model.c'],
          total_time: 50.0,
        },
      };
      const output = formatRunReport(summary);
      expect(output).toContain('Critical Path:');
      expect(output).toContain('model.a -> model.b -> model.c');
      expect(output).toContain('Total Time: 50.00s');
    });

    it('should include bottlenecks section when provided', () => {
      const summary = {
        total_execution_time: 100,
        total_nodes: 5,
        nodes_by_status: { success: 5 },
      };
      const bottlenecks = {
        nodes: [
          {
            unique_id: 'model.jaffle_shop.fct_orders',
            name: 'fct_orders',
            execution_time: 27.2,
            rank: 1,
            pct_of_total: 27.2,
            status: 'success',
          },
          {
            unique_id: 'model.jaffle_shop.dim_customers',
            name: 'dim_customers',
            execution_time: 19.7,
            rank: 2,
            pct_of_total: 19.7,
            status: 'success',
          },
        ],
        total_execution_time: 100,
        criteria_used: 'top_n' as const,
      };
      const output = formatRunReport(summary, bottlenecks, 'top 10');
      expect(output).toContain('Bottlenecks (top 10 by execution time):');
      expect(output).toContain('Rank');
      expect(output).toContain('fct_orders');
      expect(output).toContain('27.2');
      expect(output).toContain('dim_customers');
      expect(output).toContain('19.7');
    });
  });

  describe('formatBottlenecks', () => {
    it('should format bottleneck nodes with rank, time, and pct', () => {
      const bottlenecks = {
        nodes: [
          {
            unique_id: 'model.a.slow',
            name: 'slow',
            execution_time: 12.34,
            rank: 1,
            pct_of_total: 27.2,
            status: 'success',
          },
        ],
        total_execution_time: 45.32,
        criteria_used: 'top_n' as const,
      };
      const output = formatBottlenecks(bottlenecks, 'top 10');
      expect(output).toContain('Bottlenecks (top 10 by execution time):');
      expect(output).toContain('Rank');
      expect(output).toContain('Node');
      expect(output).toContain('Time (s)');
      expect(output).toContain('% of Total');
      expect(output).toContain('slow');
      expect(output).toContain('12.34');
      expect(output).toContain('27.2%');
    });

    it('should show (none) when nodes array is empty', () => {
      const bottlenecks = {
        nodes: [],
        total_execution_time: 100,
        criteria_used: 'threshold' as const,
      };
      const output = formatBottlenecks(bottlenecks);
      expect(output).toContain('Bottlenecks: (none)');
    });
  });

  describe('formatHumanReadable', () => {
    it('should format summary output', () => {
      const data = {
        total_nodes: 10,
        total_edges: 15,
        has_cycles: false,
        nodes_by_type: { model: 8 },
      };
      const output = formatHumanReadable(data, 'summary');
      expect(output).toContain('dbt Project Summary');
    });

    it('should format deps output', () => {
      const data = {
        resource_id: 'model.x',
        direction: 'downstream' as const,
        dependencies: [],
        count: 0,
      };
      const output = formatHumanReadable(data, 'deps');
      expect(output).toContain('Dependencies for model.x');
    });

    it('should format run-report output', () => {
      const data = {
        total_execution_time: 10,
        total_nodes: 5,
        nodes_by_status: {},
      };
      const output = formatHumanReadable(data, 'run-report');
      expect(output).toContain('dbt Execution Report');
    });
  });
});
