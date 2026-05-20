import {
  buildInvocationResourceComparison,
  type InvocationResourceComparisonRow,
} from '@web/lib/analysis-workspace/invocation-resource-stats';
import { deriveProjectName, formatResourceTypeLabel } from '@web/lib/analysis-workspace/utils';
import { useMemo, type ReactElement } from 'react';

import type { AnalysisState } from '@web/types';

export function InvocationResourceStatsTable({
  rows,
}: {
  rows: InvocationResourceComparisonRow[];
}): ReactElement | null {
  if (rows.length === 0) return null;

  return (
    <div
      className="invocation-resource-stats"
      role="region"
      aria-label="Invocation resource counts by type"
    >
      <p className="invocation-resource-stats__title">
        Resource counts (manifest graph vs this run vs timeline rows)
      </p>
      <table className="invocation-resource-stats__table">
        <thead>
          <tr>
            <th scope="col">Type</th>
            <th scope="col" className="invocation-resource-stats__num">
              Manifest graph
            </th>
            <th scope="col" className="invocation-resource-stats__num">
              This run
            </th>
            <th scope="col" className="invocation-resource-stats__num">
              Timeline
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.resourceType}>
              <th scope="row">{formatResourceTypeLabel(row.resourceType)}</th>
              <td className="invocation-resource-stats__num">{row.graphCount.toLocaleString()}</td>
              <td className="invocation-resource-stats__num">{row.runCount.toLocaleString()}</td>
              <td className="invocation-resource-stats__num">
                {row.timelineCount.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="invocation-resource-stats__note">
        When a project package is in scope, manifest graph counts match that package (same scope as
        this run and timeline). Synthetic source rows are described in ADR-0006 (
        <code>docs/adr/0006-timeline-includes-dbt-sources-via-snapshot-synthesis.md</code>
        ).
      </p>
    </div>
  );
}

/** Shared invocation vs manifest vs timeline table; use on Health and Timeline. */
export function InvocationResourceStats({ analysis }: { analysis: AnalysisState }): ReactElement {
  const projectName = analysis.projectName ?? deriveProjectName(analysis.executions);

  const rows = useMemo(
    () => buildInvocationResourceComparison(analysis, projectName),
    [analysis, projectName],
  );

  return <InvocationResourceStatsTable rows={rows} />;
}
