import { describe, expect, it, vi } from 'vitest';

import {
  computeTicks,
  filterTicksForPixelDensity,
  getInitialLabelColumnWidth,
  niceStepMs,
} from './formatting';

describe('niceStepMs', () => {
  it('returns at least one minute', () => {
    expect(niceStepMs(100)).toBe(60_000);
    expect(niceStepMs(30_000)).toBe(60_000);
  });

  it('snaps large rough values to 1-2-5 decades', () => {
    expect(niceStepMs(4_500_000)).toBe(5_000_000);
    expect(niceStepMs(12_000_000)).toBe(20_000_000);
  });
});

describe('computeTicks', () => {
  it('returns empty for invalid range', () => {
    expect(computeTicks(10, 10)).toEqual([]);
    expect(computeTicks(20, 10)).toEqual([]);
  });

  it('keeps tick count modest for multi-hour spans', () => {
    const sixHours = 6 * 3_600_000;
    const ticks = computeTicks(0, sixHours);
    expect(ticks.length).toBeLessThanOrEqual(16);
    expect(ticks[ticks.length - 1]?.ms).toBe(sixHours);
  });

  it('keeps tick count modest for 24h span', () => {
    const day = 24 * 3_600_000;
    const ticks = computeTicks(0, day);
    expect(ticks.length).toBeLessThanOrEqual(16);
  });

  it('does not emit hundreds of ticks for very long spans when STEPS are exhausted', () => {
    const week = 7 * 24 * 3_600_000;
    const ticks = computeTicks(0, week);
    expect(ticks.length).toBeLessThanOrEqual(20);
  });
});

describe('filterTicksForPixelDensity', () => {
  it('returns all ticks when chart is wide enough', () => {
    const ticks = [
      { ms: 0, label: '0ms' },
      { ms: 500, label: '500ms' },
      { ms: 1000, label: '1s' },
    ];
    const out = filterTicksForPixelDensity(
      ticks,
      0,
      1000,
      400,
      (t) => t.label,
      () => 20,
      10,
    );
    expect(out.length).toBe(ticks.length);
  });

  it('drops intermediate ticks when labels would overlap', () => {
    const ticks = [
      { ms: 0, label: 'A' },
      { ms: 100, label: 'B' },
      { ms: 200, label: 'C' },
      { ms: 300, label: 'D' },
    ];
    const out = filterTicksForPixelDensity(
      ticks,
      0,
      300,
      90,
      (t) => t.label,
      () => 40,
      10,
    );
    expect(out.length).toBeLessThan(ticks.length);
    expect(out[out.length - 1]?.ms).toBe(300);
  });
});

describe('getInitialLabelColumnWidth', () => {
  it('returns fallback when storage is empty', () => {
    const getItem = vi.fn().mockReturnValue(null);
    vi.stubGlobal('window', { localStorage: { getItem } });
    expect(getInitialLabelColumnWidth(220)).toBe(220);
    vi.unstubAllGlobals();
  });

  it('parses stored integer', () => {
    const getItem = vi.fn().mockReturnValue('312');
    vi.stubGlobal('window', { localStorage: { getItem } });
    expect(getInitialLabelColumnWidth(200)).toBe(312);
    vi.unstubAllGlobals();
  });
});
