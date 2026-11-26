import type { SummaryNodeView } from './use-grouped-lineage-layout';
import type { BoundaryCrossing } from '@dbt-tools/core/browser';
import type { LineageGraphNodeLayout } from '@web/lib/analysis-workspace/lineage-model';

export interface Point {
  x: number;
  y: number;
}

/** An edge as drawn: a real edge (count 1) or a bundle of several. Ungrouped edges carry neither field. */
export interface RenderedEdge {
  from: string;
  to: string;
  count?: number;
  crossing?: BoundaryCrossing;
}

export type PositionResolver = (id: string) => Point | null;

/** Widest bundled edge stroke, in px. */
const MAX_BUNDLE_STROKE = 4;
const BASE_STROKE = 1.4;

/** Stroke width grows with log2(count) and is capped; a single edge keeps its stylesheet width. */
export function bundleStrokeWidth(count: number): number {
  return Math.min(MAX_BUNDLE_STROKE, BASE_STROKE + Math.log2(count));
}

/** Top-left position of a real node (with drag offsets) or a summary node; null if neither is drawn. */
export function makePositionResolver({
  visibleNodeLayouts,
  summaries,
  getEffectivePos,
}: {
  visibleNodeLayouts: Map<string, LineageGraphNodeLayout>;
  summaries: readonly SummaryNodeView[];
  getEffectivePos: (nodeId: string, baseX: number, baseY: number) => Point;
}): PositionResolver {
  const summaryById = new Map(summaries.map((summary) => [summary.id, summary]));
  return (id) => {
    const layout = visibleNodeLayouts.get(id);
    if (layout) return getEffectivePos(id, layout.x, layout.y);
    const summary = summaryById.get(id);
    return summary ? { x: summary.x, y: summary.y } : null;
  };
}

/** Cubic path from the right edge of `from` to the left edge of `to`, and its midpoint. */
export function edgeGeometry(
  from: Point,
  to: Point,
  nodeWidth: number,
  nodeHeight: number,
): { path: string; midX: number; midY: number } {
  const startX = from.x + nodeWidth;
  const startY = from.y + nodeHeight / 2;
  const endX = to.x;
  const endY = to.y + nodeHeight / 2;
  const curve = Math.max(28, Math.abs(endX - startX) * 0.34);
  return {
    path: `M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`,
    // Both control points sit level with their endpoints, so the curve's t=0.5 point is the midpoint.
    midX: (startX + endX) / 2,
    midY: (startY + endY) / 2,
  };
}
