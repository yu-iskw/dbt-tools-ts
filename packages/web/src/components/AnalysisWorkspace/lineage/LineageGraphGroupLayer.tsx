import type { LineageGroupRect } from '@web/lib/analysis-workspace/lineage-group-layout';
import type { ReactElement } from 'react';

function groupCaption(rect: LineageGroupRect): string {
  return rect.kind === 'lane' ? rect.label : `${rect.levelLabel}: ${rect.label}`;
}

/** Warehouse container boxes (outer, inner, lane) drawn behind edges and nodes. */
export function LineageGraphGroupLayer({
  groupRects,
  collapsedGroupIds,
  toggleableGroupIds,
}: {
  groupRects: LineageGroupRect[];
  collapsedGroupIds: ReadonlySet<string>;
  /** Containers that show a chevron; the hotspot layer carries the matching toggle button. */
  toggleableGroupIds: ReadonlySet<string>;
}): ReactElement {
  return (
    <>
      {groupRects.map((rect) => (
        <g key={`${rect.kind}:${rect.groupId}`}>
          <rect
            x={rect.x}
            y={rect.y}
            width={rect.width}
            height={rect.height}
            rx={rect.kind === 'outer' ? 18 : 12}
            className={`lineage-group lineage-group--${rect.kind}`}
          />
          <text x={rect.x + 14} y={rect.y + 20} className="lineage-group__label">
            {groupCaption(rect)}
          </text>
          {toggleableGroupIds.has(rect.groupId) ? (
            <text
              x={rect.x + rect.width - 18}
              y={rect.y + 20}
              textAnchor="middle"
              className="lineage-group__chevron"
            >
              {collapsedGroupIds.has(rect.groupId) ? '▸' : '▾'}
            </text>
          ) : null}
        </g>
      ))}
    </>
  );
}
