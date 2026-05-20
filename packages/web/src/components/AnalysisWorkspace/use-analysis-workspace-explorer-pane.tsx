import { useMemo } from 'react';

import {
  buildExplorerTree,
  buildResourceTestStats,
  collectBranchIds,
  collectLeafIds,
  flattenExplorerTree,
} from '@web/lib/analysis-workspace/explorer-tree';
import { collectMaterializationKindsFromSemantics } from '@web/lib/analysis-workspace/materialization-semantics-ui';
import {
  isMainProjectResource,
  matchesAssetMaterializationKind,
  matchesAssetResourceType,
  matchesAssetStatus,
  matchesResource,
} from '@web/lib/analysis-workspace/utils';

import { ExplorerPane } from './ExplorerPane';
import { useInventoryExplorerExpansion } from './use-inventory-explorer-expansion';

import type {
  AssetViewState,
  InvestigationSelectionState,
  WorkspaceView,
} from '@web/lib/analysis-workspace/types';
import type { AnalysisState } from '@web/types';
import type { Dispatch, ReactNode, SetStateAction } from 'react';

function usesExplorerPane(view: WorkspaceView): boolean {
  return view === 'inventory';
}

export function useAnalysisWorkspaceExplorerPane({
  analysis,
  projectName,
  activeView,
  assetViewState,
  onAssetViewStateChange,
  onInvestigationSelectionChange,
}: {
  analysis: AnalysisState;
  projectName: string | null;
  activeView: WorkspaceView;
  assetViewState: AssetViewState;
  onAssetViewStateChange: Dispatch<SetStateAction<AssetViewState>>;
  onInvestigationSelectionChange: Dispatch<SetStateAction<InvestigationSelectionState>>;
}): { explorerPane: ReactNode | null } {
  const scopedExplorerResources = useMemo(() => {
    if (assetViewState.explorerMode !== 'project' || projectName == null) {
      return analysis.resources;
    }
    return analysis.resources.filter((resource) => isMainProjectResource(resource, projectName));
  }, [analysis.resources, assetViewState.explorerMode, projectName]);

  const availableAssetResourceTypes = useMemo(
    () =>
      Array.from(new Set(scopedExplorerResources.map((resource) => resource.resourceType))).sort(),
    [scopedExplorerResources],
  );

  const availableMaterializationKinds = useMemo(
    () => collectMaterializationKindsFromSemantics(scopedExplorerResources.map((r) => r.semantics)),
    [scopedExplorerResources],
  );

  const resourceTestRollupById = useMemo(
    () => buildResourceTestStats(scopedExplorerResources, analysis.dependencyIndex),
    [analysis.dependencyIndex, scopedExplorerResources],
  );

  const explorerResources = useMemo(
    () =>
      scopedExplorerResources.filter(
        (resource) =>
          matchesAssetStatus(resource, assetViewState.status, resourceTestRollupById) &&
          matchesAssetResourceType(resource, assetViewState.resourceTypes) &&
          matchesAssetMaterializationKind(resource, assetViewState.materializationKinds) &&
          matchesResource(resource, assetViewState.resourceQuery),
      ),
    [
      assetViewState.materializationKinds,
      assetViewState.resourceQuery,
      assetViewState.resourceTypes,
      assetViewState.status,
      resourceTestRollupById,
      scopedExplorerResources,
    ],
  );

  const explorerTree = useMemo(
    () =>
      buildExplorerTree(
        explorerResources,
        assetViewState.explorerMode,
        projectName,
        analysis.dependencyIndex,
      ),
    [analysis.dependencyIndex, assetViewState.explorerMode, explorerResources, projectName],
  );
  const allBranchIds = useMemo(() => collectBranchIds(explorerTree), [explorerTree]);

  const expandedNodeIds = useMemo(
    () => new Set([...assetViewState.expandedNodeIds].filter((id) => allBranchIds.has(id))),
    [allBranchIds, assetViewState.expandedNodeIds],
  );
  const treeRows = useMemo(
    () => flattenExplorerTree(explorerTree, expandedNodeIds),
    [expandedNodeIds, explorerTree],
  );
  const visibleLeafIds = useMemo(() => collectLeafIds(explorerTree), [explorerTree]);
  const selectedResourceId = assetViewState.selectedResourceId;

  useInventoryExplorerExpansion(
    explorerTree,
    allBranchIds,
    expandedNodeIds,
    projectName,
    assetViewState.explorerMode,
    selectedResourceId,
    onAssetViewStateChange,
  );

  const explorerPane = usesExplorerPane(activeView) ? (
    <ExplorerPane
      treeRows={treeRows}
      filteredResources={explorerResources}
      totalResources={scopedExplorerResources.length}
      matchedResources={visibleLeafIds.length}
      explorerMode={assetViewState.explorerMode}
      setExplorerMode={(value) =>
        onAssetViewStateChange((current) => ({
          ...current,
          explorerMode: value,
        }))
      }
      status={assetViewState.status}
      setStatus={(value) => onAssetViewStateChange((current) => ({ ...current, status: value }))}
      availableResourceTypes={availableAssetResourceTypes}
      activeResourceTypes={assetViewState.resourceTypes}
      toggleResourceType={(value) =>
        onAssetViewStateChange((current) => {
          const next = new Set(current.resourceTypes);
          if (next.has(value)) next.delete(value);
          else next.add(value);
          return { ...current, resourceTypes: next };
        })
      }
      availableMaterializationKinds={availableMaterializationKinds}
      activeMaterializationKinds={assetViewState.materializationKinds}
      toggleMaterializationKind={(value) =>
        onAssetViewStateChange((current) => {
          const next = new Set(current.materializationKinds);
          if (next.has(value)) next.delete(value);
          else next.add(value);
          return { ...current, materializationKinds: next };
        })
      }
      resourceQuery={assetViewState.resourceQuery}
      setResourceQuery={(value) =>
        onAssetViewStateChange((current) => ({
          ...current,
          resourceQuery: value,
        }))
      }
      selectedResourceId={selectedResourceId}
      expandedNodeIds={expandedNodeIds}
      toggleExpandedNode={(id) =>
        onAssetViewStateChange((current) => {
          const next = new Set(current.expandedNodeIds);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return { ...current, expandedNodeIds: next };
        })
      }
      setSelectedResourceId={(value) => {
        onAssetViewStateChange((current) => ({
          ...current,
          selectedResourceId: value,
        }));
        onInvestigationSelectionChange((current) => ({
          ...current,
          selectedResourceId: value,
          sourceLens: 'inventory',
        }));
      }}
    />
  ) : null;

  return { explorerPane };
}
