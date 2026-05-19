import type { GraphSnapshot } from '@web/types';
import type { ReactElement } from 'react';

export function GraphCompositionCard({
  graphSummary,
}: {
  graphSummary: GraphSnapshot;
}): ReactElement {
  const entries = Object.entries(graphSummary.nodesByType).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    return <div className="empty-state">No node-type breakdown available.</div>;
  }
  return (
    <div className="rank-list">
      {entries.map(([type, count]) => (
        <div key={type} className="rank-list__row">
          <div className="rank-list__body">
            <strong>{type}</strong>
          </div>
          <div className="rank-list__metric">
            <strong>{count}</strong>
            <span>
              {graphSummary.totalNodes > 0
                ? `${((count / graphSummary.totalNodes) * 100).toFixed(0)}% of graph`
                : ''}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
