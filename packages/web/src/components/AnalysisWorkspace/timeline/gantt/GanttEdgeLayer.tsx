import { type ThemeMode, getThemeHex } from '@web/constants/theme-colors';

import { X_PAD } from './constants';
import { type FocusTimelineEdge, focusEdgePath } from './edge-geometry';

import type { BundleRow } from '@web/lib/analysis-workspace/bundle-layout';
import type { GanttItem } from '@web/types';
import type { ReactElement } from 'react';

const MARKER_W = 8;
const MARKER_H = 8;

function focusEdgeVisualProps(
  edge: FocusTimelineEdge,
  t: ReturnType<typeof getThemeHex>,
  markerIds: {
    primary: string;
    secondary: string;
    downstream: string;
  },
) {
  const hop = edge.hop ?? 1;
  if (hop >= 2) {
    if (edge.leg === 'upstream') {
      return {
        stroke: t.slate,
        strokeWidth: 1,
        strokeDasharray: '3 4',
        opacity: 0.36,
        markerEnd: `url(#${markerIds.secondary})`,
      };
    }
    return {
      stroke: t.accent,
      strokeWidth: 1,
      strokeDasharray: '4 5',
      opacity: 0.4,
      markerEnd: `url(#${markerIds.downstream})`,
    };
  }

  switch (edge.tier) {
    case 'secondary':
      return {
        stroke: t.slate,
        strokeWidth: 1,
        strokeDasharray: '4 3',
        opacity: 0.42,
        markerEnd: `url(#${markerIds.secondary})`,
      };
    case 'downstream':
      return {
        stroke: t.accent,
        strokeWidth: 1.5,
        strokeDasharray: '5 4',
        opacity: 0.62,
        markerEnd: `url(#${markerIds.downstream})`,
      };
    default:
      return {
        stroke: t.accent,
        strokeWidth: 2,
        strokeDasharray: '6 4',
        opacity: 0.88,
        markerEnd: `url(#${markerIds.primary})`,
      };
  }
}

function ArrowMarker({ id, fill }: { id: string; fill: string }) {
  return (
    <marker
      id={id}
      viewBox={`0 0 ${MARKER_W} ${MARKER_H}`}
      refX={MARKER_W - 0.5}
      refY={MARKER_H / 2}
      markerWidth={MARKER_W}
      markerHeight={MARKER_H}
      orient="auto"
      markerUnits="userSpaceOnUse"
    >
      <path d={`M0,0 L${MARKER_W},${MARKER_H / 2} L0,${MARKER_H} Z`} fill={fill} />
    </marker>
  );
}

export function GanttEdgeLayer({
  edges,
  focusId,
  itemById,
  bundleIndexById,
  bundles,
  rowOffsets,
  canvasWidth,
  effectiveLabelW,
  rangeStart,
  rangeEnd,
  scrollTop,
  viewportH,
  theme = 'light',
  showTests = true,
}: {
  edges: FocusTimelineEdge[];
  focusId: string | null;
  itemById: Map<string, GanttItem>;
  bundleIndexById: Map<string, number>;
  bundles: BundleRow[];
  rowOffsets: number[];
  canvasWidth: number;
  effectiveLabelW: number;
  rangeStart: number;
  rangeEnd: number;
  scrollTop: number;
  viewportH: number;
  theme?: ThemeMode;
  showTests?: boolean;
}): ReactElement | null {
  if (focusId == null || edges.length === 0) return null;

  const t = getThemeHex(theme);
  const approxChartW = canvasWidth - effectiveLabelW - X_PAD;

  const markerPrimary = 'gantt-edge-mk-primary';
  const markerSecondary = 'gantt-edge-mk-secondary';
  const markerDownstream = 'gantt-edge-mk-downstream';
  const markerRefs = {
    primary: markerPrimary,
    secondary: markerSecondary,
    downstream: markerDownstream,
  };

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: viewportH,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 5,
      }}
      aria-hidden
    >
      <defs>
        <ArrowMarker id={markerPrimary} fill={t.accent} />
        <ArrowMarker id={markerSecondary} fill={t.slate} />
        <ArrowMarker id={markerDownstream} fill={t.accent} />
      </defs>
      {edges.map((edge, i) => {
        const d = focusEdgePath({
          edge,
          itemById,
          bundleIndexById,
          bundles,
          rowOffsets,
          scrollTop,
          showTests,
          effectiveLabelW,
          rangeStart,
          rangeEnd,
          chartW: approxChartW,
        });
        if (!d) return null;

        const { stroke, strokeWidth, strokeDasharray, opacity, markerEnd } = focusEdgeVisualProps(
          edge,
          t,
          markerRefs,
        );

        return (
          <path
            key={`${edge.fromId}-${edge.toId}-${edge.tier}-${edge.hop}-${edge.leg}-${i}`}
            d={d}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
            fill="none"
            opacity={opacity}
            markerEnd={markerEnd}
          />
        );
      })}
    </svg>
  );
}
