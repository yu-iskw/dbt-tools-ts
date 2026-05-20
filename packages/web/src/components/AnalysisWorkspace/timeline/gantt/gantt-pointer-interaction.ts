import { hitTestBundle, type BundleLayout, type HoverState } from './hit-test';

import type { BundleRow } from '@web/lib/analysis-workspace/bundle-layout';
import type { MouseEvent } from 'react';

export interface GanttPointerContext {
  bundles: BundleRow[];
  layout: BundleLayout;
  scrollTop: number;
  rangeStart: number;
  rangeEnd: number;
  effectiveLabelW: number;
  canvas: HTMLCanvasElement | null;
  setHover: (state: HoverState | null) => void;
  onSelect?: (id: string | null) => void;
}

/** Pointer hit-test for timeline bundle rows (hover + click selection). */
export function applyGanttPointerInteraction(
  e: MouseEvent<HTMLDivElement>,
  mode: 'click' | 'move',
  ctx: GanttPointerContext,
): void {
  const {
    bundles,
    layout,
    scrollTop,
    rangeStart,
    rangeEnd,
    effectiveLabelW,
    canvas,
    setHover,
    onSelect,
  } = ctx;
  const hit = hitTestBundle(
    e,
    bundles,
    layout,
    scrollTop,
    rangeStart,
    rangeEnd,
    effectiveLabelW,
    canvas,
  );
  if (!hit) {
    if (mode === 'move') setHover(null);
    else onSelect?.(null);
    return;
  }
  if (mode === 'move') {
    setHover({ item: hit.item, x: hit.x, y: hit.y });
    return;
  }
  onSelect?.(hit.item.unique_id);
}
