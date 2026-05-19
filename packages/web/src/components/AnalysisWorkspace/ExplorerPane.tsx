import { useState } from 'react';

import { EXPLORER_MODE_LABELS } from '@web/lib/analysis-workspace/constants';

import { buildExplorerTreeEmptySubtext, EXPLORER_UI_COPY } from './explorer-pane-copy';
import {
  EXPLORER_FILTERS_STORAGE_KEY,
  ExplorerPaneFilters,
  getInitialFiltersExpanded,
} from './ExplorerPaneFilters';
import { ExplorerTreeList } from './ExplorerPaneTree';
import { ExplorerModeIcon, ResourceTypeSummaryBar } from './ExplorerPaneWidgets';

import type { ExplorerPaneProps } from './explorer-pane-types';
import type { AssetExplorerMode } from '@web/lib/analysis-workspace/types';
import type { ReactElement } from 'react';

export type { ExplorerPaneProps } from './explorer-pane-types';
export {
  buildExplorerTreeEmptySubtext,
  EXPLORER_UI_COPY,
  executionStatusFilterButtonTitle,
  executionStatusPillLabel,
} from './explorer-pane-copy';
export { ExplorerTreeTestStatsGroup } from './ExplorerPaneTree';
export { ExplorerModeIcon, ResourceTypeSummaryBar } from './ExplorerPaneWidgets';

export function ExplorerPane({
  treeRows,
  filteredResources,
  totalResources,
  matchedResources,
  explorerMode,
  setExplorerMode,
  status,
  setStatus,
  availableResourceTypes,
  activeResourceTypes,
  toggleResourceType,
  availableMaterializationKinds,
  activeMaterializationKinds,
  toggleMaterializationKind,
  resourceQuery,
  setResourceQuery,
  selectedResourceId,
  expandedNodeIds,
  toggleExpandedNode,
  setSelectedResourceId,
}: ExplorerPaneProps): ReactElement {
  const [filtersExpanded, setFiltersExpanded] = useState<boolean>(getInitialFiltersExpanded);
  const setFiltersExpandedPersisted = (next: boolean) => {
    setFiltersExpanded(next);
    try {
      window.localStorage.setItem(EXPLORER_FILTERS_STORAGE_KEY, String(next));
    } catch {
      // ignore localStorage failures
    }
  };
  const activeFilterCount =
    (resourceQuery.trim() ? 1 : 0) +
    (status !== 'all' ? 1 : 0) +
    (activeResourceTypes.size > 0 ? 1 : 0) +
    (activeMaterializationKinds.size > 0 ? 1 : 0);
  const filterSummary =
    activeFilterCount > 0 ? `${activeFilterCount} active` : 'Search, status, and type';

  return (
    <aside className="explorer-pane">
      <div className="explorer-pane__header">
        <div>
          <p className="eyebrow">Asset explorer</p>
          <h2>Workspace inventory</h2>
        </div>
        <div className="explorer-pane__count">
          {matchedResources}
          {matchedResources !== totalResources && (
            <span className="explorer-pane__count-subtext">of {totalResources}</span>
          )}
        </div>
      </div>

      <div className="explorer-mode-tabs" role="tablist" aria-label="Explorer modes">
        {(['project', 'database'] as AssetExplorerMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={explorerMode === mode}
            className={
              explorerMode === mode
                ? 'explorer-mode-tab explorer-mode-tab--active'
                : 'explorer-mode-tab'
            }
            onClick={() => setExplorerMode(mode)}
          >
            <span className="explorer-mode-tab__icon" aria-hidden="true">
              <ExplorerModeIcon mode={mode} />
            </span>
            {EXPLORER_MODE_LABELS[mode]}
          </button>
        ))}
      </div>

      <ExplorerPaneFilters
        filtersExpanded={filtersExpanded}
        setFiltersExpandedPersisted={setFiltersExpandedPersisted}
        activeFilterCount={activeFilterCount}
        filterSummary={filterSummary}
        resourceQuery={resourceQuery}
        setResourceQuery={setResourceQuery}
        status={status}
        setStatus={setStatus}
        availableResourceTypes={availableResourceTypes}
        activeResourceTypes={activeResourceTypes}
        toggleResourceType={toggleResourceType}
        availableMaterializationKinds={availableMaterializationKinds}
        activeMaterializationKinds={activeMaterializationKinds}
        toggleMaterializationKind={toggleMaterializationKind}
      />

      <ResourceTypeSummaryBar resources={filteredResources} />

      <ExplorerTreeList
        treeRows={treeRows}
        explorerMode={explorerMode}
        expandedNodeIds={expandedNodeIds}
        toggleExpandedNode={toggleExpandedNode}
        selectedResourceId={selectedResourceId}
        setSelectedResourceId={setSelectedResourceId}
        treeEmptyDisplay={
          treeRows.length === 0
            ? {
                headline: EXPLORER_UI_COPY.treeEmptyHeadline,
                subtext: buildExplorerTreeEmptySubtext({
                  status,
                  resourceQuery,
                  activeResourceTypeCount: activeResourceTypes.size,
                  activeMaterializationKindCount: activeMaterializationKinds.size,
                }),
              }
            : undefined
        }
      />
    </aside>
  );
}
