import type {
  LineageDisplayMode,
  LineageGraphNodeLayout,
} from '@web/lib/analysis-workspace/lineageModel';
import { getLensNodeFill, supportsTests } from '@web/lib/analysis-workspace/lineageModel';
import type { LensMode } from '@web/lib/analysis-workspace/types';
import { ResourceTypeIcon, formatResourceTypeLabel } from '../shared';
import { estimateBadgeWidth } from './lineageOverlayConstants';

function LineageGraphNodeTestPills({
  node,
  x,
  badgeY,
  badgeHeight,
  badgeRadius,
  displayMode,
}: {
  node: LineageGraphNodeLayout;
  x: number;
  badgeY: number;
  badgeHeight: number;
  badgeRadius: number;
  displayMode: LineageDisplayMode;
}) {
  const passLabel = String(node.passCount);
  const failLabel = String(node.failCount);
  const passBadgeWidth = estimateBadgeWidth(passLabel);
  const failBadgeWidth = estimateBadgeWidth(failLabel);
  const hasExtraTestPills = node.notExecutedCount > 0 || node.skippedCount > 0;
  const badgeGap = displayMode === 'summary' && hasExtraTestPills ? 4 : 6;
  const notExecLabel = node.notExecutedCount > 0 ? String(node.notExecutedCount) : '';
  const skippedLabel = node.skippedCount > 0 ? String(node.skippedCount) : '';
  const notExecBadgeWidth = notExecLabel ? estimateBadgeWidth(notExecLabel) : 0;
  const skippedBadgeWidth = skippedLabel ? estimateBadgeWidth(skippedLabel) : 0;
  const afterAttentionX = x + 16 + passBadgeWidth + badgeGap + failBadgeWidth;
  const notExecPillX = node.notExecutedCount > 0 ? afterAttentionX + badgeGap : 0;
  const skippedPillX =
    node.skippedCount > 0
      ? node.notExecutedCount > 0
        ? notExecPillX + notExecBadgeWidth + badgeGap
        : afterAttentionX + badgeGap
      : 0;

  return (
    <>
      <rect
        x={x + 16}
        y={badgeY}
        width={passBadgeWidth}
        height={badgeHeight}
        rx={badgeRadius}
        className="dependency-graph__node-stat-pill dependency-graph__node-stat-pill--pass"
      />
      <text
        x={x + 16 + passBadgeWidth / 2}
        y={badgeY + badgeHeight / 2}
        className="dependency-graph__node-stat dependency-graph__node-stat--pass"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {passLabel}
      </text>
      <rect
        x={x + 16 + passBadgeWidth + badgeGap}
        y={badgeY}
        width={failBadgeWidth}
        height={badgeHeight}
        rx={badgeRadius}
        className={`dependency-graph__node-stat-pill ${
          node.failCount === 0
            ? 'dependency-graph__node-stat-pill--neutral'
            : 'dependency-graph__node-stat-pill--fail'
        }`}
      />
      <text
        x={x + 16 + passBadgeWidth + badgeGap + failBadgeWidth / 2}
        y={badgeY + badgeHeight / 2}
        className={`dependency-graph__node-stat ${
          node.failCount === 0
            ? 'dependency-graph__node-stat--neutral'
            : 'dependency-graph__node-stat--fail'
        }`}
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {failLabel}
      </text>
      {node.notExecutedCount > 0 ? (
        <g>
          <title>{`Not executed in this run: ${node.notExecutedCount}`}</title>
          <rect
            x={notExecPillX}
            y={badgeY}
            width={notExecBadgeWidth}
            height={badgeHeight}
            rx={badgeRadius}
            className="dependency-graph__node-stat-pill dependency-graph__node-stat-pill--not-executed"
          />
          <text
            x={notExecPillX + notExecBadgeWidth / 2}
            y={badgeY + badgeHeight / 2}
            className="dependency-graph__node-stat dependency-graph__node-stat--not-executed"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {notExecLabel}
          </text>
        </g>
      ) : null}
      {node.skippedCount > 0 ? (
        <g>
          <title>{`Skipped dbt tests: ${node.skippedCount}`}</title>
          <rect
            x={skippedPillX}
            y={badgeY}
            width={skippedBadgeWidth}
            height={badgeHeight}
            rx={badgeRadius}
            className="dependency-graph__node-stat-pill dependency-graph__node-stat-pill--skipped"
          />
          <text
            x={skippedPillX + skippedBadgeWidth / 2}
            y={badgeY + badgeHeight / 2}
            className="dependency-graph__node-stat dependency-graph__node-stat--skipped"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {skippedLabel}
          </text>
        </g>
      ) : null}
    </>
  );
}

function LineageGraphSvgNode({
  node,
  getEffectivePos,
  nodeWidth,
  nodeHeight,
  nodeRadius,
  displayMode,
  lensMode,
  highlightedIds,
  hasHoverFocus,
}: {
  node: LineageGraphNodeLayout;
  getEffectivePos: (nodeId: string, baseX: number, baseY: number) => { x: number; y: number };
  nodeWidth: number;
  nodeHeight: number;
  nodeRadius: number;
  displayMode: LineageDisplayMode;
  lensMode: LensMode;
  highlightedIds: Set<string>;
  hasHoverFocus: boolean;
}) {
  const isHighlighted = !hasHoverFocus || highlightedIds.has(node.resource.uniqueId);
  const { x, y } = getEffectivePos(node.resource.uniqueId, node.x, node.y);
  const badgeY = displayMode === 'summary' ? y + nodeHeight - 20 : y + nodeHeight - 23;
  const badgeHeight = displayMode === 'summary' ? 15 : 17;
  const badgeRadius = badgeHeight / 2;
  const runTone = node.resource.statusTone ?? 'neutral';
  const toneOutlineClass = ` dependency-graph__node--tone-${runTone}`;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={nodeWidth}
        height={nodeHeight}
        rx={nodeRadius}
        className={`dependency-graph__node${node.side === 'selected' ? ' dependency-graph__node--selected' : ''}${isHighlighted ? '' : ' dependency-graph__node--dimmed'}${toneOutlineClass}`}
        {...(node.side === 'selected'
          ? {
              stroke: 'var(--graph-node-selected-stroke)',
              strokeWidth: 3,
            }
          : {})}
        style={{
          fill: getLensNodeFill(node.resource, lensMode),
        }}
      />
      <foreignObject
        x={x + 16}
        y={displayMode === 'summary' ? y + 10 : y + 14}
        width={nodeWidth - 32}
        height={24}
      >
        <div
          className="dependency-graph__node-title-row"
          title={`${node.resource.name} (${formatResourceTypeLabel(node.resource.resourceType)})`}
        >
          <span
            className="dependency-graph__node-title-icon"
            title={formatResourceTypeLabel(node.resource.resourceType)}
          >
            <ResourceTypeIcon resourceType={node.resource.resourceType} />
          </span>
          <span className="dependency-graph__node-title-text">{node.resource.name}</span>
        </div>
      </foreignObject>
      {supportsTests(node.resource.resourceType) ? (
        <LineageGraphNodeTestPills
          node={node}
          x={x}
          badgeY={badgeY}
          badgeHeight={badgeHeight}
          badgeRadius={badgeRadius}
          displayMode={displayMode}
        />
      ) : null}
    </g>
  );
}

/** SVG edges + node shapes (no HTML hotspot layer). */
export function LineageGraphSvgBody({
  visibleEdges,
  visibleNodeLayouts,
  getEffectivePos,
  nodeWidth,
  nodeHeight,
  nodeRadius,
  displayMode,
  lensMode,
  highlightedIds,
  hasHoverFocus,
}: {
  visibleEdges: Array<{ from: string; to: string }>;
  visibleNodeLayouts: Map<string, LineageGraphNodeLayout>;
  getEffectivePos: (nodeId: string, baseX: number, baseY: number) => { x: number; y: number };
  nodeWidth: number;
  nodeHeight: number;
  nodeRadius: number;
  displayMode: LineageDisplayMode;
  lensMode: LensMode;
  highlightedIds: Set<string>;
  hasHoverFocus: boolean;
}) {
  return (
    <>
      {visibleEdges.map((edge) => {
        const from = visibleNodeLayouts.get(edge.from);
        const to = visibleNodeLayouts.get(edge.to);
        if (!from || !to) return null;
        const fp = getEffectivePos(edge.from, from.x, from.y);
        const tp = getEffectivePos(edge.to, to.x, to.y);
        const startX = fp.x + nodeWidth;
        const startY = fp.y + nodeHeight / 2;
        const endX = tp.x;
        const endY = tp.y + nodeHeight / 2;
        const curve = Math.max(28, Math.abs(endX - startX) * 0.34);
        return (
          <path
            key={`${edge.from}->${edge.to}`}
            d={`M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`}
            className={`dependency-graph__edge${!hasHoverFocus || highlightedIds.has(edge.from) || highlightedIds.has(edge.to) ? '' : ' dependency-graph__edge--dimmed'}`}
          />
        );
      })}
      {Array.from(visibleNodeLayouts.values()).map((node) => (
        <LineageGraphSvgNode
          key={node.resource.uniqueId}
          node={node}
          getEffectivePos={getEffectivePos}
          nodeWidth={nodeWidth}
          nodeHeight={nodeHeight}
          nodeRadius={nodeRadius}
          displayMode={displayMode}
          lensMode={lensMode}
          highlightedIds={highlightedIds}
          hasHoverFocus={hasHoverFocus}
        />
      ))}
    </>
  );
}
