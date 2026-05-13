import { describe, expect, it } from 'vitest';
import type { StatusBreakdownItem } from '@web/types';
import {
  EXECUTION_TYPE_BAR_LABEL_INSIDE_MIN_SHARE,
  formatExecutionTypeSegmentPercent,
  shouldPlaceExecutionSegmentLabelInsideBar,
  sortStatusBreakdownByCountDesc,
} from './executionTypeBarLabels';

describe('shouldPlaceExecutionSegmentLabelInsideBar', () => {
  it('uses the same default threshold as the status donut pie labels', () => {
    expect(EXECUTION_TYPE_BAR_LABEL_INSIDE_MIN_SHARE).toBe(0.08);
  });

  it('returns true at or above the threshold', () => {
    expect(shouldPlaceExecutionSegmentLabelInsideBar(0.08)).toBe(true);
    expect(shouldPlaceExecutionSegmentLabelInsideBar(0.5)).toBe(true);
    expect(shouldPlaceExecutionSegmentLabelInsideBar(1)).toBe(true);
  });

  it('returns false below the threshold', () => {
    expect(shouldPlaceExecutionSegmentLabelInsideBar(0.079)).toBe(false);
    expect(shouldPlaceExecutionSegmentLabelInsideBar(0)).toBe(false);
  });

  it('respects a custom min share', () => {
    expect(shouldPlaceExecutionSegmentLabelInsideBar(0.1, 0.15)).toBe(false);
    expect(shouldPlaceExecutionSegmentLabelInsideBar(0.2, 0.15)).toBe(true);
  });
});

describe('formatExecutionTypeSegmentPercent', () => {
  it('does not round dominant slice to 100% when other statuses exist (6038/6057)', () => {
    const share = 6038 / 6057;
    const out = formatExecutionTypeSegmentPercent(share);
    expect(out).not.toBe('100%');
    expect(out).toMatch(/99\.7%/);
  });

  it('shows 100% for a full share', () => {
    expect(formatExecutionTypeSegmentPercent(1)).toBe('100%');
  });

  it('does not show 100% when share uses baseline denominator (e.g. status filter, one visible segment)', () => {
    expect(formatExecutionTypeSegmentPercent(0.2)).toBe('20%');
    expect(formatExecutionTypeSegmentPercent(2 / 6057)).toBe('<0.1%');
  });

  it('formats tiny shares as less than a tenth of a percent', () => {
    expect(formatExecutionTypeSegmentPercent(1 / 6057)).toBe('<0.1%');
  });

  it('uses one decimal for small but visible shares', () => {
    expect(formatExecutionTypeSegmentPercent(16 / 6057)).toMatch(/^0\.3%$/);
  });

  it('uses integer percent when an exact whole', () => {
    expect(formatExecutionTypeSegmentPercent(0.5)).toBe('50%');
  });

  it('avoids 100.0% when just under full with two decimals if needed', () => {
    const share = 0.99951;
    const out = formatExecutionTypeSegmentPercent(share);
    expect(out).not.toMatch(/^100\.0%$/);
    expect(out).toContain('%');
  });
});

describe('sortStatusBreakdownByCountDesc', () => {
  it('orders by count descending', () => {
    const entries: StatusBreakdownItem[] = [
      {
        status: 'Fail',
        count: 1,
        duration: 0,
        share: 0.001,
        tone: 'danger',
      },
      {
        status: 'Pass',
        count: 999,
        duration: 0,
        share: 0.999,
        tone: 'positive',
      },
      {
        status: 'Skipped',
        count: 10,
        duration: 0,
        share: 0.01,
        tone: 'skipped',
      },
    ];
    const sorted = sortStatusBreakdownByCountDesc(entries);
    expect(sorted.map((e) => e.status)).toEqual(['Pass', 'Skipped', 'Fail']);
  });

  it('does not mutate the input array', () => {
    const entries: StatusBreakdownItem[] = [
      {
        status: 'A',
        count: 1,
        duration: 0,
        share: 1,
        tone: 'neutral',
      },
    ];
    sortStatusBreakdownByCountDesc(entries);
    expect(entries[0]?.status).toBe('A');
  });
});
