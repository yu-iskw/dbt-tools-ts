import { useVirtualizer } from '@tanstack/react-virtual';
import { useSyncedDocumentTheme } from '@web/hooks/use-theme';
import { groupIntoBundles } from '@web/lib/analysis-workspace/bundle-layout';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import {
  AXIS_TOP,
  LABEL_COLUMN_MIN_PX,
  MAX_VIEWPORT_RATIO,
  MIN_VIEWPORT_H,
  ROW_H,
  TIMELINE_TIMEZONE_STORAGE_KEY,
  VIEWPORT_SCREEN_PADDING,
  type DisplayMode,
} from './constants';
import { getAvailableTimeZones, getInitialTimeZone } from './formatting';
import { bundleRowHeight, computeRowLayout } from './gantt-chart-helpers';
import { useGanttLabelColumnWidth } from './gantt-label-column-width';
import { applyGanttPointerInteraction } from './gantt-pointer-interaction';
import { GanttChartFrame } from './GanttChartFrame';
import { GanttModeToggle } from './GanttModeToggle';
import { GanttTimeBrush } from './GanttTimeBrush';
import { useGanttCanvasDraw } from './use-gantt-canvas-draw';
import { useGanttFocusEdges } from './use-gantt-focus-edges';

import type { BundleLayout, HoverState } from './hit-test';
import type { TimelineDependencyDirection, TimeWindow } from '@web/lib/analysis-workspace/types';
import type {
  GanttItem,
  ResourceNode,
  ResourceTestStats,
  TimelineAdjacencyEntry,
} from '@web/types';
import type { ReactElement } from 'react';

export { getFailureBundleIds } from './gantt-chart-helpers';

export interface GanttChartProps {
  data: GanttItem[];
  /** Absolute epoch-ms of the earliest executed node — enables wall-clock timestamps. */
  runStartedAt?: number | null;
  /** Immediate manifest neighbors for executed timeline nodes (from analyze). */
  timelineAdjacency?: Record<string, TimelineAdjacencyEntry>;
  testStatsById?: Map<string, ResourceTestStats>;
  /** For tooltip adapter_response — keyed by `uniqueId` (same as gantt `unique_id`). */
  resourceByUniqueId?: ReadonlyMap<string, ResourceNode>;
  /** Whether to show test chips inside bundle rows. Default: false. */
  showTests?: boolean;
  dependencyDirection?: TimelineDependencyDirection;
  dependencyDepthHops?: number;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  /** Active time-range zoom window. null = full timeline. */
  timeWindow?: TimeWindow | null;
  onTimeWindowChange?: (tw: TimeWindow | null) => void;
}

export function GanttChart({
  data,
  runStartedAt,
  timelineAdjacency,
  testStatsById,
  resourceByUniqueId,
  showTests = false,
  dependencyDirection = 'both',
  dependencyDepthHops = 2,
  selectedId = null,
  onSelect,
  timeWindow = null,
  onTimeWindowChange,
}: GanttChartProps): ReactElement {
  const theme = useSyncedDocumentTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('duration');
  const [timeZone, setTimeZone] = useState<string>(getInitialTimeZone);
  const [containerWidth, setContainerWidth] = useState(0);
  const [windowHeight, setWindowHeight] = useState(() =>
    typeof window === 'undefined' ? 900 : window.innerHeight,
  );
  const availableTimeZones = useMemo(() => getAvailableTimeZones(), []);

  const canShowTimestamps = runStartedAt != null;
  const activeMode: DisplayMode = canShowTimestamps ? displayMode : 'duration';

  useEffect(() => {
    try {
      window.localStorage.setItem(TIMELINE_TIMEZONE_STORAGE_KEY, timeZone);
    } catch {
      // ignore localStorage failures
    }
  }, [timeZone]);

  const { effectiveLabelW, maxLabelW, onLabelColumnWidthDrag } =
    useGanttLabelColumnWidth(containerWidth);

  const allBundles = useMemo(() => groupIntoBundles(data), [data]);

  // Absolute max end across all data (used as the brush's total span).
  const absoluteMaxEnd = useMemo(() => {
    let m = 1;
    for (const b of allBundles) {
      m = Math.max(m, b.item.end);
      for (const t of b.tests) m = Math.max(m, t.end);
    }
    return m;
  }, [allBundles]);

  // When a time window is active, show only bundles that overlap it.
  // Parents whose bar is outside the window but have tests inside the window are
  // also kept so their tests are not orphaned and silently dropped by groupIntoBundles.
  const bundles = useMemo(() => {
    if (!timeWindow) return allBundles;
    const { start, end } = timeWindow;

    // Collect parent unique_ids that have at least one test overlapping the window.
    const parentIdsWithWindowTests = new Set<string>();
    for (const bundle of allBundles) {
      for (const test of bundle.tests) {
        if (test.end > start && test.start < end) {
          parentIdsWithWindowTests.add(bundle.item.unique_id);
          break;
        }
      }
    }

    return groupIntoBundles(
      data.filter((item) => {
        // Keep any item whose bar overlaps the window.
        if (item.end > start && item.start < end) return true;
        // Also keep parent items whose tests overlap the window even if the
        // parent bar itself is entirely outside the window.
        return parentIdsWithWindowTests.has(item.unique_id);
      }),
    );
  }, [data, allBundles, timeWindow]);

  /** Visible slice in absolute ms (same space as `GanttItem.start` / `end`). */
  const sliceStart = timeWindow?.start ?? 0;
  const sliceEnd = timeWindow ? timeWindow.end : absoluteMaxEnd;
  const rangeStart = sliceStart;
  const rangeEnd = sliceEnd;

  const { rowOffsets, rowHeights } = useMemo(
    () => computeRowLayout(bundles, showTests),
    [bundles, showTests],
  );

  const itemById = useMemo(() => {
    const m = new Map<string, GanttItem>();
    for (const item of data) m.set(item.unique_id, item);
    return m;
  }, [data]);

  // TanStack Virtual drives scroll metrics; sizes come from bundle data (see bundleRowHeight).

  // TanStack Virtual returns unstable function refs; incompatible with React Compiler memoization.
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual + React Compiler
  const virtualizer = useVirtualizer({
    count: bundles.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      const bundle = bundles.at(index);
      return bundle ? bundleRowHeight(bundle, showTests) : ROW_H;
    },
    getItemKey: (index) => bundles.at(index)?.item.unique_id ?? index,
    overscan: 10,
  });

  const scrollTop = virtualizer.scrollOffset ?? 0;

  useLayoutEffect(() => {
    virtualizer.measure();
  }, [bundles, showTests, virtualizer]);

  const layout: BundleLayout = useMemo(
    () => ({ rowOffsets, rowHeights, showTests }),
    [rowOffsets, rowHeights, showTests],
  );

  const bundleIndexById = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < bundles.length; i++) {
      const bundle = bundles.at(i);
      if (!bundle) continue;
      map.set(bundle.item.unique_id, i);
      for (const test of bundle.tests) map.set(test.unique_id, i);
    }
    return map;
  }, [bundles]);

  /** Selection wins over hover for which dependency edges are shown. */
  const edgeFocusId = selectedId ?? hover?.item.unique_id ?? null;

  const { edges } = useGanttFocusEdges({
    edgeFocusId,
    timelineAdjacency,
    itemById,
    bundleIndexById,
    dependencyDirection,
    dependencyDepthHops,
  });

  const focusedIds = useMemo(() => {
    if (!edgeFocusId) return null;
    const s = new Set<string>([edgeFocusId]);
    for (const e of edges) {
      s.add(e.fromId);
      s.add(e.toId);
    }
    return s;
  }, [edgeFocusId, edges]);

  const totalScrollH = AXIS_TOP + virtualizer.getTotalSize();
  const maxViewportH = Math.max(
    MIN_VIEWPORT_H,
    Math.min(windowHeight - VIEWPORT_SCREEN_PADDING, Math.round(windowHeight * MAX_VIEWPORT_RATIO)),
  );
  const viewportH = Math.max(MIN_VIEWPORT_H, Math.min(maxViewportH, totalScrollH));
  const needsScroll = totalScrollH > viewportH;

  useEffect(() => {
    const onResize = () => setWindowHeight(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useGanttCanvasDraw({
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
    hoveredId: hover?.item.unique_id ?? null,
    effectiveLabelW,
    timeZone,
    testStatsById,
    theme,
    showTests,
    setContainerWidth,
  });

  if (allBundles.length === 0) {
    return (
      <div className="empty-state empty-state--chart">
        No Gantt data (run_results may lack timing info)
      </div>
    );
  }

  function handlePointerInteraction(e: React.MouseEvent<HTMLDivElement>, mode: 'click' | 'move') {
    applyGanttPointerInteraction(e, mode, {
      bundles,
      layout,
      scrollTop,
      rangeStart,
      rangeEnd,
      effectiveLabelW,
      canvas: canvasRef.current,
      setHover,
      onSelect,
    });
  }

  return (
    <div className="gantt-shell" role="region" aria-label="Execution timeline">
      {canShowTimestamps && (
        <GanttModeToggle
          activeMode={activeMode}
          onChange={setDisplayMode}
          activeTimeZone={timeZone}
          timeZones={availableTimeZones}
          onTimeZoneChange={setTimeZone}
        />
      )}
      <GanttTimeBrush
        bundles={allBundles}
        maxEnd={absoluteMaxEnd}
        timeWindow={timeWindow}
        testStatsById={testStatsById}
        onChange={onTimeWindowChange ?? (() => {})}
      />

      <GanttChartFrame
        canvasRef={canvasRef}
        scrollRef={scrollRef}
        edges={edges}
        edgeFocusId={edgeFocusId}
        itemById={itemById}
        bundleIndexById={bundleIndexById}
        bundles={bundles}
        rowOffsets={rowOffsets}
        containerWidth={containerWidth}
        effectiveLabelW={effectiveLabelW}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        scrollTop={scrollTop}
        viewportH={viewportH}
        needsScroll={needsScroll}
        totalScrollH={totalScrollH}
        theme={theme}
        showTests={showTests}
        hover={hover}
        runStartedAt={runStartedAt}
        canShowTimestamps={canShowTimestamps}
        timeZone={timeZone}
        testStatsById={testStatsById}
        resourceByUniqueId={resourceByUniqueId}
        selectedId={selectedId}
        onSelect={onSelect}
        onPointer={handlePointerInteraction}
        onHoverClear={() => setHover(null)}
        labelColumnResize={{
          width: effectiveLabelW,
          viewportH,
          minW: LABEL_COLUMN_MIN_PX,
          maxW: maxLabelW,
          onChange: onLabelColumnWidthDrag,
        }}
      />
    </div>
  );
}
