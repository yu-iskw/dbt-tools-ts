import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  LABEL_COLUMN_MAX_PX,
  LABEL_COLUMN_MIN_PX,
  LABEL_COLUMN_RESERVED_CHART_PX,
  LABEL_W,
  TIMELINE_LABEL_WIDTH_STORAGE_KEY,
} from './constants';
import { getInitialLabelColumnWidth } from './formatting';

export function clampGanttLabelColumnWidth(px: number, containerWidth: number): number {
  const max =
    containerWidth > 0
      ? Math.max(
          LABEL_COLUMN_MIN_PX,
          Math.min(LABEL_COLUMN_MAX_PX, containerWidth - LABEL_COLUMN_RESERVED_CHART_PX),
        )
      : LABEL_COLUMN_MAX_PX;
  return Math.max(LABEL_COLUMN_MIN_PX, Math.min(max, Math.round(px)));
}

export function useGanttLabelColumnWidth(containerWidth: number): {
  effectiveLabelW: number;
  maxLabelW: number;
  onLabelColumnWidthDrag: (nextWidthPx: number) => void;
} {
  const [labelColumnPx, setLabelColumnPx] = useState(() =>
    typeof window === 'undefined' ? LABEL_W : getInitialLabelColumnWidth(220),
  );

  useEffect(() => {
    if (containerWidth <= 0) return;
    setLabelColumnPx((prev) => clampGanttLabelColumnWidth(prev, containerWidth));
  }, [containerWidth]);

  useEffect(() => {
    try {
      window.localStorage.setItem(TIMELINE_LABEL_WIDTH_STORAGE_KEY, String(labelColumnPx));
    } catch {
      // ignore localStorage failures
    }
  }, [labelColumnPx]);

  const maxLabelW = useMemo(() => {
    if (containerWidth <= 0) return LABEL_COLUMN_MAX_PX;
    return Math.max(
      LABEL_COLUMN_MIN_PX,
      Math.min(LABEL_COLUMN_MAX_PX, containerWidth - LABEL_COLUMN_RESERVED_CHART_PX),
    );
  }, [containerWidth]);

  const effectiveLabelW =
    containerWidth > 0 ? clampGanttLabelColumnWidth(labelColumnPx, containerWidth) : labelColumnPx;

  const onLabelColumnWidthDrag = useCallback(
    (nextWidthPx: number) => {
      const cw = containerWidth > 0 ? containerWidth : 800;
      setLabelColumnPx(clampGanttLabelColumnWidth(nextWidthPx, cw));
    },
    [containerWidth],
  );

  return { effectiveLabelW, maxLabelW, onLabelColumnWidthDrag };
}
