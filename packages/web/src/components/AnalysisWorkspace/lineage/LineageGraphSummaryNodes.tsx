import { summaryTypeLine } from '@web/lib/analysis-workspace/lineage-collapse';

import { estimateBadgeWidth } from './lineage-overlay-constants';

import type { SummaryNodeView } from './use-grouped-lineage-layout';
import type { LineageDisplayMode } from '@web/lib/analysis-workspace/lineage-model';
import type { ReactElement } from 'react';

/** Run status tone to the stat pill modifier already used by node test pills. */
const TONE_PILL = new Map([
  ['danger', 'fail'],
  ['neutral', 'neutral'],
  ['positive', 'pass'],
  ['skipped', 'skipped'],
  ['warning', 'not-executed'],
]);

const PILL_GAP = 4;

function SummaryStatusPills({
  summary,
  x,
  y,
  height,
}: {
  summary: SummaryNodeView;
  x: number;
  y: number;
  height: number;
}): ReactElement {
  const pills = summary.statusCounts.reduce<
    Array<{ tone: string; label: string; modifier: string; left: number; width: number }>
  >((placed, { tone, count }) => {
    const previous = placed.at(-1);
    const left = previous ? previous.left + previous.width + PILL_GAP : x + 16;
    const label = String(count);
    return [
      ...placed,
      {
        tone,
        label,
        modifier: TONE_PILL.get(tone) ?? 'neutral',
        left,
        width: estimateBadgeWidth(label),
      },
    ];
  }, []);
  return (
    <>
      {pills.map(({ tone, label, modifier, left, width }) => (
        <g key={tone}>
          <rect
            x={left}
            y={y}
            width={width}
            height={height}
            rx={height / 2}
            className={`dependency-graph__node-stat-pill dependency-graph__node-stat-pill--${modifier}`}
          />
          <text
            x={left + width / 2}
            y={y + height / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            className={`dependency-graph__node-stat dependency-graph__node-stat--${modifier}`}
          >
            {label}
          </text>
        </g>
      ))}
    </>
  );
}

function LineageGraphSummaryNode({
  summary,
  nodeWidth,
  nodeHeight,
  nodeRadius,
  displayMode,
  isHighlighted,
}: {
  summary: SummaryNodeView;
  nodeWidth: number;
  nodeHeight: number;
  nodeRadius: number;
  displayMode: LineageDisplayMode;
  isHighlighted: boolean;
}): ReactElement {
  const { x, y } = summary;
  const dimmed = isHighlighted ? '' : ' dependency-graph__node--dimmed';
  const badgeY = displayMode === 'summary' ? y + nodeHeight - 20 : y + nodeHeight - 23;
  const badgeHeight = displayMode === 'summary' ? 15 : 17;
  const resources = `${summary.memberCount} ${summary.memberCount === 1 ? 'resource' : 'resources'}`;
  const meta = `${resources} · ${summaryTypeLine(summary)}`;
  return (
    <g className="dependency-graph__summary-node" data-group-id={summary.groupId}>
      <rect
        x={x}
        y={y}
        width={nodeWidth}
        height={nodeHeight}
        rx={nodeRadius}
        className={`dependency-graph__node-base${dimmed}`}
      />
      <rect
        x={x}
        y={y}
        width={nodeWidth}
        height={nodeHeight}
        rx={nodeRadius}
        className={`dependency-graph__node dependency-graph__node--summary${dimmed}`}
      />
      <foreignObject
        x={x + 12}
        y={displayMode === 'summary' ? y + 10 : y + 12}
        width={nodeWidth - 24}
        height={displayMode === 'summary' ? 20 : 24}
      >
        <div className="dependency-graph__node-title-row" title={summary.label}>
          <span className="dependency-graph__summary-chevron" aria-hidden="true">
            ▸
          </span>
          <span className="dependency-graph__node-title-text dependency-graph__summary-title">
            {summary.label}
          </span>
        </div>
      </foreignObject>
      <foreignObject x={x + 12} y={badgeY - 21} width={nodeWidth - 24} height={16}>
        <div className="dependency-graph__summary-meta" title={meta}>
          {meta}
        </div>
      </foreignObject>
      <SummaryStatusPills summary={summary} x={x} y={badgeY} height={badgeHeight} />
    </g>
  );
}

/** One card per collapsed container, drawn where its members were. */
export function LineageGraphSummaryNodes({
  summaries,
  nodeWidth,
  nodeHeight,
  nodeRadius,
  displayMode,
  highlightedIds,
  hasHoverFocus,
}: {
  summaries: readonly SummaryNodeView[];
  nodeWidth: number;
  nodeHeight: number;
  nodeRadius: number;
  displayMode: LineageDisplayMode;
  highlightedIds: Set<string>;
  hasHoverFocus: boolean;
}): ReactElement {
  return (
    <>
      {summaries.map((summary) => (
        <LineageGraphSummaryNode
          key={summary.id}
          summary={summary}
          nodeWidth={nodeWidth}
          nodeHeight={nodeHeight}
          nodeRadius={nodeRadius}
          displayMode={displayMode}
          isHighlighted={!hasHoverFocus || highlightedIds.has(summary.id)}
        />
      ))}
    </>
  );
}
