import { useEffect } from 'react';

import {
  collectAncestorBranchIdsForResource,
  type ExplorerTreeNode,
  projectRootBranchId,
} from '@web/lib/analysis-workspace/explorer-tree';

import type { AssetViewState } from '@web/lib/analysis-workspace/types';
import type { Dispatch, SetStateAction } from 'react';

/**
 * Expands ancestors for the selected resource (deep links / clicks) and, in
 * project mode with no selection, expands only the project root branch.
 *
 * Selection is a single `assetViewState.selectedResourceId` — the parent does
 * not apply a separate "effective" resolver; URL and state stay aligned.
 */
export function useInventoryExplorerExpansion(
  explorerTree: ExplorerTreeNode[],
  allBranchIds: Set<string>,
  expandedNodeIds: Set<string>,
  projectName: string | null,
  assetExplorerMode: AssetViewState['explorerMode'],
  selectedResourceId: string | null,
  onAssetViewStateChange: Dispatch<SetStateAction<AssetViewState>>,
): void {
  useEffect(() => {
    if (explorerTree.length === 0 || selectedResourceId == null) {
      return;
    }
    const needed = collectAncestorBranchIdsForResource(explorerTree, selectedResourceId);
    if (needed.size === 0) return;

    onAssetViewStateChange((current) => {
      const missing = [...needed].filter((id) => !current.expandedNodeIds.has(id));
      if (missing.length === 0) return current;
      return {
        ...current,
        expandedNodeIds: new Set([...current.expandedNodeIds, ...needed]),
      };
    });
  }, [explorerTree, onAssetViewStateChange, selectedResourceId]);

  useEffect(() => {
    if (assetExplorerMode !== 'project') return;
    if (selectedResourceId != null) return;
    if (explorerTree.length === 0) return;
    if (expandedNodeIds.size > 0) return;
    const rootId = projectRootBranchId(projectName);
    if (!allBranchIds.has(rootId)) return;

    onAssetViewStateChange((current) => {
      if (current.explorerMode !== 'project') return current;
      if (current.selectedResourceId != null) return current;
      if (current.expandedNodeIds.has(rootId)) return current;
      return {
        ...current,
        expandedNodeIds: new Set([...current.expandedNodeIds, rootId]),
      };
    });
  }, [
    allBranchIds,
    assetExplorerMode,
    expandedNodeIds.size,
    explorerTree.length,
    onAssetViewStateChange,
    projectName,
    selectedResourceId,
  ]);
}
