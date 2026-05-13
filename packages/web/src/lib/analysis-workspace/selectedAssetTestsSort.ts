import type { ResourceNode } from '@web/types';
import { formatResourceTypeLabel } from '@web/lib/analysis-workspace/utils';

export type AssetTestsSortKey = 'test' | 'status' | 'type' | 'target' | 'duration';
export type AssetTestsSortDirection = 'asc' | 'desc';

function signedOrder(order: number, direction: AssetTestsSortDirection): number {
  return direction === 'asc' ? order : -order;
}

function assetTestSortRank(resource: ResourceNode): number {
  if (resource.statusTone === 'danger' || resource.statusTone === 'warning') {
    return 0;
  }
  if (resource.statusTone === 'positive') return 1;
  if (resource.statusTone === 'skipped') return 2;
  return 3;
}

function compareExecutionTimeDesc(left: ResourceNode, right: ResourceNode): number {
  return (
    (right.executionTime ?? Number.NEGATIVE_INFINITY) -
    (left.executionTime ?? Number.NEGATIVE_INFINITY)
  );
}

function directedDurationOrder(durationOrder: number, direction: AssetTestsSortDirection): number {
  if (durationOrder === 0) return 0;
  return direction === 'asc' ? -durationOrder : durationOrder;
}

function compareSelectedAssetTestsByTest(
  left: ResourceNode,
  right: ResourceNode,
  direction: AssetTestsSortDirection,
): number {
  const nameOrder = left.name.localeCompare(right.name);
  if (nameOrder !== 0) return signedOrder(nameOrder, direction);
  return left.uniqueId.localeCompare(right.uniqueId);
}

function compareSelectedAssetTestsByDuration(
  left: ResourceNode,
  right: ResourceNode,
  direction: AssetTestsSortDirection,
): number {
  const durationOrder = compareExecutionTimeDesc(left, right);
  if (durationOrder !== 0) {
    return directedDurationOrder(durationOrder, direction);
  }
  return left.name.localeCompare(right.name);
}

function compareSelectedAssetTestsByType(
  left: ResourceNode,
  right: ResourceNode,
  direction: AssetTestsSortDirection,
): number {
  const typeOrder = formatResourceTypeLabel(left.resourceType).localeCompare(
    formatResourceTypeLabel(right.resourceType),
  );
  if (typeOrder !== 0) return signedOrder(typeOrder, direction);
  return left.name.localeCompare(right.name);
}

function compareSelectedAssetTestsByTarget(
  left: ResourceNode,
  right: ResourceNode,
  direction: AssetTestsSortDirection,
): number {
  const lt = (left.testAttachedTarget ?? '').trim();
  const rt = (right.testAttachedTarget ?? '').trim();
  const targetOrder = lt.localeCompare(rt);
  if (targetOrder !== 0) return signedOrder(targetOrder, direction);
  return left.name.localeCompare(right.name);
}

function compareSelectedAssetTestsByStatus(
  left: ResourceNode,
  right: ResourceNode,
  direction: AssetTestsSortDirection,
): number {
  const statusOrder = assetTestSortRank(left) - assetTestSortRank(right);
  if (statusOrder !== 0) {
    return -signedOrder(statusOrder, direction);
  }
  const durationOrder = compareExecutionTimeDesc(left, right);
  if (durationOrder !== 0) {
    return directedDurationOrder(durationOrder, direction);
  }
  const nameOrder = left.name.localeCompare(right.name);
  if (nameOrder !== 0) return signedOrder(nameOrder, direction);
  return left.uniqueId.localeCompare(right.uniqueId);
}

function compareSelectedAssetTests(
  left: ResourceNode,
  right: ResourceNode,
  sortKey: AssetTestsSortKey,
  direction: AssetTestsSortDirection,
): number {
  switch (sortKey) {
    case 'test':
      return compareSelectedAssetTestsByTest(left, right, direction);
    case 'duration':
      return compareSelectedAssetTestsByDuration(left, right, direction);
    case 'type':
      return compareSelectedAssetTestsByType(left, right, direction);
    case 'target':
      return compareSelectedAssetTestsByTarget(left, right, direction);
    case 'status':
      return compareSelectedAssetTestsByStatus(left, right, direction);
    default: {
      const _exhaustive: never = sortKey;
      return _exhaustive;
    }
  }
}

export function sortSelectedAssetTests(
  tests: ResourceNode[],
  sortKey: AssetTestsSortKey,
  direction: AssetTestsSortDirection,
): ResourceNode[] {
  return [...tests].sort((left, right) =>
    compareSelectedAssetTests(left, right, sortKey, direction),
  );
}
