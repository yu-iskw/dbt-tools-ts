import { getStatusColor } from '@web/constants/colors';
import {
  type ThemeMode,
  getCanvasColors,
  getResourceTypeSoftFill,
} from '@web/constants/theme-colors';

import {
  AXIS_TOP,
  BAR_H,
  BAR_PAD,
  BUNDLE_HULL_PAD,
  LABEL_W,
  MIN_CHIP_W,
  ROW_H,
  TEST_BAR_H,
  TEST_LANE_H,
  X_PAD,
  type DisplayMode,
} from './constants';
import {
  computeTicks,
  filterTicksForPixelDensity,
  formatTimestamp,
  isIssueStatus,
  isPositiveStatus,
} from './formatting';
import { clampTimelineIntervalToChartStripPx } from './gantt-chart-helpers';

import type { BundleRow } from '@web/lib/analysis-workspace/bundle-layout';
import type { GanttItem, ResourceTestStats } from '@web/types';

const ISSUE_PARENT_STROKE_WIDTH = 3;
const ISSUE_TEST_STROKE_WIDTH = 2.25;

function hasAttachedTestIssue(attachedTestStats: ResourceTestStats | undefined): boolean {
  const error = attachedTestStats?.error ?? 0;
  const warn = attachedTestStats?.warn ?? 0;
  return error + warn > 0;
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/** Trace a rounded-rectangle path (no fill/stroke — caller decides). */
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Trace + fill a rounded rectangle. */
export function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fill();
}

function strokeRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.stroke();
}

/** Darkened compile-phase band clipped to the clamped bar/chip rounded rect. */
function fillCompilePhaseShade(
  ctx: CanvasRenderingContext2D,
  params: {
    rangeStart: number;
    rangeEnd: number;
    chartLeft: number;
    chartW: number;
    compileStart: number | null | undefined;
    compileEnd: number | null | undefined;
    barX: number;
    barY: number;
    barW: number;
    barH: number;
    radius: number;
    theme: ThemeMode;
  },
): void {
  const {
    rangeStart,
    rangeEnd,
    chartLeft,
    chartW,
    compileStart: cs,
    compileEnd: ce,
    barX,
    barY,
    barW,
    barH,
    radius,
    theme,
  } = params;
  if (cs == null || ce == null || ce <= cs) return;
  const rangeDuration = Math.max(1, rangeEnd - rangeStart);
  const compileX = chartLeft + ((cs - rangeStart) / rangeDuration) * chartW;
  const compileEndX = chartLeft + ((ce - rangeStart) / rangeDuration) * chartW;
  const segLeft = Math.max(barX, compileX);
  const segRight = Math.min(barX + barW, compileEndX);
  const segW = segRight - segLeft;
  if (segW <= 0.5) return;
  ctx.save();
  roundRectPath(ctx, barX, barY, barW, barH, radius);
  ctx.clip();
  ctx.fillStyle = theme === 'dark' ? 'rgba(0, 0, 0, 0.24)' : 'rgba(0, 0, 0, 0.12)';
  ctx.fillRect(segLeft, barY, segW, barH);
  ctx.restore();
}

type CanvasPalette = ReturnType<typeof getCanvasColors>;

// ---------------------------------------------------------------------------
// Row background
// ---------------------------------------------------------------------------

function drawRowBackground(
  ctx: CanvasRenderingContext2D,
  rowIndex: number,
  rowY: number,
  width: number,
  bundleRowHeightPx: number,
  isFocused: boolean,
  isHovered: boolean,
  palette: CanvasPalette,
) {
  if (rowIndex % 2 !== 0) return;
  ctx.fillStyle = isHovered ? palette.rowStripeHover : palette.rowStripe;
  ctx.globalAlpha = isFocused ? 1 : 0.35;
  ctx.fillRect(0, rowY, width, bundleRowHeightPx);
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// Row labels
// ---------------------------------------------------------------------------

interface DrawRowLabelsParams {
  ctx: CanvasRenderingContext2D;
  item: GanttItem;
  rowY: number;
  labelW: number;
  xOffset: number;
  emphasis: number;
  palette: CanvasPalette;
}

function drawRowLabels({
  ctx,
  item,
  rowY,
  labelW,
  xOffset,
  emphasis,
  palette,
}: DrawRowLabelsParams) {
  ctx.save();
  ctx.globalAlpha = emphasis;
  ctx.beginPath();
  ctx.rect(xOffset, rowY, labelW - 10 - xOffset, ROW_H);
  ctx.clip();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  ctx.font = '12px "IBM Plex Sans", "Avenir Next", sans-serif';
  ctx.fillStyle = palette.labelText;
  ctx.fillText(item.name || item.unique_id, xOffset + 2, rowY + ROW_H / 2);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Parent bar
// ---------------------------------------------------------------------------

interface DrawRowBarParams {
  ctx: CanvasRenderingContext2D;
  item: GanttItem;
  rowY: number;
  rangeStart: number;
  rangeEnd: number;
  chartW: number;
  labelW: number;
  emphasis: number;
  isHovered: boolean;
  attachedTestStats: ResourceTestStats | undefined;
  palette: CanvasPalette;
  theme: ThemeMode;
}

function drawRowBar({
  ctx,
  item,
  rowY,
  rangeStart,
  rangeEnd,
  chartW,
  labelW,
  emphasis,
  isHovered,
  attachedTestStats,
  palette,
  theme,
}: DrawRowBarParams) {
  const barY = rowY + BAR_PAD;
  const { x: barX, width: barW } = clampTimelineIntervalToChartStripPx(
    rangeStart,
    rangeEnd,
    item.start,
    item.end,
    labelW,
    chartW,
  );
  const radius = 3;
  const hasTestIssue = hasAttachedTestIssue(attachedTestStats);
  const hasIssueOutline = isIssueStatus(item.status) || hasTestIssue;

  ctx.save();
  ctx.globalAlpha = emphasis;
  ctx.fillStyle = getResourceTypeSoftFill(item.resourceType, theme);
  fillRoundRect(ctx, barX, barY, barW, BAR_H, radius);

  fillCompilePhaseShade(ctx, {
    rangeStart,
    rangeEnd,
    chartLeft: labelW,
    chartW,
    compileStart: item.compileStart,
    compileEnd: item.compileEnd,
    barX,
    barY,
    barW,
    barH: BAR_H,
    radius,
    theme,
  });

  if (hasTestIssue && isPositiveStatus(item.status)) {
    ctx.fillStyle = palette.testFailStripe;
    fillRoundRect(ctx, barX, barY + BAR_H - 4, barW, 4, 2);
  }

  ctx.strokeStyle = hasIssueOutline ? palette.testFailStripe : getStatusColor(item.status, theme);
  ctx.lineWidth = hasIssueOutline ? ISSUE_PARENT_STROKE_WIDTH : 2;
  strokeRoundRect(ctx, barX, barY, barW, BAR_H, radius);
  ctx.restore();

  if (isHovered) {
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = palette.barHoverStroke;
    ctx.lineWidth = 1.5;
    strokeRoundRect(ctx, barX, barY, barW, BAR_H, radius);
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Test chip
// ---------------------------------------------------------------------------

interface DrawTestChipParams {
  ctx: CanvasRenderingContext2D;
  test: GanttItem;
  chipY: number;
  rangeStart: number;
  rangeEnd: number;
  chartW: number;
  labelW: number;
  palette: CanvasPalette;
  theme: ThemeMode;
  emphasis: number;
  isHovered: boolean;
}

function drawTestChip({
  ctx,
  test,
  chipY,
  rangeStart,
  rangeEnd,
  chartW,
  labelW,
  palette,
  theme,
  emphasis,
  isHovered,
}: DrawTestChipParams) {
  const { x: chipX, width: chipW } = clampTimelineIntervalToChartStripPx(
    rangeStart,
    rangeEnd,
    test.start,
    test.end,
    labelW,
    chartW,
    MIN_CHIP_W,
  );
  const chipH = TEST_BAR_H;
  const radius = 2;
  const hasIssueOutline = isIssueStatus(test.status);

  ctx.save();
  ctx.globalAlpha = emphasis;
  ctx.fillStyle = getResourceTypeSoftFill(test.resourceType, theme);
  fillRoundRect(ctx, chipX, chipY, chipW, chipH, radius);

  fillCompilePhaseShade(ctx, {
    rangeStart,
    rangeEnd,
    chartLeft: labelW,
    chartW,
    compileStart: test.compileStart,
    compileEnd: test.compileEnd,
    barX: chipX,
    barY: chipY,
    barW: chipW,
    barH: chipH,
    radius,
    theme,
  });

  ctx.strokeStyle = hasIssueOutline ? palette.testFailStripe : getStatusColor(test.status, theme);
  ctx.lineWidth = hasIssueOutline ? ISSUE_TEST_STROKE_WIDTH : 1.5;
  strokeRoundRect(ctx, chipX, chipY, chipW, chipH, radius);
  ctx.restore();

  if (isHovered) {
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = palette.barHoverStroke;
    ctx.lineWidth = 1;
    strokeRoundRect(ctx, chipX, chipY, chipW, chipH, radius);
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// drawGantt helpers (keeps main entry shallow for complexity limits)
// ---------------------------------------------------------------------------

function initGanttCanvas(
  canvas: HTMLCanvasElement,
  labelW: number,
): {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  chartW: number;
} | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = rect.width;
  const h = rect.height;
  if (w === 0 || h === 0) return null;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const chartW = w - labelW - X_PAD;
  return { ctx, w, h, chartW };
}

interface DrawGanttAxisTicksParams {
  ctx: CanvasRenderingContext2D;
  labelW: number;
  chartW: number;
  h: number;
  rangeStart: number;
  rangeEnd: number;
  displayMode: DisplayMode;
  runStartedAt: number | null | undefined;
  timeZone: string;
  palette: CanvasPalette;
}

function drawGanttAxisTicks({
  ctx,
  labelW,
  chartW,
  h,
  rangeStart,
  rangeEnd,
  displayMode,
  runStartedAt,
  timeZone,
  palette,
}: DrawGanttAxisTicksParams): void {
  const rangeDuration = Math.max(1, rangeEnd - rangeStart);
  const rawTicks = computeTicks(rangeStart, rangeEnd);
  ctx.font = "11px 'IBM Plex Mono', 'Fira Mono', monospace";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = palette.axisTick;

  const getDisplayLabel = (tick: { ms: number; label: string }) =>
    displayMode === 'timestamps' && runStartedAt != null
      ? formatTimestamp(runStartedAt + tick.ms, timeZone)
      : tick.label;

  const ticks = filterTicksForPixelDensity(
    rawTicks,
    rangeStart,
    rangeEnd,
    chartW,
    getDisplayLabel,
    (text) => ctx.measureText(text).width,
  );

  for (const tick of ticks) {
    const x = labelW + ((tick.ms - rangeStart) / rangeDuration) * chartW;
    ctx.strokeStyle = palette.gridLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, AXIS_TOP);
    ctx.lineTo(x, h);
    ctx.stroke();
    ctx.fillText(getDisplayLabel(tick), x, AXIS_TOP / 2);
  }
}

interface DrawGanttVisibleRowParams {
  ctx: CanvasRenderingContext2D;
  bundle: BundleRow;
  rowIndex: number;
  rowY: number;
  bundleRowHeightPx: number;
  w: number;
  labelW: number;
  chartW: number;
  rangeStart: number;
  rangeEnd: number;
  focusIds: Set<string> | null;
  hoveredId: string | null;
  theme: ThemeMode;
  palette: CanvasPalette;
  testStatsById?: Map<string, ResourceTestStats>;
  showTests: boolean;
}

function drawGanttVisibleRow(p: DrawGanttVisibleRowParams): void {
  const {
    ctx,
    bundle,
    rowIndex,
    rowY,
    bundleRowHeightPx,
    w,
    labelW,
    chartW,
    rangeStart,
    rangeEnd,
    focusIds,
    hoveredId,
    theme,
    palette,
    testStatsById,
    showTests,
  } = p;

  const rowHasFocus =
    focusIds == null ||
    focusIds.has(bundle.item.unique_id) ||
    bundle.lanes.some((l) => focusIds.has(l.item.unique_id));
  const isFocused = focusIds == null || focusIds.has(bundle.item.unique_id);
  const isHovered = hoveredId === bundle.item.unique_id;
  const emphasis = isFocused ? 1 : 0.18;

  drawRowBackground(ctx, rowIndex, rowY, w, bundleRowHeightPx, rowHasFocus, isHovered, palette);

  drawRowLabels({
    ctx,
    item: bundle.item,
    rowY,
    labelW,
    xOffset: 0,
    emphasis,
    palette,
  });

  drawRowBar({
    ctx,
    item: bundle.item,
    rowY,
    rangeStart,
    rangeEnd,
    chartW,
    labelW,
    emphasis,
    isHovered,
    attachedTestStats: testStatsById?.get(bundle.item.unique_id),
    palette,
    theme,
  });

  if (!showTests || bundle.lanes.length === 0) return;

  for (const { item: test, lane } of bundle.lanes) {
    const chipY = rowY + ROW_H + BUNDLE_HULL_PAD + lane * TEST_LANE_H;
    const testHovered = hoveredId === test.unique_id;
    const testFocused = focusIds == null || focusIds.has(test.unique_id);
    drawTestChip({
      ctx,
      test,
      chipY,
      rangeStart,
      rangeEnd,
      chartW,
      labelW,
      palette,
      theme,
      emphasis: testFocused ? 1 : 0.18,
      isHovered: testHovered,
    });
  }
}

// ---------------------------------------------------------------------------
// Main drawGantt entry point
// ---------------------------------------------------------------------------

export interface DrawGanttParams {
  scrollTop: number;
  rangeStart: number;
  rangeEnd: number;
  displayMode: DisplayMode;
  runStartedAt: number | null | undefined;
  focusIds: Set<string> | null;
  hoveredId: string | null;
  labelW?: number;
  timeZone: string;
  testStatsById?: Map<string, ResourceTestStats>;
  /** Default `light` — pass from {@link use-theme} for canvas parity with CSS. */
  theme?: ThemeMode;
  /** Whether to render test chips inside bundles. */
  showTests?: boolean;
}

export function drawGantt(
  canvas: HTMLCanvasElement,
  bundles: BundleRow[],
  rowOffsets: number[],
  rowHeights: number[],
  {
    scrollTop,
    rangeStart,
    rangeEnd,
    displayMode,
    runStartedAt,
    focusIds,
    hoveredId,
    labelW = LABEL_W,
    timeZone,
    testStatsById,
    theme = 'light',
    showTests = false,
  }: DrawGanttParams,
): void {
  const prepared = initGanttCanvas(canvas, labelW);
  if (!prepared) return;

  const { ctx, w, h, chartW } = prepared;
  const palette = getCanvasColors(theme);

  drawGanttAxisTicks({
    ctx,
    labelW,
    chartW,
    h,
    rangeStart,
    rangeEnd,
    displayMode,
    runStartedAt,
    timeZone,
    palette,
  });

  if (bundles.length === 0) return;

  const contentH = h - AXIS_TOP;
  const visStart = findFirstVisible(rowOffsets, scrollTop);
  const visEnd = findLastVisible(rowOffsets, rowHeights, scrollTop, contentH);

  ctx.textBaseline = 'middle';

  for (let i = visStart; i <= visEnd; i++) {
    const bundle = bundles[i];
    if (!bundle) continue;
    const rowY = AXIS_TOP + (rowOffsets[i] ?? 0) - scrollTop;
    drawGanttVisibleRow({
      ctx,
      bundle,
      rowIndex: i,
      rowY,
      bundleRowHeightPx: rowHeights[i] ?? ROW_H,
      w,
      labelW,
      chartW,
      rangeStart,
      rangeEnd,
      focusIds,
      hoveredId,
      theme,
      palette,
      testStatsById,
      showTests,
    });
  }
}

// ---------------------------------------------------------------------------
// Visibility helpers
// ---------------------------------------------------------------------------

/** Find the index of the first bundle whose row is within the viewport. */
export function findFirstVisible(rowOffsets: number[], scrollTop: number): number {
  if (rowOffsets.length === 0) return 0;
  let lo = 0,
    hi = rowOffsets.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if ((rowOffsets[mid] ?? 0) < scrollTop) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  // Back up one step — the bundle just above the viewport may still be visible
  return Math.max(0, lo - 1);
}

/** Find the index of the last bundle whose row is at least partially visible. */
export function findLastVisible(
  rowOffsets: number[],
  rowHeights: number[],
  scrollTop: number,
  contentH: number,
): number {
  const bottom = scrollTop + contentH;
  let result = 0;
  for (let i = 0; i < rowOffsets.length; i++) {
    const offset = rowOffsets[i] ?? 0;
    const rowEnd = offset + (rowHeights[i] ?? ROW_H);
    if (rowEnd <= scrollTop) continue; // entirely above viewport
    if (offset >= bottom) break; // entirely below viewport
    result = i;
  }
  return result;
}
