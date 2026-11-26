import { bundleStrokeWidth, edgeGeometry } from './lineage-graph-geometry';
import { estimateBadgeWidth } from './lineage-overlay-constants';

import type { PositionResolver, RenderedEdge } from './lineage-graph-geometry';
import type { BoundaryCrossing } from '@dbt-tools/core/browser';
import type { ReactElement } from 'react';

const BUNDLE_LABEL_HEIGHT = 16;

function edgeClassName(crossing: BoundaryCrossing, dimmed: boolean, resting: boolean): string {
  const crossingClass =
    crossing === 'inner'
      ? ' dependency-graph__edge--cross-inner'
      : crossing === 'outer'
        ? ' dependency-graph__edge--cross-outer'
        : '';
  const stateClass = dimmed
    ? ' dependency-graph__edge--dimmed'
    : resting
      ? ' dependency-graph__edge--resting'
      : '';
  return `dependency-graph__edge${crossingClass}${stateClass}`;
}

/** Count chip on a bundled edge; the matching button in the hotspot layer expands the bundle. */
function BundleLabel({
  x,
  y,
  count,
  dimmed,
}: {
  x: number;
  y: number;
  count: number;
  dimmed: boolean;
}): ReactElement {
  const label = `×${count}`;
  const width = estimateBadgeWidth(label);
  return (
    <g
      className={`dependency-graph__bundle-label${dimmed ? ' dependency-graph__bundle-label--dimmed' : ''}`}
    >
      <rect
        x={x - width / 2}
        y={y - BUNDLE_LABEL_HEIGHT / 2}
        width={width}
        height={BUNDLE_LABEL_HEIGHT}
        rx={BUNDLE_LABEL_HEIGHT / 2}
        className="dependency-graph__bundle-label-pill"
      />
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="middle"
        className="dependency-graph__bundle-label-text"
      >
        {label}
      </text>
    </g>
  );
}

/** Edges between display nodes: single edges as before, bundles thicker with a count chip. */
export function LineageGraphEdges({
  edges,
  resolvePosition,
  nodeWidth,
  nodeHeight,
  highlightedIds,
  hasHoverFocus,
  restingFocusId,
}: {
  edges: readonly RenderedEdge[];
  resolvePosition: PositionResolver;
  nodeWidth: number;
  nodeHeight: number;
  highlightedIds: Set<string>;
  hasHoverFocus: boolean;
  restingFocusId: string | null;
}): ReactElement {
  return (
    <>
      {edges.map((edge) => {
        const from = resolvePosition(edge.from);
        const to = resolvePosition(edge.to);
        if (!from || !to) return null;
        const geometry = edgeGeometry(from, to, nodeWidth, nodeHeight);
        const count = edge.count ?? 1;
        const dimmed =
          hasHoverFocus && !highlightedIds.has(edge.from) && !highlightedIds.has(edge.to);
        const resting =
          restingFocusId !== null && edge.from !== restingFocusId && edge.to !== restingFocusId;
        return (
          <g key={`${edge.from}->${edge.to}`}>
            <path
              d={geometry.path}
              className={edgeClassName(edge.crossing ?? 'none', dimmed, resting)}
              style={count > 1 ? { strokeWidth: bundleStrokeWidth(count) } : undefined}
            />
            {count > 1 ? (
              <BundleLabel x={geometry.midX} y={geometry.midY} count={count} dimmed={dimmed} />
            ) : null}
          </g>
        );
      })}
    </>
  );
}
