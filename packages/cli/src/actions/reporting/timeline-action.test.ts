import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  createJaffleArtifactBundleDir,
  createJaffleRunResultsOnlyDir,
} from '../../internal/cli-test-bundle-dir';

import { timelineAction, formatTimeline, formatTimelineCsv } from './timeline-action';

describe('timelineAction', () => {
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
    await fs.rm(dbtTargetDir, { recursive: true, force: true });
  });

  it('outputs JSON timeline with required fields', async () => {
    await timelineAction({ dbtTarget: dbtTargetDir, json: true }, handleError);

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as {
      total: number;
      entries: Array<{
        unique_id: string;
        status: string;
        execution_time: number;
      }>;
    };
    expect(parsed).toHaveProperty('total');
    expect(parsed).toHaveProperty('entries');
    expect(parsed.total).toBeGreaterThan(0);

    const first = parsed.entries[0];
    expect(first).toHaveProperty('unique_id');
    expect(first).toHaveProperty('status');
    expect(first).toHaveProperty('execution_time');
  });

  it('works when only run_results.json is present', async () => {
    const runResultsOnlyDir = await createJaffleRunResultsOnlyDir();
    try {
      await timelineAction({ dbtTarget: runResultsOnlyDir, json: true }, handleError);

      const output = consoleLogSpy.mock.calls.at(-1)?.[0] as string;
      const parsed = JSON.parse(output) as {
        total: number;
        entries: Array<{ name?: string }>;
      };
      expect(parsed.total).toBeGreaterThan(0);
      expect(parsed.entries.some((entry) => entry.name == null)).toBe(true);
    } finally {
      await fs.rm(runResultsOnlyDir, { recursive: true, force: true });
    }
  });

  it('is sorted by duration descending by default', async () => {
    await timelineAction({ dbtTarget: dbtTargetDir, json: true }, handleError);

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as {
      entries: Array<{ execution_time: number }>;
    };
    const times = parsed.entries.map((e) => e.execution_time);
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeLessThanOrEqual(times[i - 1]);
    }
  });

  it('respects --top option', async () => {
    await timelineAction({ dbtTarget: dbtTargetDir, top: 3, json: true }, handleError);

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as { entries: unknown[] };
    expect(parsed.entries.length).toBeLessThanOrEqual(3);
  });

  it('enriches entries with name and type from manifest', async () => {
    await timelineAction({ dbtTarget: dbtTargetDir, json: true }, handleError);

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as {
      entries: Array<{ name?: string; resource_type?: string }>;
    };
    const enriched = parsed.entries.filter((e) => e.name !== undefined);
    expect(enriched.length).toBeGreaterThan(0);
  });

  it('filters by --failed-only', async () => {
    await timelineAction({ dbtTarget: dbtTargetDir, failedOnly: true, json: true }, handleError);

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as {
      entries: Array<{ status: string }>;
    };
    expect(parsed.entries.every((e) => e.status !== 'success' && e.status !== 'pass')).toBe(true);
  });

  it('outputs human-readable table in TTY mode', async () => {
    await timelineAction({ dbtTarget: dbtTargetDir, noJson: true }, handleError);

    const output = consoleLogSpy.mock.calls[0][0] as string;
    expect(output).toContain('dbt Execution Timeline');
    expect(output).toContain('Status');
  });

  it('outputs CSV when --format csv', async () => {
    await timelineAction({ dbtTarget: dbtTargetDir, format: 'csv' }, handleError);

    const output = consoleLogSpy.mock.calls[0][0] as string;
    expect(output).toContain('unique_id,name,resource_type,status,execution_time');
    const lines = output.split('\n');
    expect(lines.length).toBeGreaterThan(1);
  });

  it('includes normalized adapter metrics in JSON entries when available', async () => {
    await timelineAction({ dbtTarget: dbtTargetDir, json: true }, handleError);

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as {
      entries: Array<{ adapter_metrics?: { rawKeys: string[] } }>;
    };
    expect(parsed.entries.some((entry) => entry.adapter_metrics?.rawKeys != null)).toBe(true);
  });

  it('throws for invalid sort option', async () => {
    await expect(
      timelineAction({ dbtTarget: dbtTargetDir, sort: 'invalid_sort' }, handleError),
    ).rejects.toThrow(/--sort must be one of/);
  });

  it('throws when required artifacts are missing', async () => {
    const empty = await fs.mkdtemp(path.join(os.tmpdir(), 'dbt-tl-empty-'));
    try {
      await expect(timelineAction({ dbtTarget: empty }, handleError)).rejects.toThrow(
        /Missing required dbt artifact/,
      );
    } finally {
      await fs.rm(empty, { recursive: true, force: true });
    }
  });
});

describe('formatTimeline', () => {
  it('formats empty result gracefully', () => {
    const result = { total: 0, entries: [] };
    const output = formatTimeline(result);
    expect(output).toContain('dbt Execution Timeline');
    expect(output).toContain('Total entries: 0');
    expect(output).toContain('(no matching executions)');
  });

  it('includes all entries in table rows', () => {
    const result = {
      total: 2,
      entries: [
        {
          unique_id: 'model.p.a',
          status: 'success',
          execution_time: 1.5,
        },
        {
          unique_id: 'model.p.b',
          status: 'error',
          execution_time: 0.3,
        },
      ],
    };
    const output = formatTimeline(result);
    expect(output).toContain('model.p.a');
    expect(output).toContain('model.p.b');
    expect(output).toContain('success');
    expect(output).toContain('error');
  });
});

describe('formatTimelineCsv', () => {
  it('generates CSV with header and rows', () => {
    const entries = [
      {
        unique_id: 'model.p.a',
        status: 'success',
        execution_time: 1.5,
      },
    ];
    const csv = formatTimelineCsv(entries);
    expect(csv).toContain('unique_id,name,resource_type');
    expect(csv).toContain('model.p.a');
    expect(csv).toContain('success');
  });

  it('escapes commas in values', () => {
    const entries = [
      {
        unique_id: 'model.p.a',
        status: 'success',
        execution_time: 1.0,
        message: 'completed, with info',
      },
    ];
    const csv = formatTimelineCsv(entries);
    expect(csv).toContain('"completed, with info"');
  });
});
