import type { AnalysisState } from '@web/types';
import type { OverviewDerivedState } from '@web/lib/analysis-workspace/overviewState';
import { formatSeconds } from '@web/lib/analysis-workspace/utils';
import { EmptyState } from '../../../EmptyState';
import { OverviewScopeBadge } from './OverviewPanel';

export function OverviewActionListCard({
  derived,
  title = 'Bottlenecks',
  subtitle = 'Longest-running nodes in the filtered execution slice.',
  embedded = false,
}: {
  derived: OverviewDerivedState;
  title?: string;
  subtitle?: string;
  embedded?: boolean;
}) {
  const topRows = derived.topBottlenecks;

  return (
    <section
      className={`overview-module overview-module--bottlenecks${embedded ? ' overview-module--embedded' : ''}`}
    >
      {!embedded && (
        <div className="overview-module__header">
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      )}
      {topRows.length > 0 ? (
        <div className="action-list">
          {topRows.map((row, index) => (
            <div key={row.uniqueId} className="action-list__row">
              <div className="action-list__body">
                <strong>{`${index + 1}. ${row.name}`}</strong>
                <span>
                  {`${(
                    (row.executionTime / Math.max(derived.filteredExecutionTime, 0.0001)) *
                    100
                  ).toFixed(1)}% of filtered run`}
                </span>
              </div>
              <div className="action-list__metric">
                <strong>{formatSeconds(row.executionTime)}</strong>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="⚡"
          headline="No matching bottlenecks"
          subtext="No executions match the current dashboard filters."
        />
      )}
    </section>
  );
}

export function OverviewCriticalPathCard({
  analysis,
  filtered,
}: {
  analysis: AnalysisState;
  filtered: boolean;
}) {
  const criticalPathLength = analysis.summary.critical_path?.path.length ?? 0;

  return (
    <section className="overview-module overview-module--critical">
      <div className="overview-module__header">
        <div>
          <h3>Critical path</h3>
          <p>Dependency pressure and scheduling risk.</p>
        </div>
        {filtered && <OverviewScopeBadge label="Workspace-wide" />}
      </div>
      <div className="critical-path-card">
        <div className="critical-path-card__headline">
          <strong>{criticalPathLength} nodes</strong>
          <span>
            {analysis.graphSummary.hasCycles
              ? 'Cycles detected in the dependency graph.'
              : 'No cycles detected in the dependency graph.'}
          </span>
        </div>
        <div className="critical-path-card__detail">
          <span>Graph edges</span>
          <strong>{analysis.graphSummary.totalEdges}</strong>
        </div>
      </div>
    </section>
  );
}

export function OverviewCoverageCard({
  analysis,
  filtered,
}: {
  analysis: AnalysisState;
  filtered: boolean;
}) {
  const documentedResources = analysis.resources.filter((resource) =>
    Boolean(resource.description?.trim()),
  ).length;
  const documentationCoverage =
    analysis.resources.length > 0
      ? Math.round((documentedResources / analysis.resources.length) * 100)
      : 0;
  const undocumentedResources = Math.max(analysis.resources.length - documentedResources, 0);
  const modelResources = analysis.resources.filter(
    (resource) => resource.resourceType === 'model',
  ).length;

  return (
    <section className="overview-module overview-module--coverage">
      <div className="overview-module__header">
        <div>
          <h3>Coverage</h3>
          <p>Structural health of metadata and discovery quality.</p>
        </div>
        {filtered && <OverviewScopeBadge label="Workspace-wide" />}
      </div>
      <div className="coverage-card">
        <div className="coverage-card__headline">
          <strong>{documentationCoverage}%</strong>
          <span>Metadata coverage</span>
        </div>
        <div className="coverage-card__stats">
          <div>
            <span>Documented</span>
            <strong>
              {documentedResources} / {analysis.resources.length}
            </strong>
          </div>
          <div>
            <span>Missing descriptions</span>
            <strong>{undocumentedResources}</strong>
          </div>
        </div>
        <p>
          {modelResources > 0
            ? 'Next improvement: document core models first to improve catalog-style discovery.'
            : 'Add descriptions to core resources to improve catalog-style discovery.'}
        </p>
      </div>
    </section>
  );
}
