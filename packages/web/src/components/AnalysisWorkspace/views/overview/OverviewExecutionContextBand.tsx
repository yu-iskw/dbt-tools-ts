import { PILL_ACTIVE, PILL_BASE } from '@web/lib/analysis-workspace/constants';
import {
  THREAD_DISTRIBUTION_METRIC_OPTIONS,
  capSortedThreadStats,
  formatThreadDistributionMetricValue,
  getThreadStatMetricValue,
  maxThreadStatMetricValue,
  sortThreadStatsByMetric,
  type ThreadDistributionMetric,
} from '@web/lib/analysis-workspace/thread-distribution-metrics';
import { formatSeconds } from '@web/lib/analysis-workspace/utils';
import { useMemo, useState } from 'react';

import { EmptyState } from '../../../EmptyState';

import type { OverviewDerivedState } from '@web/lib/analysis-workspace/overview-state';
import type { AnalysisState, ThreadStat } from '@web/types';
import type { ReactElement } from 'react';

function threadDistributionRowDetail(
  entry: ThreadStat,
  metric: ThreadDistributionMetric,
  sharePct: number,
): string {
  const valueText = formatThreadDistributionMetricValue(entry, metric);
  if (metric === 'resources') {
    return `${entry.threadId}: ${valueText} runs (${sharePct}% of slice)`;
  }
  if (metric === 'avgTime') {
    return `${entry.threadId}: ${valueText} (${entry.count.toLocaleString()} runs)`;
  }
  return `${entry.threadId}: ${valueText}`;
}

export function HealthThreadDistribution({
  derived,
}: {
  derived: OverviewDerivedState;
}): ReactElement {
  const [metric, setMetric] = useState<ThreadDistributionMetric>('totalTime');

  const executionRowTotal = useMemo(
    () => derived.filteredThreadStats.reduce((sum, s) => sum + s.count, 0),
    [derived.filteredThreadStats],
  );

  const { displayRows, maxVal, isTruncated, totalLanes } = useMemo(() => {
    const sorted = sortThreadStatsByMetric(derived.filteredThreadStats, metric);
    const { rows, totalLanes, isTruncated: truncated } = capSortedThreadStats(sorted);
    return {
      displayRows: rows,
      maxVal: maxThreadStatMetricValue(rows, metric),
      isTruncated: truncated,
      totalLanes,
    };
  }, [derived.filteredThreadStats, metric]);

  return (
    <section className="overview-module overview-module--threads">
      <div className="overview-module__header">
        <h3>Thread distribution</h3>
        <p>
          {isTruncated
            ? `Top ${displayRows.length} of ${totalLanes.toLocaleString()} worker lanes by selected metric.`
            : 'Worker lanes in the current execution slice.'}
        </p>
      </div>
      {derived.filteredThreadStats.length > 0 ? (
        <>
          <div
            className="thread-dist-metric-pills pill-row"
            role="radiogroup"
            aria-label="Thread distribution metric"
          >
            {THREAD_DISTRIBUTION_METRIC_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={metric === opt.value}
                aria-label={`${opt.label}, thread distribution metric`}
                className={metric === opt.value ? PILL_ACTIVE : PILL_BASE}
                onClick={() => setMetric(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <ul className="thread-dist-list" aria-label="Worker lanes by metric">
            {displayRows.map((entry) => {
              const value = getThreadStatMetricValue(entry, metric);
              const barPct = maxVal > 0 ? Math.min(100, (value / maxVal) * 100) : 0;
              const sharePct =
                executionRowTotal > 0
                  ? Math.round((entry.count / executionRowTotal) * 1000) / 10
                  : 0;
              const detail = threadDistributionRowDetail(entry, metric, sharePct);
              const ariaLabel = `${entry.threadId}, ${detail}`;
              return (
                <li key={entry.threadId} className="thread-dist-row" aria-label={ariaLabel}>
                  <div className="thread-dist-row__label" title={entry.threadId}>
                    {entry.threadId}
                  </div>
                  <div className="thread-dist-row__track-wrap">
                    <div className="thread-dist-row__track" title={detail} role="presentation">
                      <div className="thread-dist-row__fill" style={{ width: `${barPct}%` }} />
                    </div>
                  </div>
                  <div className="thread-dist-row__value">
                    {formatThreadDistributionMetricValue(entry, metric)}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <EmptyState
          icon="⋯"
          headline="No thread data in slice"
          subtext="No matching executions were found for the current dashboard filters."
        />
      )}
    </section>
  );
}

export function HealthFootprintPanel({
  derived,
  analysis,
  workerThreadCount,
  modelsCount,
  testsCount,
}: {
  derived: OverviewDerivedState;
  analysis: AnalysisState;
  workerThreadCount: number;
  modelsCount: number;
  testsCount: number;
}): ReactElement {
  const criticalPathLength = analysis.summary.critical_path?.path.length ?? 0;

  return (
    <section className="overview-module overview-module--footprint">
      <div className="overview-module__header">
        <h3>Footprint</h3>
        <p>Filtered execution volume, duration, and worker scale.</p>
      </div>
      <div className="footprint-card">
        <div className="footprint-card__stats">
          <div className="footprint-card__stat">
            <span>Executed</span>
            <strong>{derived.filteredExecutions.length}</strong>
          </div>
          <div className="footprint-card__stat">
            <span>Runtime</span>
            <strong>{formatSeconds(derived.filteredExecutionTime)}</strong>
          </div>
          <div className="footprint-card__stat">
            <span>Worker lanes</span>
            <strong>{workerThreadCount}</strong>
          </div>
          <div className="footprint-card__stat">
            <span>Models</span>
            <strong>{modelsCount}</strong>
          </div>
          <div className="footprint-card__stat">
            <span>Tests</span>
            <strong>{testsCount}</strong>
          </div>
        </div>
        <p className="footprint-card__detail">
          Graph totals remain workspace-wide: {analysis.graphSummary.totalNodes} nodes,{' '}
          {analysis.graphSummary.totalEdges} edges, {criticalPathLength} critical-path nodes.
        </p>
      </div>
    </section>
  );
}
