import { useLayoutEffect, useRef, useState, type MouseEvent, type RefObject } from 'react';

import { GanttEdgeLayer } from './GanttEdgeLayer';
import { GanttLabelResizeHandle } from './GanttLabelResizeHandle';
import { GanttTooltip } from './GanttTooltip';

import type { FocusTimelineEdge } from './edge-geometry';
import type { HoverState } from './hit-test';
import type { ThemeMode } from '@web/constants/theme-colors';
import type { BundleRow } from '@web/lib/analysis-workspace/bundle-layout';
import type { GanttItem, ResourceNode, ResourceTestStats } from '@web/types';
import type { ReactElement } from 'react';

export interface GanttLabelColumnResizeProps {
  width: number;
  viewportH: number;
  minW: number;
  maxW: number;
  onChange: (nextWidthPx: number) => void;
}

export function GanttChartFrame({
  canvasRef,
  scrollRef,
  edges,
  edgeFocusId,
  itemById,
  bundleIndexById,
  bundles,
  rowOffsets,
  containerWidth,
  effectiveLabelW,
  rangeStart,
  rangeEnd,
  scrollTop,
  viewportH,
  needsScroll,
  totalScrollH,
  theme,
  showTests,
  hover,
  runStartedAt,
  canShowTimestamps,
  timeZone,
  testStatsById,
  resourceByUniqueId,
  selectedId,
  onSelect,
  onPointer,
  onHoverClear,
  labelColumnResize,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  scrollRef: RefObject<HTMLDivElement | null>;
  edges: FocusTimelineEdge[];
  edgeFocusId: string | null;
  itemById: Map<string, GanttItem>;
  bundleIndexById: Map<string, number>;
  bundles: BundleRow[];
  rowOffsets: number[];
  containerWidth: number;
  effectiveLabelW: number;
  rangeStart: number;
  rangeEnd: number;
  scrollTop: number;
  viewportH: number;
  needsScroll: boolean;
  totalScrollH: number;
  theme: ThemeMode;
  showTests: boolean;
  hover: HoverState | null;
  runStartedAt?: number | null;
  canShowTimestamps: boolean;
  timeZone: string;
  testStatsById?: Map<string, ResourceTestStats>;
  resourceByUniqueId?: ReadonlyMap<string, ResourceNode>;
  selectedId: string | null;
  onSelect?: (id: string | null) => void;
  onPointer: (e: MouseEvent<HTMLDivElement>, mode: 'click' | 'move') => void;
  onHoverClear: () => void;
  labelColumnResize?: GanttLabelColumnResizeProps;
}): ReactElement {
  const frameRef = useRef<HTMLElement>(null);
  const [frameWidth, setFrameWidth] = useState(0);

  useLayoutEffect(() => {
    const frameEl = frameRef.current;
    if (!frameEl) return;
    const syncWidth = () => setFrameWidth(frameEl.getBoundingClientRect().width);
    syncWidth();
    const observer = new ResizeObserver(syncWidth);
    observer.observe(frameEl);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={frameRef}
      className="chart-frame"
      style={{ position: 'relative', userSelect: 'none' }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: viewportH,
          pointerEvents: 'none',
          display: 'block',
        }}
      />

      <GanttEdgeLayer
        edges={edges}
        focusId={edgeFocusId}
        itemById={itemById}
        bundleIndexById={bundleIndexById}
        bundles={bundles}
        rowOffsets={rowOffsets}
        canvasWidth={containerWidth > 0 ? containerWidth : 600}
        effectiveLabelW={effectiveLabelW}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        scrollTop={scrollTop}
        viewportH={viewportH}
        theme={theme}
        showTests={showTests}
      />

      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- chart viewport hit-test + scroll */}
      <div
        ref={scrollRef}
        className="chart-frame__viewport"
        role="region"
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- keyboard scroll / activation
        tabIndex={0}
        aria-label="Timeline chart viewport — use arrow keys to scroll"
        style={{
          position: 'relative',
          height: viewportH,
          overflowY: needsScroll ? 'auto' : 'hidden',
        }}
        onMouseMove={(e) => onPointer(e, 'move')}
        onClick={(e) => onPointer(e, 'click')}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          const activeId = hover?.item.unique_id ?? selectedId;
          if (!activeId) return;
          onSelect?.(activeId);
        }}
        onMouseLeave={onHoverClear}
      >
        <div style={{ height: totalScrollH }} />
      </div>

      {labelColumnResize ? (
        <GanttLabelResizeHandle
          labelColumnW={labelColumnResize.width}
          viewportH={labelColumnResize.viewportH}
          minW={labelColumnResize.minW}
          maxW={labelColumnResize.maxW}
          onWidthChange={labelColumnResize.onChange}
        />
      ) : null}

      {hover && (
        <GanttTooltip
          hover={hover}
          frameWidth={frameWidth > 0 ? frameWidth : containerWidth}
          frameHeight={viewportH}
          runStartedAt={runStartedAt}
          canShowTimestamps={canShowTimestamps}
          timeZone={timeZone}
          testStats={testStatsById?.get(hover.item.unique_id)}
          resourceByUniqueId={resourceByUniqueId}
        />
      )}
    </section>
  );
}
