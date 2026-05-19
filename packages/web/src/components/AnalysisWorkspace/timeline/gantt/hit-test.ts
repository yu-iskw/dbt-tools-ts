import {
  AXIS_TOP,
  BUNDLE_HULL_PAD,
  MIN_CHIP_W,
  ROW_H,
  TEST_BAR_H,
  TEST_LANE_H,
  X_PAD,
} from './constants';
import { clampTimelineIntervalToChartStripPx } from './gantt-chart-helpers';

import type { BundleRow } from '@web/lib/analysis-workspace/bundle-layout';
import type { GanttItem } from '@web/types';
import type { MouseEvent } from 'react';

export interface HoverState {
  item: GanttItem;
  x: number;
  y: number;
}

/** Precomputed per-bundle layout used by hit-testing and drawing. */
export interface BundleLayout {
  rowOffsets: number[];
  rowHeights: number[];
  showTests: boolean;
}

/**
 * Find the bundle index that contains the given content-area Y offset
 * (i.e. `mouseY - AXIS_TOP + scrollTop`).
 * Returns -1 if no bundle contains the point.
 */
export function findBundleAtOffset(
  rowOffsets: number[],
  rowHeights: number[],
  contentY: number,
): number {
  if (rowOffsets.length === 0) return -1;
  let lo = 0,
    hi = rowOffsets.length - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const offset = rowOffsets[mid] ?? 0;
    const height = rowHeights[mid] ?? ROW_H;
    if (offset > contentY) {
      hi = mid - 1;
    } else if (offset + height <= contentY) {
      lo = mid + 1;
    } else {
      return mid;
    }
  }
  return -1;
}

/**
 * Hit-test the Gantt chart with bundles.
 *
 * Returns the bar (parent or test chip) under the cursor, or null.
 */
export function hitTestBundle(
  event: MouseEvent<HTMLDivElement>,
  bundles: BundleRow[],
  layout: BundleLayout,
  scrollTop: number,
  rangeStart: number,
  rangeEnd: number,
  effectiveLabelW: number,
  canvas: HTMLCanvasElement | null,
): { item: GanttItem; x: number; y: number } | null {
  const hitResult = (item: GanttItem, x: number, y: number) => ({ item, x, y });
  const withinBounds = (
    x: number,
    left: number,
    width: number,
    y?: number,
    top?: number,
    height?: number,
  ) =>
    x >= left &&
    x <= left + width &&
    (y == null || top == null || height == null || (y >= top && y <= top + height));

  const { rowOffsets, rowHeights, showTests } = layout;
  if (!canvas) return null;
  const rect = event.currentTarget.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  if (mouseY < AXIS_TOP || mouseX < 0) return null;

  const contentY = mouseY - AXIS_TOP + scrollTop;
  const bundleIdx = findBundleAtOffset(rowOffsets, rowHeights, contentY);
  if (bundleIdx < 0 || bundleIdx >= bundles.length) return null;

  const bundle = bundles[bundleIdx];
  if (!bundle) return null;

  const chartW = canvas.getBoundingClientRect().width - effectiveLabelW - X_PAD;
  const bundleRowY = AXIS_TOP + (rowOffsets[bundleIdx] ?? 0) - scrollTop;

  // Label column: select parent
  if (mouseX < effectiveLabelW) {
    return hitResult(bundle.item, mouseX, mouseY);
  }

  // Chart bounds used to clamp hitboxes so that bars extending outside the
  // visible window do not make items hittable in the label column or beyond.
  const chartLeft = effectiveLabelW;

  // Check parent bar
  const { x: barX, width: barW } = clampTimelineIntervalToChartStripPx(
    rangeStart,
    rangeEnd,
    bundle.item.start,
    bundle.item.end,
    chartLeft,
    chartW,
  );
  if (withinBounds(mouseX, barX, barW)) {
    return hitResult(bundle.item, mouseX, mouseY);
  }

  if (showTests && bundle.lanes.length > 0) {
    for (const { item: test, lane } of bundle.lanes) {
      const { x: chipX, width: chipW } = clampTimelineIntervalToChartStripPx(
        rangeStart,
        rangeEnd,
        test.start,
        test.end,
        chartLeft,
        chartW,
        MIN_CHIP_W,
      );
      const chipY = bundleRowY + ROW_H + BUNDLE_HULL_PAD + lane * TEST_LANE_H;

      if (withinBounds(mouseX, chipX, chipW, mouseY, chipY, TEST_BAR_H)) {
        return hitResult(test, mouseX, mouseY);
      }
    }
  }

  return null;
}
