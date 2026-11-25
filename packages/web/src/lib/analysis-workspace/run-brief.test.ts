import { describe, expect, it } from 'vitest';

import {
  buildRunBrief,
  formatBriefDuration,
  PACE_MIN_SHARE,
  type BriefLine,
  type BriefLineId,
} from './run-brief';

import type { AnalysisState, ExecutionRow } from '@web/types';

function makeRow(overrides: Partial<ExecutionRow> & Pick<ExecutionRow, 'uniqueId'>): ExecutionRow {
  return {
    name: overrides.uniqueId,
    resourceType: 'model',
    packageName: 'shop',
    path: null,
    status: 'success',
    statusTone: 'positive',
    executionTime: 1,
    threadId: 't1',
    start: null,
    end: null,
    ...overrides,
  };
}

/** A row that ran from `startSec` to `endSec` of the run, so its execution time matches. */
function timedRow(
  uniqueId: string,
  startSec: number,
  endSec: number,
  overrides: Partial<ExecutionRow> = {},
): ExecutionRow {
  return makeRow({
    uniqueId,
    start: startSec * 1000,
    end: endSec * 1000,
    executionTime: endSec - startSec,
    ...overrides,
  });
}

const brief = (
  executions: ExecutionRow[],
  adapterTotals?: AnalysisState['adapterTotals'],
): BriefLine[] => buildRunBrief({ executions, adapterTotals });

const textOf = (line: BriefLine | undefined): string =>
  line?.segments.map((segment) => segment.text).join('') ?? '';

function lineOf(lines: BriefLine[], id: BriefLineId): BriefLine | undefined {
  return lines.find((line) => line.id === id);
}

const ids = (lines: BriefLine[]): BriefLineId[] => lines.map((line) => line.id);

describe('buildRunBrief', () => {
  it('returns no lines for an empty run', () => {
    expect(brief([])).toEqual([]);
  });

  it('orders the lines duration, pace, failures, tests, warehouse', () => {
    const lines = brief(
      [
        timedRow('model.a', 0, 10, { adapterMetrics: { rawKeys: [], slotMs: 1000 } }),
        timedRow('test.a', 10, 11, { resourceType: 'test' }),
      ],
      { nodesWithAdapterData: 1, totalSlotMs: 1000 },
    );
    expect(ids(lines)).toEqual(['duration', 'pace', 'failures', 'tests', 'warehouse']);
  });

  describe('duration', () => {
    it('reports wall-clock below node time when nodes overlap in time', () => {
      const lines = brief([
        timedRow('a', 0, 6, { threadId: 't1' }),
        timedRow('b', 1, 7, { threadId: 't2' }),
        timedRow('c', 2.4, 8.4, { threadId: 't3' }),
      ]);
      expect(textOf(lineOf(lines, 'duration'))).toBe(
        'The run took 8.4s wall-clock. Node time adds up to 18s across 3 threads.',
      );
    });

    it('counts each thread once and uses the singular for one', () => {
      const lines = brief([
        timedRow('a', 0, 3, { threadId: 'only' }),
        timedRow('b', 3, 6, { threadId: 'only' }),
      ]);
      expect(textOf(lineOf(lines, 'duration'))).toBe(
        'The run took 6.0s wall-clock. Node time adds up to 6.0s across 1 thread.',
      );
    });

    it('leaves out the threads clause when no row names a thread', () => {
      const lines = brief([timedRow('a', 0, 3, { threadId: null })]);
      expect(textOf(lineOf(lines, 'duration'))).toBe(
        'The run took 3.0s wall-clock. Node time adds up to 3.0s.',
      );
    });

    it('measures wall-clock only over rows that have both start and end', () => {
      const lines = brief([
        timedRow('a', 10, 20),
        makeRow({ uniqueId: 'late-start-only', start: 500_000, end: null, executionTime: 2 }),
        makeRow({ uniqueId: 'early-end-only', start: null, end: 0, executionTime: 2 }),
      ]);
      expect(textOf(lineOf(lines, 'duration'))).toBe(
        'The run took 10s wall-clock. Node time adds up to 14s across 1 thread.',
      );
    });

    it('describes node time alone when no row has timing', () => {
      const lines = brief([
        makeRow({ uniqueId: 'a', executionTime: 5, threadId: 't1' }),
        makeRow({ uniqueId: 'b', executionTime: 7, threadId: 't2' }),
      ]);
      expect(textOf(lineOf(lines, 'duration'))).toBe('Node time adds up to 12s across 2 threads.');
    });

    it('reports a run whose nodes all start and end together as taking no time', () => {
      const lines = brief([timedRow('a', 4, 4, { executionTime: 0 })]);
      expect(textOf(lineOf(lines, 'duration'))).toBe(
        'The run took 0ms wall-clock. Node time adds up to 0ms across 1 thread.',
      );
      expect(lineOf(lines, 'pace')).toBeUndefined();
    });
  });

  describe('pace', () => {
    it('names the dominant node that ended the run', () => {
      const lines = brief([timedRow('small', 0, 10), timedRow('big', 20, 100)]);
      const pace = lineOf(lines, 'pace');
      expect(textOf(pace)).toBe(
        'big set the pace. It started at 20s, ran 1m 20s (80% of the run) and ended the run.',
      );
      expect(pace?.segments[0]).toEqual({
        text: 'big',
        action: { kind: 'node', nodeId: 'big' },
      });
    });

    it('says how long before the run ended when the dominant node finished early', () => {
      const lines = brief([
        timedRow('warmup', 0, 10),
        timedRow('big', 5, 65),
        timedRow('cleanup', 90, 100),
      ]);
      expect(textOf(lineOf(lines, 'pace'))).toBe(
        'big set the pace. It started at 5.0s, ran 1m 0s (60% of the run) and finished 35s before the run did.',
      );
    });

    it('treats a gap of up to 1% of the run as ending the run', () => {
      const lines = brief([timedRow('big', 0, 198.5), timedRow('tail', 199, 200)]);
      expect(textOf(lineOf(lines, 'pace'))).toContain('and ended the run.');
    });

    it('treats a gap above both 1s and 1% of the run as finishing early', () => {
      const lines = brief([timedRow('big', 0, 98.5), timedRow('tail', 99, 100)]);
      expect(textOf(lineOf(lines, 'pace'))).toContain('and finished 1.5s before the run did.');
    });

    it('names no dominant node and links the slowest one when none reaches the threshold', () => {
      const lines = brief([timedRow('a', 0, 15), timedRow('b', 15, 29), timedRow('c', 90, 100)]);
      const pace = lineOf(lines, 'pace');
      expect(textOf(pace)).toBe('No single node dominates. Slowest is a (15s, 15% of the run).');
      expect(pace?.segments[1]).toEqual({ text: 'a', action: { kind: 'node', nodeId: 'a' } });
    });

    it('counts a node at exactly the threshold share as setting the pace', () => {
      expect(PACE_MIN_SHARE).toBe(0.2);
      const lines = brief([
        timedRow('edge', 0, 20),
        timedRow('rest', 20, 100, { executionTime: 5 }),
      ]);
      expect(textOf(lineOf(lines, 'pace'))).toMatch(/^edge set the pace\./);
    });

    it('ignores rows without start and end when picking the slowest node', () => {
      const lines = brief([
        timedRow('timed', 0, 30),
        makeRow({ uniqueId: 'untimed', executionTime: 500 }),
      ]);
      expect(textOf(lineOf(lines, 'pace'))).toMatch(/^timed set the pace\./);
    });

    it('is left out when no row has timing', () => {
      const lines = brief([makeRow({ uniqueId: 'a', executionTime: 5 })]);
      expect(ids(lines)).toEqual(['duration', 'failures']);
    });
  });

  describe('failures', () => {
    it('says there is nothing to review when every node succeeded', () => {
      const failures = lineOf(brief([makeRow({ uniqueId: 'ok' })]), 'failures');
      expect(failures?.segments).toEqual([{ text: 'No failures or warnings.' }]);
    });

    it('links the warnings phrase to Runs filtered to warnings when there are only warnings', () => {
      const failures = lineOf(
        brief([
          makeRow({ uniqueId: 'w1', statusTone: 'warning' }),
          makeRow({ uniqueId: 'w2', statusTone: 'warning' }),
          makeRow({ uniqueId: 'ok' }),
        ]),
        'failures',
      );
      expect(textOf(failures)).toBe('No failures. 2 warnings to review.');
      expect(failures?.segments.filter((segment) => segment.action != null)).toEqual([
        { text: '2 warnings', action: { kind: 'runs', status: 'warning' } },
      ]);
    });

    it('uses the singular for one warning', () => {
      const failures = lineOf(
        brief([makeRow({ uniqueId: 'w', statusTone: 'warning' })]),
        'failures',
      );
      expect(textOf(failures)).toBe('No failures. 1 warning to review.');
    });

    it('links failures and warnings to Runs and names the node that failed first', () => {
      const failures = lineOf(
        brief([
          timedRow('late', 0, 9, { statusTone: 'danger' }),
          timedRow('early', 0, 4, { statusTone: 'danger' }),
          timedRow('warn', 0, 5, { statusTone: 'warning' }),
          timedRow('ok', 0, 2),
        ]),
        'failures',
      );
      expect(textOf(failures)).toBe('2 failures and 1 warning. First to fail: early.');
      expect(failures?.segments.filter((segment) => segment.action != null)).toEqual([
        { text: '2 failures', action: { kind: 'runs', status: 'danger' } },
        { text: '1 warning', action: { kind: 'runs', status: 'warning' } },
        { text: 'early', action: { kind: 'node', nodeId: 'early' } },
      ]);
    });

    it('leaves out the warnings clause when there are failures only', () => {
      const failures = lineOf(
        brief([timedRow('broken', 0, 3, { statusTone: 'danger' })]),
        'failures',
      );
      expect(textOf(failures)).toBe('1 failure. First to fail: broken.');
    });

    it('names the first failing row listed when no failure has an end time', () => {
      const failures = lineOf(
        brief([
          makeRow({ uniqueId: 'ok' }),
          makeRow({ uniqueId: 'first', statusTone: 'danger' }),
          makeRow({ uniqueId: 'second', statusTone: 'danger' }),
        ]),
        'failures',
      );
      expect(textOf(failures)).toBe('2 failures. First to fail: first.');
    });
  });

  describe('tests', () => {
    const testRow = (id: string, statusTone: ExecutionRow['statusTone']) =>
      makeRow({ uniqueId: id, resourceType: 'test', statusTone });

    it('is left out when the run has no tests', () => {
      expect(lineOf(brief([makeRow({ uniqueId: 'm' })]), 'tests')).toBeUndefined();
    });

    it('counts passed, failed and warned tests', () => {
      const lines = brief([
        testRow('t1', 'positive'),
        testRow('t2', 'positive'),
        testRow('t3', 'positive'),
        testRow('t4', 'danger'),
        testRow('t5', 'warning'),
        makeRow({ uniqueId: 'model', statusTone: 'danger' }),
      ]);
      expect(textOf(lineOf(lines, 'tests'))).toBe('5 tests: 3 passed, 1 failed, 1 warned.');
    });

    it('adds an other count for tests that neither passed, failed nor warned', () => {
      const lines = brief([
        testRow('t1', 'positive'),
        makeRow({ uniqueId: 't2', resourceType: 'unit_test', statusTone: 'skipped' }),
        testRow('t3', 'neutral'),
      ]);
      expect(textOf(lineOf(lines, 'tests'))).toBe(
        '3 tests: 1 passed, 0 failed, 0 warned, 2 other.',
      );
    });

    it('uses the singular for one test', () => {
      const lines = brief([testRow('t1', 'positive')]);
      expect(textOf(lineOf(lines, 'tests'))).toBe('1 test: 1 passed, 0 failed, 0 warned.');
    });

    it('groups thousands in the counts', () => {
      const rows = Array.from({ length: 1198 }, (_, i) => testRow(`ok-${i}`, 'positive'));
      const lines = brief([...rows, testRow('bad', 'danger'), testRow('warn', 'warning')]);
      expect(textOf(lineOf(lines, 'tests'))).toBe('1,200 tests: 1,198 passed, 1 failed, 1 warned.');
    });
  });

  describe('warehouse', () => {
    const withMetrics = (id: string, metrics: { slotMs?: number; bytesBilled?: number }) =>
      makeRow({ uniqueId: id, adapterMetrics: { rawKeys: [], ...metrics } });

    it('is left out when there are no adapter totals', () => {
      const rows = [withMetrics('a', { slotMs: 1000 })];
      expect(lineOf(brief(rows), 'warehouse')).toBeUndefined();
    });

    it('is left out when the totals hold neither slot time nor billed bytes', () => {
      const rows = [withMetrics('a', {})];
      const totals = { nodesWithAdapterData: 1, totalBytesProcessed: 10_000, totalSlotMs: 0 };
      expect(lineOf(brief(rows, totals), 'warehouse')).toBeUndefined();
    });

    it('reports billed bytes and slot-hours and links the node that used the most slot time', () => {
      const rows = [
        withMetrics('light', { slotMs: 1_800_000 }),
        withMetrics('heavy', { slotMs: 5_400_000 }),
        makeRow({ uniqueId: 'no-data' }),
      ];
      const warehouse = lineOf(
        brief(rows, {
          nodesWithAdapterData: 3,
          totalBytesBilled: 5 * 1024 ** 3,
          totalSlotMs: 7_200_000,
        }),
        'warehouse',
      );
      expect(textOf(warehouse)).toBe(
        'Warehouse: 5.0 GiB billed and 2.0 slot-hours across 3 nodes with warehouse data. heavy used 75% of the slot time.',
      );
      expect(warehouse?.segments[1]).toEqual({
        text: 'heavy',
        action: { kind: 'node', nodeId: 'heavy' },
      });
    });

    it('falls back to billed bytes for the heaviest node when there is no slot total', () => {
      const rows = [
        withMetrics('small', { bytesBilled: 512 }),
        withMetrics('large', { bytesBilled: 1536 }),
      ];
      const warehouse = lineOf(
        brief(rows, { nodesWithAdapterData: 1, totalBytesBilled: 2048 }),
        'warehouse',
      );
      expect(textOf(warehouse)).toBe(
        'Warehouse: 2.0 KiB billed across 1 node with warehouse data. large used 75% of the billed bytes.',
      );
    });

    it('reports slot-hours alone when no bytes were billed', () => {
      const warehouse = lineOf(
        brief([withMetrics('a', { slotMs: 1_800_000 })], {
          nodesWithAdapterData: 1,
          totalSlotMs: 1_800_000,
        }),
        'warehouse',
      );
      expect(textOf(warehouse)).toBe(
        'Warehouse: 0.5 slot-hours across 1 node with warehouse data. a used 100% of the slot time.',
      );
    });

    it('states the totals without a heaviest node when no row carries warehouse metrics', () => {
      const warehouse = lineOf(
        brief([makeRow({ uniqueId: 'a' })], { nodesWithAdapterData: 4, totalSlotMs: 3_600_000 }),
        'warehouse',
      );
      expect(warehouse?.segments).toEqual([
        { text: 'Warehouse: 1.0 slot-hours across 4 nodes with warehouse data.' },
      ]);
    });

    it.each([
      [512, '512 B billed'],
      [1536, '1.5 KiB billed'],
      [1024 ** 2 - 1, '1.0 MiB billed'],
      [5 * 1024 ** 3, '5.0 GiB billed'],
      [3 * 1024 ** 4, '3.0 TiB billed'],
    ])('formats %d billed bytes in binary units as "%s"', (bytes, expected) => {
      const warehouse = lineOf(
        brief([makeRow({ uniqueId: 'a' })], { nodesWithAdapterData: 1, totalBytesBilled: bytes }),
        'warehouse',
      );
      expect(textOf(warehouse)).toContain(`Warehouse: ${expected} across`);
    });
  });
});

describe('formatBriefDuration', () => {
  it.each([
    [0, '0ms'],
    [0.999, '999ms'],
    [1, '1.0s'],
    [8.4, '8.4s'],
    [9.94, '9.9s'],
    [9.96, '10s'],
    [59.4, '59s'],
    [59.6, '1m 0s'],
    [723, '12m 3s'],
    [3599.6, '1h 0m'],
    [3661, '1h 1m'],
    [11_520, '3h 12m'],
  ])('formats %f seconds as "%s"', (seconds, expected) => {
    expect(formatBriefDuration(seconds)).toBe(expected);
  });
});
