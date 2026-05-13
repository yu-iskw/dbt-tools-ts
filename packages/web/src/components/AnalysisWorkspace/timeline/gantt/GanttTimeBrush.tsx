import { useRef, useState } from 'react';
import type { BundleRow } from '@web/lib/analysis-workspace/bundleLayout';
import type { TimeWindow } from '@web/lib/analysis-workspace/types';
import type { ResourceTestStats } from '@web/types';
import { isIssueStatus } from './formatting';

const MIN_BRUSH_WINDOW_MS = 1_000;
type BrushDragMode = 'create' | 'pan' | 'start' | 'end';

export function hasIssueSignal(
  bundle: BundleRow,
  testStatsById?: Map<string, ResourceTestStats>,
): boolean {
  const stats = testStatsById?.get(bundle.item.unique_id);
  if (stats && stats.error + stats.warn > 0) return true;
  return (
    isIssueStatus(bundle.item.status) || bundle.tests.some((test) => isIssueStatus(test.status))
  );
}

function clampWindow(start: number, end: number, maxEnd: number) {
  return {
    start: Math.max(0, Math.min(start, maxEnd)),
    end: Math.max(0, Math.min(end, maxEnd)),
  };
}

export function GanttTimeBrush({
  bundles,
  maxEnd,
  timeWindow,
  testStatsById,
  onChange,
}: {
  bundles: BundleRow[];
  /** Full timeline span in ms (denominator for bar positions and drag math). */
  maxEnd: number;
  /** Active global zoom window. null = full run. */
  timeWindow: TimeWindow | null;
  testStatsById?: Map<string, ResourceTestStats>;
  onChange: (nextTimeWindow: TimeWindow | null) => void;
}) {
  const brushRef = useRef<HTMLDivElement>(null);
  const [previewWindow, setPreviewWindow] = useState<TimeWindow | null>(null);
  const dragRef = useRef<{
    mode: BrushDragMode;
    startPx: number;
    initialStart: number;
    initialEnd: number;
    currentStart: number;
    currentEnd: number;
  } | null>(null);

  const minWindowMs = Math.min(Math.max(MIN_BRUSH_WINDOW_MS, maxEnd * 0.01), maxEnd);
  const activeStart = timeWindow?.start ?? 0;
  const activeEnd = timeWindow?.end ?? maxEnd;
  const hasActiveZoom = timeWindow != null;

  function getPointerMs(clientX: number): number {
    const brushEl = brushRef.current;
    if (!brushEl) return 0;
    const width = brushEl.clientWidth;
    if (width <= 0 || maxEnd <= 0) return 0;
    const left = brushEl.getBoundingClientRect().left;
    return ((clientX - left) / width) * maxEnd;
  }

  function beginBrushDrag(e: React.PointerEvent<Element>, mode: BrushDragMode) {
    if (!brushRef.current) return;
    const width = brushRef.current.clientWidth;
    if (width <= 0 || maxEnd <= 0) return;
    const startMs = getPointerMs(e.clientX);
    dragRef.current = {
      mode,
      startPx: e.clientX,
      initialStart: mode === 'create' ? startMs : activeStart,
      initialEnd: mode === 'create' ? startMs : activeEnd,
      currentStart: mode === 'create' ? startMs : activeStart,
      currentEnd: mode === 'create' ? startMs : activeEnd,
    };
    setPreviewWindow(mode === 'create' ? { start: startMs, end: startMs } : timeWindow);
    brushRef.current.setPointerCapture(e.pointerId);
  }

  function onBrushPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const brushEl = brushRef.current;
    if (!drag || !brushEl || maxEnd <= 0) return;
    const width = brushEl.clientWidth;
    if (width <= 0) return;
    const deltaMs = ((e.clientX - drag.startPx) / width) * maxEnd;
    const currentDuration = drag.initialEnd - drag.initialStart;
    const pointerMs = getPointerMs(e.clientX);

    if (drag.mode === 'create') {
      const nextWindow = {
        start: Math.min(drag.initialStart, pointerMs),
        end: Math.max(drag.initialStart, pointerMs),
      };
      dragRef.current = {
        ...drag,
        currentStart: nextWindow.start,
        currentEnd: nextWindow.end,
      };
      setPreviewWindow(nextWindow);
      return;
    }

    if (drag.mode === 'pan') {
      const nextStart = Math.min(
        Math.max(0, drag.initialStart + deltaMs),
        maxEnd - currentDuration,
      );
      const nextWindow = {
        start: nextStart,
        end: nextStart + currentDuration,
      };
      dragRef.current = {
        ...drag,
        currentStart: nextWindow.start,
        currentEnd: nextWindow.end,
      };
      setPreviewWindow(nextWindow);
      return;
    }
    if (drag.mode === 'start') {
      const nextStart = Math.min(
        Math.max(0, drag.initialStart + deltaMs),
        drag.initialEnd - minWindowMs,
      );
      const nextWindow = {
        start: nextStart,
        end: drag.initialEnd,
      };
      dragRef.current = {
        ...drag,
        currentStart: nextWindow.start,
        currentEnd: nextWindow.end,
      };
      setPreviewWindow(nextWindow);
      return;
    }
    const nextEnd = Math.max(
      Math.min(maxEnd, drag.initialEnd + deltaMs),
      drag.initialStart + minWindowMs,
    );
    const nextWindow = {
      start: drag.initialStart,
      end: nextEnd,
    };
    dragRef.current = {
      ...drag,
      currentStart: nextWindow.start,
      currentEnd: nextWindow.end,
    };
    setPreviewWindow(nextWindow);
  }

  function endBrushDrag(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (drag && brushRef.current?.hasPointerCapture(e.pointerId)) {
      brushRef.current.releasePointerCapture(e.pointerId);
    }
    if (drag) {
      const next = clampWindow(drag.currentStart, drag.currentEnd, maxEnd);
      const span = next.end - next.start;
      if (drag.mode !== 'create' || span >= minWindowMs) {
        if (next.start <= 0 && next.end >= maxEnd) {
          onChange(null);
        } else {
          onChange(next);
        }
      }
    }
    dragRef.current = null;
    setPreviewWindow(null);
  }

  const selection =
    previewWindow ??
    (hasActiveZoom ? { start: activeStart, end: activeEnd } : { start: 0, end: maxEnd });
  const brushLeftPct =
    selection == null ? 0 : Math.max(0, Math.min(100, (selection.start / maxEnd) * 100));
  const brushRightPct =
    selection == null ? 0 : Math.max(0, Math.min(100, (selection.end / maxEnd) * 100));
  const brushWidthPct = Math.max(0, brushRightPct - brushLeftPct);
  const canResetZoom = hasActiveZoom;

  return (
    <div className="gantt-brush-wrap">
      <div className="gantt-brush__header">
        <p className="gantt-brush__title">Time range</p>
        <button
          type="button"
          className="workspace-pill"
          disabled={!canResetZoom}
          onClick={() => onChange(null)}
        >
          Reset zoom
        </button>
      </div>
      <div
        ref={brushRef}
        className="gantt-brush"
        onPointerDown={(e) => {
          if (e.target !== e.currentTarget || e.button !== 0) return;
          beginBrushDrag(e, 'create');
        }}
        onPointerMove={onBrushPointerMove}
        onPointerUp={endBrushDrag}
        onPointerCancel={endBrushDrag}
        role="slider"
        aria-label="Timeline time range"
        aria-valuemin={0}
        aria-valuemax={Math.round(maxEnd)}
        aria-valuenow={Math.round(activeStart)}
        aria-valuetext={`${Math.round(activeStart)} to ${Math.round(activeEnd)} ms`}
      >
        {bundles.map((bundle) => {
          const rel0 = Math.max(0, bundle.item.start);
          const rel1 = Math.max(rel0, bundle.item.end);
          const startPct = (rel0 / maxEnd) * 100;
          const widthPct = Math.max(0.2, ((rel1 - rel0) / maxEnd) * 100);
          const hasIssue = hasIssueSignal(bundle, testStatsById);
          return (
            <span
              key={bundle.item.unique_id}
              className={hasIssue ? 'gantt-brush__bar gantt-brush__bar--issue' : 'gantt-brush__bar'}
              data-issue={hasIssue ? 'true' : 'false'}
              style={{ left: `${startPct}%`, width: `${widthPct}%` }}
            />
          );
        })}
        {selection != null && (
          <div
            className={
              hasActiveZoom || previewWindow != null
                ? 'gantt-brush__selection'
                : 'gantt-brush__selection gantt-brush__selection--default'
            }
            data-default-range={hasActiveZoom || previewWindow != null ? 'false' : 'true'}
            style={{ left: `${brushLeftPct}%`, width: `${brushWidthPct}%` }}
            onPointerDown={(e) => beginBrushDrag(e, 'pan')}
          >
            <span
              className="gantt-brush__handle gantt-brush__handle--start"
              onPointerDown={(e) => {
                e.stopPropagation();
                beginBrushDrag(e, 'start');
              }}
            />
            <span
              className="gantt-brush__handle gantt-brush__handle--end"
              onPointerDown={(e) => {
                e.stopPropagation();
                beginBrushDrag(e, 'end');
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
