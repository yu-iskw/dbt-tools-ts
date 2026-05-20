import { TEST_RESOURCE_TYPES } from './constants';
import { getDependencyRelation } from './dependency-index-access';
import { rollupCountsHaveAttention, type ResourceTestRollupCounts } from './test-rollup-types';
import { normalizeManifestFilePath } from './utils';

import type { AssetExplorerMode } from './types';
import type { AnalysisState, ResourceNode, StatusTone } from '@web/types';

export interface TestStats extends ResourceTestRollupCounts {
  pass: number;
  /**
   * Attached tests with no run row / unknown status (`neutral` tone).
   * Not included in explorer “Test issues” attention rollups or folder aggregation.
   */
  notExecuted: number;
}

export function emptyTestStats(): TestStats {
  return {
    pass: 0,
    fail: 0,
    error: 0,
    warn: 0,
    skipped: 0,
    notExecuted: 0,
  };
}

/**
 * True when the tree should show “Test issues” badges (error, warn, skipped, legacy fail).
 * Not-executed (`neutral`) attachments are excluded—they are not run outcomes and dominate large graphs.
 */
export function testStatsHasAttention(stats: TestStats): boolean {
  return rollupCountsHaveAttention(stats);
}

export interface SelectedAssetTestEvidence {
  total: number;
  passing: number;
  attention: number;
  tests: ResourceNode[];
}

export function buildResourceTestStats(
  resources: ResourceNode[],
  dependencyIndex?: AnalysisState['dependencyIndex'],
): Map<string, TestStats> {
  const resolvedDependencyIndex = dependencyIndex ?? {};
  const testResources = resources.filter((r) => TEST_RESOURCE_TYPES.has(r.resourceType));
  const resourceTestStats = new Map<string, TestStats>();

  for (const test of testResources) {
    const testedIds =
      getDependencyRelation(resolvedDependencyIndex, test.uniqueId)?.upstream?.map(
        (dependency) => dependency.uniqueId,
      ) ?? [];

    for (const resourceId of testedIds) {
      const stats = resourceTestStats.get(resourceId) ?? emptyTestStats();

      if (test.statusTone === 'positive') stats.pass += 1;
      else if (test.statusTone === 'danger') stats.error += 1;
      else if (test.statusTone === 'warning') stats.warn += 1;
      else if (test.statusTone === 'skipped') stats.skipped += 1;
      else stats.notExecuted += 1;

      resourceTestStats.set(resourceId, stats);
    }
  }

  return resourceTestStats;
}

export function buildSelectedAssetTestEvidence(
  resourceId: string,
  resources: ResourceNode[],
  dependencyIndex?: AnalysisState['dependencyIndex'],
): SelectedAssetTestEvidence {
  const resolvedDependencyIndex = dependencyIndex ?? {};
  const attachedTests = resources
    .filter((resource) => TEST_RESOURCE_TYPES.has(resource.resourceType))
    .filter((test) =>
      (
        getDependencyRelation(resolvedDependencyIndex, test.uniqueId)?.upstream?.map(
          (dependency) => dependency.uniqueId,
        ) ?? []
      ).includes(resourceId),
    )
    .sort((left, right) => {
      const toneRank: Record<StatusTone, number> = {
        danger: 0,
        warning: 1,
        positive: 2,
        skipped: 3,
        neutral: 4,
      };
      const toneOrder =
        toneRank[left.statusTone ?? 'neutral'] - toneRank[right.statusTone ?? 'neutral'];
      if (toneOrder !== 0) return toneOrder;
      const durationOrder =
        (right.executionTime ?? Number.NEGATIVE_INFINITY) -
        (left.executionTime ?? Number.NEGATIVE_INFINITY);
      if (durationOrder !== 0) return durationOrder;
      return left.name.localeCompare(right.name);
    });

  const passing = attachedTests.filter((test) => test.statusTone === 'positive').length;
  const attention = attachedTests.filter(
    (test) => test.statusTone === 'warning' || test.statusTone === 'danger',
  ).length;

  return {
    total: attachedTests.length,
    passing,
    attention,
    tests: attachedTests,
  };
}

export interface ExplorerTreeNode {
  id: string;
  label: string;
  kind: 'branch' | 'resource';
  children: ExplorerTreeNode[];
  resource?: ResourceNode;
  count: number;
  parentIds: string[];
  testStats?: TestStats;
}

export interface ExplorerTreeRow {
  node: ExplorerTreeNode;
  depth: number;
}

export function createBranchNode(id: string, label: string, parentIds: string[]): ExplorerTreeNode {
  return {
    id,
    label,
    kind: 'branch',
    children: [],
    count: 0,
    parentIds,
  };
}

export function createResourceNode(
  id: string,
  resource: ResourceNode,
  parentIds: string[],
): ExplorerTreeNode {
  return {
    id,
    label: resource.name,
    kind: 'resource',
    children: [],
    resource,
    count: 1,
    parentIds,
  };
}

export { normalizeManifestFilePath };

export function splitFilePath(filePath: string): {
  directories: string[];
  fileName: string;
} {
  const parts = filePath
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
  return {
    directories: parts.slice(0, -1),
    fileName: parts[parts.length - 1] ?? filePath,
  };
}

export function getProjectFilePath(resource: ResourceNode): string | null {
  return normalizeManifestFilePath(
    resource.originalFilePath ?? resource.patchPath ?? resource.path,
  );
}

export function getProjectDirectorySegments(resource: ResourceNode): string[] {
  const filePath = getProjectFilePath(resource);
  if (!filePath) return [];
  return splitFilePath(filePath).directories;
}

export function getResourceOriginLabel(resource: ResourceNode): string | null {
  const filePath = getProjectFilePath(resource);
  if (!filePath) return null;
  return splitFilePath(filePath).fileName;
}

export function getDatabaseTreeSegments(resource: ResourceNode): string[] {
  if (!resource.database || !resource.schema) return [];
  // Add packageName as a 3rd level so resources from different dbt packages
  // (e.g. the user's project and an installed package like elementary) are
  // grouped separately even when they share the same database + schema.
  return [resource.database, resource.schema, resource.packageName];
}

export function compareResourceNodes(a: ResourceNode, b: ResourceNode): number {
  const PRIORITY = [
    'model',
    'seed',
    'snapshot',
    'source',
    'macro',
    'operation',
    'sql_operation',
    'analysis',
    'semantic_model',
    'metric',
    'test',
    'unit_test',
    'exposure',
  ];
  const aIndex = PRIORITY.indexOf(a.resourceType);
  const bIndex = PRIORITY.indexOf(b.resourceType);
  if (aIndex !== bIndex) {
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  }
  return a.name.localeCompare(b.name);
}

export function sortTreeNodes(a: ExplorerTreeNode, b: ExplorerTreeNode): number {
  const kindOrder = { branch: 0, resource: 1 } as const;
  if (a.kind !== b.kind) return kindOrder[a.kind] - kindOrder[b.kind];
  if (a.kind === 'resource' && b.kind === 'resource' && a.resource && b.resource) {
    return compareResourceNodes(a.resource, b.resource);
  }
  return a.label.localeCompare(b.label);
}

export function finalizeTreeCounts(nodes: ExplorerTreeNode[]): ExplorerTreeNode[] {
  return nodes
    .map((node) => {
      if (node.kind === 'resource') return node;
      const children = finalizeTreeCounts(node.children).sort(sortTreeNodes);
      return {
        ...node,
        children,
        count: children.reduce((sum, child) => sum + child.count, 0),
      };
    })
    .sort(sortTreeNodes);
}

/** Branch id for the project-mode explorer root (must stay aligned with buildExplorerTree). */
export function projectRootBranchId(projectName: string | null): string {
  const label = projectName ?? 'Workspace';
  return `project:branch:${label}`;
}

// eslint-disable-next-line sonarjs/cognitive-complexity -- explorer tree cases
export function buildExplorerTree(
  resources: ResourceNode[],
  mode: AssetExplorerMode,
  projectName: string | null,
  dependencyIndex?: AnalysisState['dependencyIndex'],
): ExplorerTreeNode[] {
  const resolvedDependencyIndex = dependencyIndex ?? {};
  const nonTestResources = resources.filter((r) => !TEST_RESOURCE_TYPES.has(r.resourceType));
  const resourceTestStats = buildResourceTestStats(resources, resolvedDependencyIndex);

  // Aggregate leaf testStats upward to branch nodes (bottom-up recursion).
  // Returns the combined TestStats of the given node list.
  const applyTestStats = (nodes: ExplorerTreeNode[]): TestStats => {
    const total = emptyTestStats();
    for (const node of nodes) {
      let nodeStats: TestStats;
      if (node.kind === 'resource') {
        nodeStats = node.testStats ?? emptyTestStats();
      } else {
        nodeStats = applyTestStats(node.children);
        if (testStatsHasAttention(nodeStats)) {
          node.testStats = nodeStats;
        }
      }
      total.pass += nodeStats.pass;
      total.fail += nodeStats.fail;
      total.error += nodeStats.error;
      total.warn += nodeStats.warn;
      total.skipped += nodeStats.skipped;
    }
    return total;
  };

  const roots: ExplorerTreeNode[] = [];

  const ensureBranch = (
    siblings: ExplorerTreeNode[],
    branchId: string,
    label: string,
    parentIds: string[],
  ): ExplorerTreeNode => {
    const existing = siblings.find((node) => node.kind === 'branch' && node.id === branchId);
    if (existing) return existing;
    const branch = createBranchNode(branchId, label, parentIds);
    siblings.push(branch);
    return branch;
  };

  if (mode === 'project') {
    const rootLabel = projectName ?? 'Workspace';
    const rootId = projectRootBranchId(projectName);
    const root = ensureBranch(roots, rootId, rootLabel, []);

    for (const resource of nonTestResources) {
      if (!getProjectFilePath(resource)) continue;
      const directories = getProjectDirectorySegments(resource);
      const parentIds: string[] = [root.id];
      let siblings = root.children;

      for (let index = 0; index < directories.length; index += 1) {
        const segment = directories.at(index)!;
        const branchId = `${mode}:branch:${[rootLabel, ...directories.slice(0, index + 1)].join('/')}`;
        const branch = ensureBranch(siblings, branchId, segment, [...parentIds]);
        parentIds.push(branchId);
        siblings = branch.children;
      }

      const leaf = createResourceNode(`${mode}:resource:${resource.uniqueId}`, resource, parentIds);
      const stats = resourceTestStats.get(resource.uniqueId);
      if (stats && testStatsHasAttention(stats)) {
        leaf.testStats = stats;
      }
      siblings.push(leaf);
    }

    applyTestStats(roots);

    return finalizeTreeCounts(roots).filter((node) => node.count > 0);
  }

  for (const resource of nonTestResources) {
    const segments = getDatabaseTreeSegments(resource);
    if (segments.length === 0) {
      continue;
    }
    const parentIds: string[] = [];
    let siblings = roots;

    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments.at(index)!;
      const branchId = `${mode}:branch:${segments.slice(0, index + 1).join('/')}`;
      const branch = ensureBranch(siblings, branchId, segment, [...parentIds]);
      parentIds.push(branchId);
      siblings = branch.children;
    }

    const leaf = createResourceNode(`${mode}:resource:${resource.uniqueId}`, resource, parentIds);
    const stats = resourceTestStats.get(resource.uniqueId);
    if (stats && testStatsHasAttention(stats)) {
      leaf.testStats = stats;
    }
    siblings.push(leaf);
  }

  applyTestStats(roots);

  return finalizeTreeCounts(roots);
}

export function flattenExplorerTree(
  nodes: ExplorerTreeNode[],
  expanded: Set<string>,
  depth = 0,
): ExplorerTreeRow[] {
  const rows: ExplorerTreeRow[] = [];
  for (const node of nodes) {
    rows.push({ node, depth });
    if (node.kind === 'branch' && expanded.has(node.id)) {
      rows.push(...flattenExplorerTree(node.children, expanded, depth + 1));
    }
  }
  return rows;
}

export function collectBranchIds(nodes: ExplorerTreeNode[]): Set<string> {
  const ids = new Set<string>();
  const stack = [...nodes];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.kind !== 'resource') {
      ids.add(node.id);
      stack.push(...node.children);
    }
  }
  return ids;
}

export function collectLeafIds(nodes: ExplorerTreeNode[]): string[] {
  const ids: string[] = [];
  const stack = [...nodes];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.kind === 'resource' && node.resource) {
      ids.push(node.resource.uniqueId);
    } else {
      stack.push(...[...node.children].reverse());
    }
  }
  return ids;
}

export function findNodeByLeafResourceId(
  nodes: ExplorerTreeNode[],
  resourceId: string | null,
): ExplorerTreeNode | null {
  if (!resourceId) return null;
  const stack = [...nodes];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.kind === 'resource' && node.resource?.uniqueId === resourceId) {
      return node;
    }
    stack.push(...node.children);
  }
  return null;
}

export function collectAncestorBranchIdsForResource(
  nodes: ExplorerTreeNode[],
  resourceId: string | null,
): Set<string> {
  const node = findNodeByLeafResourceId(nodes, resourceId);
  return new Set(node?.parentIds ?? []);
}
