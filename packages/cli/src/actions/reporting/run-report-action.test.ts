/**
 * Tests for runReportAction.
 */
import { rmValidated } from '@dbt-tools/core';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  createJaffleArtifactBundleDir,
  createJaffleRunResultsOnlyDir,
} from '../../internal/cli-test-bundle-dir';

import { runReportAction } from './run-report-action';

describe('runReportAction', () => {
  const handleError = (error: unknown) => {
    throw error;
  };

  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let dbtTargetDir: string;

  beforeEach(async () => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    dbtTargetDir = await createJaffleArtifactBundleDir();
  });

  afterEach(async () => {
    consoleLogSpy.mockRestore();
    await rmValidated(dbtTargetDir, { recursive: true, force: true });
  });

  it('outputs execution summary with manifest and run_results fixtures', async () => {
    await runReportAction({ dbtTarget: dbtTargetDir }, handleError);

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls[0][0] as string;
    expect(output).toContain('total_execution_time');
    expect(output).toContain('nodes_by_status');
    expect(output).toContain('node_executions');
  });

  it('works when only run_results.json is present', async () => {
    const runResultsOnlyDir = await createJaffleRunResultsOnlyDir();
    try {
      await runReportAction({ dbtTarget: runResultsOnlyDir, json: true }, handleError);

      const output = consoleLogSpy.mock.calls.at(-1)?.[0] as string;
      const parsed = JSON.parse(output) as {
        total_execution_time: number;
        node_executions: unknown[];
      };
      expect(parsed.total_execution_time).toBeGreaterThan(0);
      expect(parsed.node_executions.length).toBeGreaterThan(0);
    } finally {
      await rmValidated(runResultsOnlyDir, { recursive: true, force: true });
    }
  });

  it('outputs JSON when json option is set', async () => {
    await runReportAction({ dbtTarget: dbtTargetDir, json: true }, handleError);

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as Record<string, unknown>;
    expect(parsed).toHaveProperty('total_execution_time');
    expect(parsed).toHaveProperty('total_nodes');
    expect(parsed).toHaveProperty('nodes_by_status');
    expect(parsed).toHaveProperty('node_executions');
  });

  it('includes bottlenecks when --bottlenecks option is set', async () => {
    await runReportAction({ dbtTarget: dbtTargetDir, bottlenecks: true, json: true }, handleError);

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as Record<string, unknown>;
    expect(parsed).toHaveProperty('bottlenecks');
    const bottlenecks = parsed.bottlenecks as {
      nodes: Array<{ unique_id: string; execution_time: number }>;
    };
    expect(bottlenecks.nodes.length).toBeGreaterThan(0);
    expect(bottlenecks.nodes[0]).toHaveProperty('unique_id');
    expect(bottlenecks.nodes[0]).toHaveProperty('execution_time');
  });

  it('includes adapter_totals in JSON when --adapter-summary', async () => {
    await runReportAction(
      { dbtTarget: dbtTargetDir, adapterSummary: true, json: true },
      handleError,
    );

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as Record<string, unknown>;
    expect(parsed).toHaveProperty('adapter_totals');
    const totals = parsed.adapter_totals as { nodesWithAdapterData: number };
    expect(totals.nodesWithAdapterData).toBeGreaterThan(0);
  });

  it('routes invalid --adapter-top-by through handleCliError', async () => {
    const structuredHandleError = vi.fn();
    await runReportAction(
      { dbtTarget: dbtTargetDir, adapterTopBy: 'bytes_procesed', json: true },
      structuredHandleError,
    );
    expect(structuredHandleError).toHaveBeenCalledTimes(1);
    const err = structuredHandleError.mock.calls[0]![0];
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/--adapter-top-by must be one of/);
    expect(structuredHandleError.mock.calls[0]![1]).toBe(true);
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it('includes adapter_top in JSON when --adapter-top-by', async () => {
    await runReportAction(
      {
        dbtTarget: dbtTargetDir,
        adapterTopBy: 'rows_affected',
        adapterTopN: 3,
        json: true,
      },
      handleError,
    );

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as Record<string, unknown>;
    expect(parsed).toHaveProperty('adapter_top');
    const top = parsed.adapter_top as {
      nodes: Array<{ metric_value: number }>;
    };
    expect(top.nodes.length).toBeGreaterThan(0);
  });

  it('renders human adapter sections when adapter summary is enabled', async () => {
    await runReportAction(
      { dbtTarget: dbtTargetDir, adapterSummary: true, noJson: true },
      handleError,
    );

    const output = consoleLogSpy.mock.calls[0][0] as string;
    expect(output).toContain('Adapter metrics (from run_results adapter_response):');
    expect(output).toContain('Adapter-aware nodes:');
  });

  it('caps node_executions in JSON when --node-executions-limit is set', async () => {
    await runReportAction({ dbtTarget: dbtTargetDir, json: true }, handleError);
    const fullOut = consoleLogSpy.mock.calls.at(-1)?.[0] as string;
    const fullParsed = JSON.parse(fullOut) as {
      node_executions: unknown[];
      total_nodes: number;
    };
    const fullLen = fullParsed.node_executions.length;
    expect(fullLen).toBeGreaterThan(3);

    consoleLogSpy.mockClear();
    await runReportAction(
      {
        dbtTarget: dbtTargetDir,
        json: true,
        nodeExecutionsLimit: 3,
        nodeExecutionsOffset: 0,
      },
      handleError,
    );
    const capped = JSON.parse(consoleLogSpy.mock.calls[0][0] as string) as Record<string, unknown>;
    expect((capped.node_executions as unknown[]).length).toBe(3);
    expect(capped.total_nodes).toBe(fullParsed.total_nodes);
    expect(capped.node_executions_truncated).toBe(true);
    expect(capped.node_executions_has_more).toBe(fullLen > 3);
  });

  it('rejects --node-executions-offset without --node-executions-limit', async () => {
    await expect(
      runReportAction(
        { dbtTarget: dbtTargetDir, json: true, nodeExecutionsOffset: 2 },
        handleError,
      ),
    ).rejects.toThrow(/offset requires --limit/i);
  });
});
