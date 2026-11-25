import type { AnalysisWorkspaceProps } from './types';
import type { AnalysisState } from '@web/types';

export type NodeActionId = 'inventory' | 'lineage' | 'runs' | 'timeline';

export type NodeNavigate = AnalysisWorkspaceProps['onNavigateTo'];

/** Which views can show a node, built once per analysis. */
export interface NodeActionContext {
  /** Nodes with a Timeline row (includes dbt sources, ADR-0006). */
  timelineIds: ReadonlySet<string>;
  /** Nodes with a run result. */
  executedIds: ReadonlySet<string>;
  /** Nodes that are known resources (Inventory and Lineage can open them). */
  resourceIds: ReadonlySet<string>;
}

export interface NodeActionDefinition {
  id: NodeActionId;
  label: string;
  isAvailable: (ctx: NodeActionContext, nodeId: string) => boolean;
  navigate: (nodeId: string, onNavigateTo: NodeNavigate) => void;
}

/** In display order. */
const NODE_ACTIONS: readonly NodeActionDefinition[] = [
  {
    id: 'timeline',
    label: 'Open in Timeline',
    isAvailable: (ctx, nodeId) => ctx.timelineIds.has(nodeId),
    navigate: (nodeId, onNavigateTo) =>
      onNavigateTo('timeline', { resourceId: nodeId, executionId: nodeId }),
  },
  {
    id: 'runs',
    label: 'Open in Runs',
    isAvailable: (ctx, nodeId) => ctx.executedIds.has(nodeId),
    navigate: (nodeId, onNavigateTo) => onNavigateTo('runs', { executionId: nodeId }),
  },
  {
    id: 'inventory',
    label: 'Open in Inventory',
    isAvailable: (ctx, nodeId) => ctx.resourceIds.has(nodeId),
    navigate: (nodeId, onNavigateTo) =>
      onNavigateTo('inventory', { resourceId: nodeId, assetTab: 'summary' }),
  },
  {
    id: 'lineage',
    label: 'Open in Lineage',
    isAvailable: (ctx, nodeId) => ctx.resourceIds.has(nodeId),
    navigate: (nodeId, onNavigateTo) =>
      onNavigateTo('inventory', {
        resourceId: nodeId,
        assetTab: 'lineage',
        rootResourceId: nodeId,
      }),
  },
];

const NODE_ACTION_BY_ID = new Map(NODE_ACTIONS.map((action) => [action.id, action] as const));

export function buildNodeActionContext(
  analysis: Pick<AnalysisState, 'executions' | 'ganttData' | 'resources'>,
): NodeActionContext {
  return {
    timelineIds: new Set(analysis.ganttData.map((item) => item.unique_id)),
    executedIds: new Set(analysis.executions.map((row) => row.uniqueId)),
    resourceIds: new Set(analysis.resources.map((resource) => resource.uniqueId)),
  };
}

/** Actions that apply to `nodeId`, skipping the views listed in `exclude` (usually the current one). */
export function getNodeActions(
  ctx: NodeActionContext,
  nodeId: string,
  exclude: readonly NodeActionId[] = [],
): NodeActionDefinition[] {
  return NODE_ACTIONS.filter(
    (action) => !exclude.includes(action.id) && action.isAvailable(ctx, nodeId),
  );
}

/** Runs one action by id; for callers that always mean a specific view (e.g. Health rows open Timeline). */
export function runNodeAction(id: NodeActionId, nodeId: string, onNavigateTo: NodeNavigate): void {
  const action = NODE_ACTION_BY_ID.get(id);
  if (!action) throw new Error(`Unknown node action: ${id}`);
  action.navigate(nodeId, onNavigateTo);
}
