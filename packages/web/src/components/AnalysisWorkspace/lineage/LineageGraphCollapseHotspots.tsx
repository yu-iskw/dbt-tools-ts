import { describeSummaryNode } from '@web/lib/analysis-workspace/lineage-collapse';
import { GROUP_HEADER_HEIGHT } from '@web/lib/analysis-workspace/lineage-group-layout';

import { edgeGeometry } from './lineage-graph-geometry';
import { estimateBadgeWidth } from './lineage-overlay-constants';

import type { PositionResolver, RenderedEdge } from './lineage-graph-geometry';
import type { LineageCollapseView } from './use-grouped-lineage-layout';
import type { LineageGroupRect } from '@web/lib/analysis-workspace/lineage-group-layout';
import type { CSSProperties, ReactElement } from 'react';

const BUNDLE_HOTSPOT_HEIGHT = 16;

function groupName(rect: LineageGroupRect): string {
  return rect.kind === 'lane' ? rect.label : `${rect.levelLabel} ${rect.label}`;
}

function endpointName(id: string, labelById: ReadonlyMap<string, string>): string {
  return labelById.get(id) ?? id.split('.').at(-1) ?? id;
}

/** Keeps a press on a toggle from starting a viewport pan. */
const stopPan = (event: { stopPropagation: () => void }) => event.stopPropagation();

/**
 * Buttons for collapse state: one per summary node, one per container header, and one per
 * bundle count chip. All use native buttons, so Enter and Space work.
 */
export function LineageGraphCollapseHotspots({
  collapse,
  groupRects,
  edges,
  resolvePosition,
  svgWidth,
  svgHeight,
  nodeWidth,
  nodeHeight,
  setHoveredId,
}: {
  collapse: LineageCollapseView;
  groupRects: readonly LineageGroupRect[];
  edges: readonly RenderedEdge[];
  resolvePosition: PositionResolver;
  svgWidth: number;
  svgHeight: number;
  nodeWidth: number;
  nodeHeight: number;
  setHoveredId: (id: string | null) => void;
}): ReactElement {
  const box = (x: number, y: number, width: number, height: number): CSSProperties => ({
    left: `${(x / svgWidth) * 100}%`,
    top: `${(y / svgHeight) * 100}%`,
    width: `${(width / svgWidth) * 100}%`,
    height: `${(height / svgHeight) * 100}%`,
  });
  const summaryById = new Map(collapse.summaries.map((summary) => [summary.id, summary]));
  const labelById = new Map(collapse.summaries.map((summary) => [summary.id, summary.label]));
  const bundles = edges.filter((edge) => (edge.count ?? 1) > 1);

  return (
    <>
      {groupRects
        .filter((rect) => collapse.toggleableGroupIds.has(rect.groupId))
        .map((rect) => {
          const expanded = !collapse.collapsedGroupIds.has(rect.groupId);
          return (
            <button
              key={`toggle:${rect.groupId}`}
              type="button"
              className="lineage-group__toggle"
              style={box(rect.x, rect.y, rect.width, GROUP_HEADER_HEIGHT)}
              aria-expanded={expanded}
              aria-label={`${expanded ? 'Collapse' : 'Expand'} ${groupName(rect)}`}
              // A collapsed group's summary card is its keyboard and screen reader control.
              aria-hidden={expanded ? undefined : true}
              tabIndex={expanded ? undefined : -1}
              onPointerDown={stopPan}
              onClick={() => collapse.onToggleGroup(rect.groupId)}
            />
          );
        })}
      {collapse.summaries.map((summary) => (
        <button
          key={summary.id}
          type="button"
          className="dependency-graph__hotspot dependency-graph__hotspot--summary"
          style={box(summary.x, summary.y, nodeWidth, nodeHeight)}
          aria-expanded={false}
          aria-label={`Expand ${summary.levelLabel} ${summary.label}, ${summary.memberCount} ${summary.memberCount === 1 ? 'resource' : 'resources'}`}
          title={describeSummaryNode(summary)}
          onPointerDown={stopPan}
          onClick={() => collapse.onToggleGroup(summary.groupId)}
          onMouseEnter={() => setHoveredId(summary.id)}
          onMouseLeave={() => setHoveredId(null)}
        />
      ))}
      {bundles.map((edge) => {
        const from = resolvePosition(edge.from);
        const to = resolvePosition(edge.to);
        if (!from || !to) return null;
        const { midX, midY } = edgeGeometry(from, to, nodeWidth, nodeHeight);
        const count = edge.count ?? 1;
        const width = estimateBadgeWidth(`×${count}`);
        const groupIds = [edge.from, edge.to].flatMap((id) => summaryById.get(id)?.groupId ?? []);
        return (
          <button
            key={`bundle:${edge.from}->${edge.to}`}
            type="button"
            className="dependency-graph__bundle-hotspot"
            style={box(
              midX - width / 2,
              midY - BUNDLE_HOTSPOT_HEIGHT / 2,
              width,
              BUNDLE_HOTSPOT_HEIGHT,
            )}
            aria-label={`${count} edges from ${endpointName(edge.from, labelById)} to ${endpointName(edge.to, labelById)}${groupIds.length > 0 ? ', expand to show them' : ''}`}
            title={`${count} edges bundled`}
            disabled={groupIds.length === 0}
            onPointerDown={stopPan}
            onClick={() => collapse.onExpandGroups(groupIds)}
          />
        );
      })}
    </>
  );
}
