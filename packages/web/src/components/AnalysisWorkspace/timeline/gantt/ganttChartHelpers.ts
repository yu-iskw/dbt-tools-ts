import type { BundleRow } from '@web/lib/analysis-workspace/bundleLayout';
import type { ResourceTestStats } from '@web/types';
import { AXIS_TOP, BUNDLE_HULL_PAD, ROW_H, TEST_LANE_H } from './constants';
import { isPositiveStatus } from './formatting';

/** Default minimum width for parent timeline bars after clamping (px). */
export const TIMELINE_MIN_PARENT_BAR_WIDTH_PX = 2;

/**
 * Map a timeline interval to pixel span and clamp to the chart strip
 * `[chartLeft, chartLeft + chartW]`. Matches hit-test geometry so draw and
 * pointer targets stay aligned.
 */
export function clampTimelineIntervalToChartStripPx(
  rangeStart: number,
  rangeEnd: number,
  intervalStart: number,
  intervalEnd: number,
  chartLeft: number,
  chartW: number,
  minWidthPx: number = TIMELINE_MIN_PARENT_BAR_WIDTH_PX,
): { x: number; width: number } {
  const rangeDuration = Math.max(1, rangeEnd - rangeStart);
  const chartRight = chartLeft + chartW;
  const rawA = chartLeft + ((intervalStart - rangeStart) / rangeDuration) * chartW;
  const rawB = chartLeft + ((intervalEnd - rangeStart) / rangeDuration) * chartW;
  const barX = Math.max(chartLeft, Math.min(rawA, rawB));
  const barXEnd = Math.min(chartRight, Math.max(rawA, rawB));
  const width = Math.max(minWidthPx, barXEnd - barX);
  return { x: barX, width };
}

/** Pixel height of one bundle row (parent + optional inline test lanes). */
export function bundleRowHeight(bundle: BundleRow, showTests: boolean): number {
  if (showTests && bundle.laneCount > 0) {
    return ROW_H + BUNDLE_HULL_PAD + bundle.laneCount * TEST_LANE_H + BUNDLE_HULL_PAD;
  }
  return ROW_H;
}

export function computeRowLayout(
  bundles: BundleRow[],
  showTests: boolean,
): { rowOffsets: number[]; rowHeights: number[]; totalHeight: number } {
  const rowOffsets: number[] = [];
  const rowHeights: number[] = [];
  let total = 0;
  for (const bundle of bundles) {
    rowOffsets.push(total);
    const h = bundleRowHeight(bundle, showTests);
    rowHeights.push(h);
    total += h;
  }
  return { rowOffsets, rowHeights, totalHeight: total };
}

export function computeVisRange(
  rowOffsets: number[],
  scrollTop: number,
  viewportH: number,
  bundleCount: number,
): { visStart: number; visEnd: number } {
  if (bundleCount <= 0) {
    return { visStart: 0, visEnd: -1 };
  }
  const bottom = scrollTop + viewportH - AXIS_TOP;
  let start = 0;
  while (start < bundleCount - 1 && (rowOffsets[start + 1] ?? 0) <= scrollTop) {
    start++;
  }
  start = Math.max(0, start - 1);
  let end = start;
  while (end < bundleCount - 1 && (rowOffsets[end] ?? 0) < bottom) {
    end++;
  }
  return { visStart: start, visEnd: Math.min(end, bundleCount - 1) };
}

/** Parent ids for bundles where the parent or an attached test failed. */
export function getFailureBundleIds(
  bundles: BundleRow[],
  testStatsById?: Map<string, ResourceTestStats>,
): Set<string> {
  const ids = new Set<string>();
  for (const bundle of bundles) {
    const stats = testStatsById?.get(bundle.item.unique_id);
    const hasTestFail = stats
      ? stats.error + stats.warn > 0
      : bundle.tests.some((t) => !isPositiveStatus(t.status));
    if (!isPositiveStatus(bundle.item.status) || hasTestFail) {
      ids.add(bundle.item.unique_id);
    }
  }
  return ids;
}
