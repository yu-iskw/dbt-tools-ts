import { type Dispatch, type SetStateAction, useEffect, useMemo } from 'react';
import type { AnalysisState } from '@web/types';
import type { InvestigationSelectionState, RunsViewState } from '@web/lib/analysis-workspace/types';
import { useRunsResultsSource } from '@web/hooks/useRunsResultsSource';
import {
  getRunsAdapterColumnLayout,
  isRunsAdapterSortBy,
} from '@web/lib/analysis-workspace/runsAdapterColumns';
import { WorkspaceScaffold } from '../../shared';
import { RunsAdapterInspector } from './RunsViewAdapterInspector';
import { RunsResultsTable } from './RunsViewResultsTable';
import { RunsToolbar } from './RunsViewToolbar';
import { collectMaterializationKindsFromSemantics } from '@web/lib/analysis-workspace/materializationSemanticsUi';

export function RunsView({
  analysis,
  runsViewState,
  onRunsViewStateChange,
  onInvestigationSelectionChange,
  onNavigateTo,
}: {
  analysis: AnalysisState;
  runsViewState: RunsViewState;
  onRunsViewStateChange: Dispatch<SetStateAction<RunsViewState>>;
  onInvestigationSelectionChange: Dispatch<SetStateAction<InvestigationSelectionState>>;
  onNavigateTo: (
    view: 'inventory' | 'timeline',
    options?: {
      resourceId?: string;
      executionId?: string;
      assetTab?: 'summary' | 'lineage';
      rootResourceId?: string;
    },
  ) => void;
}) {
  const adapterColumnLayout = useMemo(
    () => getRunsAdapterColumnLayout(analysis.executions),
    [analysis.executions],
  );
  const adapterMetricsAvailable = adapterColumnLayout.allColumns.length > 0;
  const visibleAdapterColumns = useMemo(
    () =>
      runsViewState.showAdapterMetrics && adapterMetricsAvailable
        ? adapterColumnLayout.visibleColumns
        : [],
    [adapterColumnLayout.visibleColumns, adapterMetricsAvailable, runsViewState.showAdapterMetrics],
  );
  const availableMaterializationKinds = useMemo(
    () => collectMaterializationKindsFromSemantics(analysis.executions.map((e) => e.semantics)),
    [analysis.executions],
  );

  const overflowAdapterColumns = useMemo(
    () =>
      runsViewState.showAdapterMetrics && adapterMetricsAvailable
        ? adapterColumnLayout.overflowColumns
        : [],
    [
      adapterColumnLayout.overflowColumns,
      adapterMetricsAvailable,
      runsViewState.showAdapterMetrics,
    ],
  );

  useEffect(() => {
    const sortBy = runsViewState.sortBy;
    if (
      isRunsAdapterSortBy(sortBy) &&
      !visibleAdapterColumns.some((column) => column.id === sortBy && column.isScalar)
    ) {
      onRunsViewStateChange((current) => ({
        ...current,
        sortBy: 'attention',
        sortDirection: 'desc',
      }));
    }
  }, [onRunsViewStateChange, runsViewState.sortBy, visibleAdapterColumns]);

  useEffect(() => {
    if (!adapterMetricsAvailable && runsViewState.showAdapterMetrics) {
      onRunsViewStateChange((current) => ({
        ...current,
        showAdapterMetrics: false,
      }));
    }
  }, [adapterMetricsAvailable, onRunsViewStateChange, runsViewState.showAdapterMetrics]);

  const runsResults = useRunsResultsSource(analysis.executions, runsViewState, true);
  const selectedRow =
    analysis.executions.find((row) => row.uniqueId === runsViewState.selectedExecutionId) ?? null;

  return (
    <WorkspaceScaffold
      title="Runs"
      description="Execution and quality evidence across models, tests, seeds, snapshots, and operations."
      toolbar={
        <RunsToolbar
          runsViewState={runsViewState}
          runsResults={runsResults}
          adapterColumnLayout={adapterColumnLayout}
          adapterMetricsAvailable={adapterMetricsAvailable}
          availableMaterializationKinds={availableMaterializationKinds}
          onRunsViewStateChange={onRunsViewStateChange}
        />
      }
      inspector={
        selectedRow ? (
          <RunsAdapterInspector
            row={selectedRow}
            visibleColumns={visibleAdapterColumns}
            overflowColumns={overflowAdapterColumns}
            onNavigateTo={onNavigateTo}
          />
        ) : null
      }
      className="runs-view"
    >
      <RunsResultsTable
        analysis={analysis}
        runsResults={runsResults}
        runsViewState={runsViewState}
        adapterColumns={visibleAdapterColumns}
        onRunsViewStateChange={onRunsViewStateChange}
        onInvestigationSelectionChange={onInvestigationSelectionChange}
      />
    </WorkspaceScaffold>
  );
}
