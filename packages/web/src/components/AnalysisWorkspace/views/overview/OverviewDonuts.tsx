import { useId, useMemo } from 'react';

import { useSyncedDocumentTheme } from '@web/hooks/use-theme';
import { getStatusTonePalette } from '@web/lib/analysis-workspace/constants';
import {
  EXECUTION_TYPE_BAR_LABEL_INSIDE_MIN_SHARE,
  formatExecutionTypeSegmentPercent,
  shouldPlaceExecutionSegmentLabelInsideBar,
  sortStatusBreakdownByCountDesc,
} from '@web/lib/analysis-workspace/execution-type-bar-labels';
import {
  buildTypeStatusBreakdowns,
  type TypeStatusBreakdown,
} from '@web/lib/analysis-workspace/overview-state';

import { formatResourceTypeLabel } from '../../shared';

import type { ExecutionRow, StatusTone } from '@web/types';
import type { ReactElement } from 'react';

function TypeStatusBarRow({
  group,
  statusColors,
}: {
  group: TypeStatusBreakdown;
  statusColors: Record<StatusTone, string>;
}) {
  const labelId = useId();
  const entries = group.statusBreakdown.filter((e) => e.count > 0);
  const breakdownEntries = entries.length > 0 ? sortStatusBreakdownByCountDesc(entries) : [];
  const typeLabel = formatResourceTypeLabel(group.resourceType);

  return (
    <div className="exec-type-bar-row">
      <div className="exec-type-bar-row__label" id={labelId} title={typeLabel}>
        {typeLabel}
      </div>
      <div className="exec-type-bar-row__bars">
        <div className="exec-type-bar-track" role="group" aria-labelledby={labelId}>
          {entries.map((entry) => {
            const inside = shouldPlaceExecutionSegmentLabelInsideBar(entry.share);
            const pctLabel = formatExecutionTypeSegmentPercent(entry.share);
            const detail = `${entry.status}: ${entry.count} runs (${pctLabel}) of ${group.rowDenominatorCount}`;
            const isMinor = entry.share < EXECUTION_TYPE_BAR_LABEL_INSIDE_MIN_SHARE;
            return (
              <div
                key={`${group.resourceType}-${entry.status}`}
                className={
                  isMinor
                    ? 'exec-type-bar-segment exec-type-bar-segment--minor'
                    : 'exec-type-bar-segment'
                }
                style={{
                  flex: `${entry.count} 1 0%`,
                  backgroundColor: statusColors[entry.tone],
                }}
                title={detail}
                aria-label={detail}
              >
                {inside ? (
                  <span className="exec-type-bar-segment__inner">
                    {pctLabel} ({entry.count})
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
        {entries.length > 0 ? (
          <ul className="exec-type-bar-row__breakdown" aria-label={`${typeLabel} status breakdown`}>
            {breakdownEntries.map((entry) => {
              const pctLabel = formatExecutionTypeSegmentPercent(entry.share);
              return (
                <li
                  key={`${group.resourceType}-${entry.status}-breakdown`}
                  className="exec-type-bar-row__breakdown-item"
                >
                  <span
                    className="legend-row__swatch"
                    style={{ background: statusColors[entry.tone] }}
                    aria-hidden
                  />
                  <span className="exec-type-bar-row__breakdown-label">{entry.status}</span>
                  <span className="exec-type-bar-row__breakdown-metric">
                    {entry.count} · {pctLabel}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function TypeStatusBarStack({
  executions,
  executionsForShareDenominator,
}: {
  executions: ExecutionRow[];
  executionsForShareDenominator: ExecutionRow[];
}) {
  const theme = useSyncedDocumentTheme();
  const statusColors = useMemo(() => getStatusTonePalette(theme), [theme]);
  const groups = useMemo(
    () => buildTypeStatusBreakdowns(executions, executionsForShareDenominator),
    [executions, executionsForShareDenominator],
  );

  if (groups.length === 0) {
    return <div className="empty-state">No execution data.</div>;
  }

  return (
    <div className="exec-type-bar-stack" data-testid="exec-type-bar-stack">
      {groups.map((group) => (
        <TypeStatusBarRow key={group.resourceType} group={group} statusColors={statusColors} />
      ))}
    </div>
  );
}

/** Execution breakdown by resource type: stacked status bars with per-row legend. */
export function StatusDonutWithData({
  executions,
  executionsForShareDenominator,
}: {
  executions: ExecutionRow[];
  executionsForShareDenominator: ExecutionRow[];
}): ReactElement {
  return (
    <TypeStatusBarStack
      executions={executions}
      executionsForShareDenominator={executionsForShareDenominator}
    />
  );
}
