import { deriveProjectName } from '@web/lib/analysis-workspace/utils';

import { TimelineView } from './timeline/TimelineView';
import { useAnalysisWorkspaceExplorerPane } from './use-analysis-workspace-explorer-pane';
import { HealthView } from './views/health/HealthView';
import { InventoryView } from './views/inventory/InventoryView';
import { RunsView } from './views/runs/RunsView';

import type { AnalysisWorkspaceProps } from '@web/lib/analysis-workspace/types';
import type { ReactElement } from 'react';

export function AnalysisWorkspace({
  analysis,
  activeView,
  analysisSource,
  overviewFilters,
  onOverviewFiltersChange,
  timelineFilters,
  onTimelineFiltersChange,
  assetViewState,
  onAssetViewStateChange,
  runsViewState,
  onRunsViewStateChange,
  lineageViewState,
  onLineageViewStateChange,
  onInvestigationSelectionChange,
  onNavigateTo,
  workspaceSignals,
}: AnalysisWorkspaceProps): ReactElement {
  const projectName = analysis.projectName ?? deriveProjectName(analysis.executions);

  const { explorerPane } = useAnalysisWorkspaceExplorerPane({
    analysis,
    projectName,
    activeView,
    assetViewState,
    onAssetViewStateChange,
    onInvestigationSelectionChange,
  });

  const selectedResourceId = assetViewState.selectedResourceId;
  const selectedResource =
    analysis.resources.find((resource) => resource.uniqueId === selectedResourceId) ?? null;

  return (
    <div className={`workspace-layout${explorerPane ? '' : ' workspace-layout--full'}`}>
      {explorerPane}
      <div className="workspace-main-panel">
        {activeView === 'health' && (
          <HealthView
            analysis={analysis}
            projectName={projectName}
            analysisSource={analysisSource}
            filters={overviewFilters}
            setFilters={onOverviewFiltersChange}
            workspaceSignals={workspaceSignals}
          />
        )}
        {activeView === 'inventory' && (
          <InventoryView
            analysis={analysis}
            resource={selectedResource}
            onSelectResource={(id) =>
              onAssetViewStateChange((current) => ({
                ...current,
                selectedResourceId: id,
              }))
            }
            assetViewState={{
              ...assetViewState,
              selectedResourceId,
            }}
            onAssetViewStateChange={onAssetViewStateChange}
            lineageViewState={lineageViewState}
            onLineageViewStateChange={onLineageViewStateChange}
            onInvestigationSelectionChange={onInvestigationSelectionChange}
            onNavigateTo={onNavigateTo}
          />
        )}
        {activeView === 'runs' && (
          <RunsView
            analysis={analysis}
            runsViewState={runsViewState}
            onRunsViewStateChange={onRunsViewStateChange}
            onInvestigationSelectionChange={onInvestigationSelectionChange}
            onNavigateTo={onNavigateTo}
          />
        )}
        {activeView === 'timeline' && (
          <TimelineView
            analysis={analysis}
            filters={timelineFilters}
            setFilters={onTimelineFiltersChange}
            onInvestigationSelectionChange={onInvestigationSelectionChange}
          />
        )}
      </div>
    </div>
  );
}
