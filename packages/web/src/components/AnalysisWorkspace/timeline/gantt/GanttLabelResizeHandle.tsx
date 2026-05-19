import { useCallback, useRef, type PointerEvent } from 'react';

import type { ReactElement } from 'react';

const HANDLE_W = 8;

export function GanttLabelResizeHandle({
  labelColumnW,
  viewportH,
  minW,
  maxW,
  onWidthChange,
}: {
  labelColumnW: number;
  viewportH: number;
  minW: number;
  maxW: number;
  onWidthChange: (nextWidthPx: number) => void;
}): ReactElement {
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  const clamp = useCallback(
    (w: number) => Math.max(minW, Math.min(maxW, Math.round(w))),
    [minW, maxW],
  );

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = { startX: e.clientX, startW: labelColumnW };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [labelColumnW],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      if (!d) return;
      const next = d.startW + (e.clientX - d.startX);
      onWidthChange(clamp(next));
    },
    [clamp, onWidthChange],
  );

  const onPointerUp = useCallback((e: PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore double-release
    }
  }, []);

  const leftPx = Math.max(0, labelColumnW - HANDLE_W / 2);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize timeline name column"
      className="gantt-label-resize-handle"
      style={{
        position: 'absolute',
        left: leftPx,
        top: 0,
        width: HANDLE_W,
        height: viewportH,
        cursor: 'col-resize',
        touchAction: 'none',
        zIndex: 4,
        background: 'transparent',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  );
}
