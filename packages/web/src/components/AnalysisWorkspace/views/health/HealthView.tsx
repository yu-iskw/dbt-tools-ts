import { useMemo } from 'react';

import { TEST_RESOURCE_TYPES } from '@web/lib/analysis-workspace/constants';
import { buildOverviewDerivedState } from '@web/lib/analysis-workspace/overview-state';

import { EmptyState } from '../../../EmptyState';
import { InvocationResourceStats } from '../../InvocationResourceStatsTable';
import { GraphCompositionCard } from '../overview/GraphCompositionCard';
import {
  OverviewActionListCard,
  OverviewCoverageCard,
  OverviewCriticalPathCard,
} from '../overview/OverviewCards';
import { StatusDonutWithData } from '../overview/OverviewDonuts';
import {
  HealthFootprintPanel,
  HealthThreadDistribution,
} from '../overview/OverviewExecutionContextBand';

import { HealthExecutionStatusPills } from './overview/HealthExecutionStatusPills';
import { HealthMaterializationCard } from './overview/HealthMaterializationCard';
import { HealthMetricRow } from './overview/HealthMetricRow';
import { HealthPostureBlock } from './overview/HealthPostureBlock';

import type { OverviewFilterState, WorkspaceSignal } from '@web/lib/analysis-workspace/types';
import type { WorkspaceArtifactSource } from '@web/services/artifact-source-api';
import type { AnalysisState } from '@web/types';
import type { ReactElement, Dispatch, SetStateAction } from 'react';

/**
 * Health — "what needs attention now?" with an above-the-fold triage strip
 * (posture, metrics, bottlenecks) and scrollable detail below.
 * Execution breakdown uses dashboard status pills only (no search/types slice).
 */
export function HealthView({
  analysis,
  projectName,
  analysisSource,
  filters,
  setFilters,
  workspaceSignals,
}: {
  analysis: AnalysisState;
  projectName: string | null;
  analysisSource: WorkspaceArtifactSource | null;
  filters: OverviewFilterState;
  setFilters: Dispatch<SetStateAction<OverviewFilterState>>;
  workspaceSignals: WorkspaceSignal[];
}): ReactElement {
  const healthExecutionFilters = useMemo(
    () => ({
      status: filters.status,
      query: '',
      resourceTypes: new Set<string>(),
    }),
    [filters.status],
  );
  const derived = useMemo(
    () => buildOverviewDerivedState(analysis, healthExecutionFilters),
    [analysis, healthExecutionFilters],
  );
  const filtered = filters.status !== 'all';
  const workerThreadCount = derived.threadCount || derived.filteredThreadStats.length;
  const modelsCount = derived.filteredExecutions.filter(
    (row) => row.resourceType === 'model',
  ).length;
  const testsCount = derived.filteredExecutions.filter((row) =>
    TEST_RESOURCE_TYPES.has(row.resourceType),
  ).length;

  return (
    <div className="workspace-view health-view">
      <div className="lens-header">
        <div className="lens-header__title">
          <p className="eyebrow">Workspace lens</p>
          <h2>Health</h2>
          <p className="lens-header__desc">
            Run posture, critical issues, and dependency pressure at a glance.
          </p>
        </div>
        {filtered && <span className="lens-header__badge">Filtered view</span>}
      </div>

      <div className="health-fold">
        <HealthPostureBlock
          analysis={analysis}
          projectName={projectName}
          analysisSource={analysisSource}
          derived={derived}
          filtered={filtered}
          workspaceSignals={workspaceSignals}
        />
        <HealthMetricRow analysis={analysis} projectName={projectName} />
        <section className="health-fold__bottlenecks" aria-label="Bottlenecks">
          <OverviewActionListCard derived={derived} />
        </section>
      </div>

      <div className="health-detail">
        <section className="health-section health-detail__execution">
          <div className="health-section__header health-section__header--with-inline-controls">
            <div className="health-section__header-text">
              <h3>Execution breakdown</h3>
              <p>
                {derived.filteredExecutions.length.toLocaleString()} runs. Status mix by resource
                type.
              </p>
            </div>
            <HealthExecutionStatusPills filters={filters} setFilters={setFilters} />
          </div>
          {derived.filteredExecutions.length > 0 ? (
            <StatusDonutWithData
              executions={derived.filteredExecutions}
              executionsForShareDenominator={derived.baselineExecutionsForBreakdown}
            />
          ) : (
            <EmptyState
              icon="◌"
              headline="No matching executions"
              subtext="Set status to All to include every run, or pick another status filter."
            />
          )}
        </section>

        <section className="health-section health-detail__context">
          <div className="health-section__header">
            <h3>Execution context</h3>
            <p>Worker pressure, footprint, and critical path.</p>
          </div>
          <div className="health-detail__grid">
            <HealthThreadDistribution derived={derived} />
            <div className="health-detail__stack">
              <OverviewCriticalPathCard analysis={analysis} filtered={filtered} />
              <HealthFootprintPanel
                derived={derived}
                analysis={analysis}
                workerThreadCount={workerThreadCount}
                modelsCount={modelsCount}
                testsCount={testsCount}
              />
            </div>
          </div>
        </section>

        <section className="health-section health-detail__structure">
          <div className="health-section__header">
            <h3>Structural health</h3>
            <p>Coverage and graph shape across the workspace.</p>
          </div>
          <div className="health-detail__grid">
            <OverviewCoverageCard analysis={analysis} filtered={filtered} />
            <div className="health-structure-composition">
              <HealthMaterializationCard executions={derived.filteredExecutions} />
              <div className="overview-module__header">
                <h3>Graph composition</h3>
                <p>Node type breakdown in the manifest graph.</p>
              </div>
              <GraphCompositionCard graphSummary={analysis.graphSummary} />
            </div>
          </div>
        </section>

        <details className="health-detail__resource-stats">
          <summary className="health-detail__resource-stats-summary">
            Invocation resource counts
          </summary>
          <InvocationResourceStats analysis={analysis} />
        </details>
      </div>
    </div>
  );
}
