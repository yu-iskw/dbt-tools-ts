import { TEST_RESOURCE_TYPES } from './constants';

import type { AnalysisState, ExecutionRow } from '@web/types';

export type BriefAction =
  | { kind: 'node'; nodeId: string }
  | { kind: 'runs'; status: 'danger' | 'warning' };

export interface BriefSegment {
  text: string;
  action?: BriefAction;
}

export type BriefLineId = 'duration' | 'failures' | 'pace' | 'tests' | 'warehouse';

export interface BriefLine {
  id: BriefLineId;
  segments: BriefSegment[];
}

/** The slowest node must cover at least this share of the run to be named as setting its pace. */
export const PACE_MIN_SHARE = 0.2;

const MS_PER_HOUR = 3_600_000;
const LARGER_BYTE_UNITS = ['KiB', 'MiB', 'GiB', 'TiB'] as const;

interface TimedRow {
  row: ExecutionRow;
  /** Millisecond offset, as on `ExecutionRow.start`. */
  start: number;
  /** Millisecond offset, as on `ExecutionRow.end`. */
  end: number;
}

interface WallClock {
  startMs: number;
  seconds: number;
}

const isFiniteNumber = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const formatCount = (n: number): string => n.toLocaleString('en-US');

const formatOneDecimal = (n: number): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function countOf(n: number, noun: string): string {
  return `${formatCount(n)} ${noun}${n === 1 ? '' : 's'}`;
}

/** `999ms`, `8.4s`, `59s`, `12m 3s`, `3h 12m`. */
export function formatBriefDuration(seconds: number): string {
  const ms = Math.round(seconds * 1000);
  if (ms < 1000) return `${ms}ms`;
  const whole = Math.round(seconds);
  if (whole < 60) return seconds < 9.95 ? `${seconds.toFixed(1)}s` : `${whole}s`;
  if (whole < 3600) return `${Math.floor(whole / 60)}m ${whole % 60}s`;
  return `${Math.floor(whole / 3600)}h ${Math.floor((whole % 3600) / 60)}m`;
}

/** Binary units; a value that would round up to 1024.0 moves to the next unit. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  let value = bytes;
  let label = 'B';
  for (const unit of LARGER_BYTE_UNITS) {
    value /= 1024;
    label = unit;
    if (value < 1023.95) break;
  }
  return `${formatOneDecimal(value)} ${label}`;
}

/** The first item with the highest score, so ties resolve in row order. */
function maxBy<T>(items: readonly T[], score: (item: T) => number): T | undefined {
  let best: T | undefined;
  let bestScore = -Infinity;
  for (const item of items) {
    const value = score(item);
    if (value > bestScore) {
      best = item;
      bestScore = value;
    }
  }
  return best;
}

function nodeSegment(row: ExecutionRow): BriefSegment {
  return { text: row.name, action: { kind: 'node', nodeId: row.uniqueId } };
}

function timedRows(rows: readonly ExecutionRow[]): TimedRow[] {
  const timed: TimedRow[] = [];
  for (const row of rows) {
    if (isFiniteNumber(row.start) && isFiniteNumber(row.end)) {
      timed.push({ row, start: row.start, end: row.end });
    }
  }
  return timed;
}

function measureWallClock(timed: readonly TimedRow[]): WallClock | null {
  if (timed.length === 0) return null;
  let startMs = Infinity;
  let endMs = -Infinity;
  for (const { start, end } of timed) {
    startMs = Math.min(startMs, start);
    endMs = Math.max(endMs, end);
  }
  return { startMs, seconds: Math.max(0, (endMs - startMs) / 1000) };
}

function durationLine(rows: readonly ExecutionRow[], wall: WallClock | null): BriefLine {
  const nodeSeconds = rows.reduce((sum, row) => sum + row.executionTime, 0);
  const threads = new Set(rows.flatMap((row) => (row.threadId == null ? [] : [row.threadId])));
  const acrossThreads = threads.size > 0 ? ` across ${countOf(threads.size, 'thread')}` : '';
  const nodeSentence = `Node time adds up to ${formatBriefDuration(nodeSeconds)}${acrossThreads}.`;
  const text =
    wall == null
      ? nodeSentence
      : `The run took ${formatBriefDuration(wall.seconds)} wall-clock. ${nodeSentence}`;
  return { id: 'duration', segments: [{ text }] };
}

function paceLine(timed: readonly TimedRow[], wall: WallClock | null): BriefLine | null {
  if (wall == null || wall.seconds <= 0) return null;
  const slowest = maxBy(timed, ({ row }) => row.executionTime);
  if (slowest == null) return null;

  const { row } = slowest;
  const share = Math.min(1, row.executionTime / wall.seconds);
  const pct = Math.round(share * 100);
  const ranFor = formatBriefDuration(row.executionTime);

  if (share < PACE_MIN_SHARE) {
    return {
      id: 'pace',
      segments: [
        { text: 'No single node dominates. Slowest is ' },
        nodeSegment(row),
        { text: ` (${ranFor}, ${pct}% of the run).` },
      ],
    };
  }

  const startedAt = (slowest.start - wall.startMs) / 1000;
  const gap = wall.seconds - (slowest.end - wall.startMs) / 1000;
  const endedTheRun = gap <= Math.max(1, wall.seconds * 0.01);
  const ending = endedTheRun
    ? 'ended the run.'
    : `finished ${formatBriefDuration(gap)} before the run did.`;
  return {
    id: 'pace',
    segments: [
      nodeSegment(row),
      {
        text: ` set the pace. It started at ${formatBriefDuration(startedAt)}, ran ${ranFor} (${pct}% of the run) and ${ending}`,
      },
    ],
  };
}

/** The failure with the earliest end; the first one listed when none has an end time. */
function firstToFail(failed: readonly ExecutionRow[]): ExecutionRow | undefined {
  const ended = failed.flatMap((row) => (isFiniteNumber(row.end) ? [{ row, end: row.end }] : []));
  return maxBy(ended, ({ end }) => -end)?.row ?? failed[0];
}

function failuresLine(rows: readonly ExecutionRow[]): BriefLine {
  const failed = rows.filter((row) => row.statusTone === 'danger');
  const warned = rows.filter((row) => row.statusTone === 'warning').length;
  const warnings: BriefSegment = {
    text: countOf(warned, 'warning'),
    action: { kind: 'runs', status: 'warning' },
  };

  const first = firstToFail(failed);
  if (first == null) {
    return {
      id: 'failures',
      segments:
        warned === 0
          ? [{ text: 'No failures or warnings.' }]
          : [{ text: 'No failures. ' }, warnings, { text: ' to review.' }],
    };
  }
  return {
    id: 'failures',
    segments: [
      { text: countOf(failed.length, 'failure'), action: { kind: 'runs', status: 'danger' } },
      ...(warned > 0 ? [{ text: ' and ' }, warnings] : []),
      { text: '. First to fail: ' },
      nodeSegment(first),
      { text: '.' },
    ],
  };
}

function testsLine(rows: readonly ExecutionRow[]): BriefLine | null {
  const tests = rows.filter((row) => TEST_RESOURCE_TYPES.has(row.resourceType));
  if (tests.length === 0) return null;

  let passed = 0;
  let failed = 0;
  let warned = 0;
  for (const { statusTone } of tests) {
    if (statusTone === 'positive') passed += 1;
    else if (statusTone === 'danger') failed += 1;
    else if (statusTone === 'warning') warned += 1;
  }
  const other = tests.length - passed - failed - warned;
  const otherPart = other > 0 ? `, ${formatCount(other)} other` : '';
  return {
    id: 'tests',
    segments: [
      {
        text: `${countOf(tests.length, 'test')}: ${formatCount(passed)} passed, ${formatCount(failed)} failed, ${formatCount(warned)} warned${otherPart}.`,
      },
    ],
  };
}

function warehouseLine(
  rows: readonly ExecutionRow[],
  totals: AnalysisState['adapterTotals'] | null,
): BriefLine | null {
  if (totals == null) return null;
  const slotMs = totals.totalSlotMs ?? 0;
  const billedBytes = totals.totalBytesBilled ?? 0;

  const parts: string[] = [];
  if (billedBytes > 0) parts.push(`${formatBytes(billedBytes)} billed`);
  if (slotMs > 0) parts.push(`${formatOneDecimal(slotMs / MS_PER_HOUR)} slot-hours`);
  if (parts.length === 0) return null;

  const intro = `Warehouse: ${parts.join(' and ')} across ${countOf(totals.nodesWithAdapterData, 'node')} with warehouse data.`;

  const bySlotTime = slotMs > 0;
  const usage = (row: ExecutionRow): number =>
    (bySlotTime ? row.adapterMetrics?.slotMs : row.adapterMetrics?.bytesBilled) ?? 0;
  const heaviest = maxBy(rows, usage);
  if (heaviest == null || usage(heaviest) <= 0) {
    return { id: 'warehouse', segments: [{ text: intro }] };
  }

  const pct = Math.round((usage(heaviest) / (bySlotTime ? slotMs : billedBytes)) * 100);
  return {
    id: 'warehouse',
    segments: [
      { text: `${intro} ` },
      nodeSegment(heaviest),
      { text: ` used ${pct}% of the ${bySlotTime ? 'slot time' : 'billed bytes'}.` },
    ],
  };
}

/**
 * Plain-language summary of one run, built only from execution rows and adapter totals.
 * Lines whose facts do not exist are left out; an empty run has no brief.
 */
export function buildRunBrief(
  analysis: Pick<AnalysisState, 'adapterTotals' | 'executions'>,
): BriefLine[] {
  const rows = analysis.executions;
  if (rows.length === 0) return [];

  const timed = timedRows(rows);
  const wall = measureWallClock(timed);
  return [
    durationLine(rows, wall),
    paceLine(timed, wall),
    failuresLine(rows),
    testsLine(rows),
    warehouseLine(rows, analysis.adapterTotals),
  ].filter((line): line is BriefLine => line != null);
}
