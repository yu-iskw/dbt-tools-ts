import {
  LABEL_W,
  MIN_TICK_LABEL_GAP_PX,
  TIMELINE_LABEL_WIDTH_STORAGE_KEY,
  TIMELINE_TIMEZONE_STORAGE_KEY,
} from './constants';

export function formatMs(ms: number): string {
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(0)}m`;
  if (ms >= 10_000) return `${(ms / 1000).toFixed(0)}s`;
  if (ms >= 1_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms.toFixed(0)}ms`;
}

export function formatTimestamp(epochMs: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone,
  }).format(new Date(epochMs));
}

export function getAvailableTimeZones(): string[] {
  const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const supportedValuesOf = (
    Intl as unknown as {
      supportedValuesOf?: (key: string) => string[];
    }
  ).supportedValuesOf;
  const supportedTimeZones = supportedValuesOf?.('timeZone') ?? [];
  return Array.from(new Set([localTimeZone, 'UTC', ...supportedTimeZones]));
}

export function getInitialTimeZone(): string {
  const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  try {
    return window.localStorage.getItem(TIMELINE_TIMEZONE_STORAGE_KEY) || localTimeZone;
  } catch {
    return localTimeZone;
  }
}

/** Parsed label column width from localStorage, or default. */
export function getInitialLabelColumnWidth(fallbackPx: number = LABEL_W): number {
  try {
    const raw = window.localStorage.getItem(TIMELINE_LABEL_WIDTH_STORAGE_KEY);
    if (raw == null) return fallbackPx;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n)) return fallbackPx;
    return n;
  } catch {
    return fallbackPx;
  }
}

export function isPositiveStatus(status: string): boolean {
  return ['success', 'pass', 'passed'].includes(status.trim().toLowerCase());
}

export function isSkippedStatus(status: string): boolean {
  return ['skipped', 'no op'].includes(status.trim().toLowerCase());
}

export function isIssueStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  return !isPositiveStatus(normalized) && !isSkippedStatus(normalized);
}

/**
 * Round a rough millisecond step to a human-readable increment (1–2–5 × 10ⁿ),
 * at least one minute.
 */
export function niceStepMs(roughMs: number): number {
  if (!Number.isFinite(roughMs) || roughMs < 60_000) return 60_000;
  const exp = Math.floor(Math.log10(roughMs));
  const pow = 10 ** Math.max(0, exp);
  const frac = roughMs / pow;
  const niceFrac = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return Math.max(60_000, niceFrac * pow);
}

/** Sub-millisecond steps through multi-day spans; `find` picks the finest step with span/step <= target. */
const TICK_STEPS_MS = [
  50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 30000, 60000, 120000, 300_000, 600_000,
  900_000, 1_800_000, 3_600_000, 7_200_000, 14_400_000, 21_600_000, 43_200_000, 86_400_000,
] as const;

const TARGET_TICK_COUNT = 8;

export function computeTicks(
  rangeStart: number,
  rangeEnd: number,
): Array<{ ms: number; label: string }> {
  if (rangeEnd <= rangeStart) return [];
  const span = rangeEnd - rangeStart;
  const step =
    TICK_STEPS_MS.find((s) => span / s <= TARGET_TICK_COUNT) ??
    niceStepMs(Math.ceil(span / TARGET_TICK_COUNT));
  const ticks: Array<{ ms: number; label: string }> = [];
  const first = Math.ceil(rangeStart / step) * step;
  if (rangeStart > 0) {
    ticks.push({ ms: rangeStart, label: formatMs(rangeStart) });
  }
  for (let ms = first; ms <= rangeEnd; ms += step) {
    if (ms <= rangeStart || ms >= rangeEnd) continue;
    ticks.push({ ms, label: formatMs(ms) });
  }
  ticks.push({ ms: rangeEnd, label: formatMs(rangeEnd) });
  return ticks;
}

type TickEntry = { ms: number; label: string; x: number; hw: number };

/**
 * Drop ticks whose labels would overlap when centered on the axis (given measured widths).
 * Tries to retain the range-end tick when present in `ticks`.
 */
export function filterTicksForPixelDensity(
  ticks: Array<{ ms: number; label: string }>,
  rangeStart: number,
  rangeEnd: number,
  chartW: number,
  getDisplayLabel: (tick: { ms: number; label: string }) => string,
  measureTextWidth: (text: string) => number,
  minGapPx: number = MIN_TICK_LABEL_GAP_PX,
): Array<{ ms: number; label: string }> {
  if (ticks.length === 0 || chartW <= 0) return ticks;
  const rangeDuration = Math.max(1, rangeEnd - rangeStart);

  const enriched: TickEntry[] = ticks.map((t) => {
    const x = ((t.ms - rangeStart) / rangeDuration) * chartW;
    const hw = measureTextWidth(getDisplayLabel(t)) / 2;
    return { ms: t.ms, label: t.label, x, hw };
  });
  const toTickLabel = (entry: TickEntry) => ({
    ms: entry.ms,
    label: entry.label,
  });
  const enrichedByMs = new Map(enriched.map((entry) => [entry.ms, entry] as const));

  const appendNonOverlappingTicks = () => {
    const nextOut: Array<{ ms: number; label: string }> = [];
    let last: TickEntry | null = null;
    for (const entry of enriched) {
      if (last == null) {
        nextOut.push(toTickLabel(entry));
        last = entry;
        continue;
      }
      if (entry.x - entry.hw >= last.x + last.hw + minGapPx) {
        nextOut.push(toTickLabel(entry));
        last = entry;
      }
    }
    return nextOut;
  };

  const ensureEndTick = (out: Array<{ ms: number; label: string }>) => {
    const endEntry = enriched[enriched.length - 1]!;
    if (endEntry.ms !== rangeEnd || out[out.length - 1]?.ms === rangeEnd) {
      return out;
    }
    while (out.length > 0) {
      const lo = out[out.length - 1]!;
      const loE = enrichedByMs.get(lo.ms);
      if (!loE) break;
      if (endEntry.x - endEntry.hw >= loE.x + loE.hw + minGapPx) break;
      out.pop();
    }
    if (out.length === 0) {
      out.push(toTickLabel(enriched[0]!));
    }
    out.push(toTickLabel(endEntry));
    return out;
  };

  return ensureEndTick(appendNonOverlappingTicks());
}
