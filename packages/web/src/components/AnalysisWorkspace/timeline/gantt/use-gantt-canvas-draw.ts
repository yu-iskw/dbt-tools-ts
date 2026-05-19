import { useEffect, type RefObject } from 'react';

import { drawGantt } from './canvas-draw';

import type { DisplayMode } from './constants';
import type { ThemeMode } from '@web/constants/theme-colors';
import type { BundleRow } from '@web/lib/analysis-workspace/bundle-layout';
import type { ResourceTestStats } from '@web/types';

export interface UseGanttCanvasDrawParams {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  bundles: BundleRow[];
  rowOffsets: number[];
  rowHeights: number[];
  scrollTop: number;
  rangeStart: number;
  rangeEnd: number;
  activeMode: DisplayMode;
  runStartedAt?: number | null;
  focusedIds: Set<string> | null;
  hoveredId: string | null;
  effectiveLabelW: number;
  timeZone: string;
  testStatsById?: Map<string, ResourceTestStats>;
  theme: ThemeMode;
  showTests: boolean;
  setContainerWidth: (w: number) => void;
}

export function useGanttCanvasDraw({
  canvasRef,
  bundles,
  rowOffsets,
  rowHeights,
  scrollTop,
  rangeStart,
  rangeEnd,
  activeMode,
  runStartedAt,
  focusedIds,
  hoveredId,
  effectiveLabelW,
  timeZone,
  testStatsById,
  theme,
  showTests,
  setContainerWidth,
}: UseGanttCanvasDrawParams): void {
  useEffect(() => {
    if (bundles.length === 0) return;

    function draw() {
      const c = canvasRef.current;
      if (!c) return;
      drawGantt(c, bundles, rowOffsets, rowHeights, {
        scrollTop,
        rangeStart,
        rangeEnd,
        displayMode: activeMode,
        runStartedAt,
        focusIds: focusedIds,
        hoveredId,
        labelW: effectiveLabelW,
        timeZone,
        testStatsById,
        theme,
        showTests,
      });
    }

    const el = canvasRef.current;
    if (!el) return;

    draw();
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setContainerWidth(entry.contentRect.width);
      draw();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [
    bundles,
    rowOffsets,
    rowHeights,
    scrollTop,
    rangeStart,
    rangeEnd,
    activeMode,
    runStartedAt,
    focusedIds,
    hoveredId,
    effectiveLabelW,
    timeZone,
    testStatsById,
    theme,
    showTests,
    setContainerWidth,
  ]);
}
