import type { LineageGraphModel, LineageGraphNodeLayout } from './lineage-model';
import type { NodeActionContext } from './node-actions';
import type { WarehouseLocation } from '@dbt-tools/core/browser';

/** Shared builders for lineage tests, so a new `LineageGraphModel` field is added in one place. */

export const noActions: NodeActionContext = {
  timelineIds: new Set(),
  executedIds: new Set(),
  resourceIds: new Set(),
};

export function bigQueryLocation(
  project: string,
  dataset: string,
  relation: string | null = null,
): WarehouseLocation {
  return {
    levels: [
      { kind: 'project', label: 'Project', name: project },
      { kind: 'dataset', label: 'Dataset', name: dataset },
    ],
    relation,
  };
}

/** A `LineageGraphModel` with compact-card geometry; override any field per test. */
export function lineageModelOf(
  nodeLayouts: Map<string, LineageGraphNodeLayout>,
  graphEdges: LineageGraphModel['graphEdges'],
  overrides: Partial<LineageGraphModel> = {},
): LineageGraphModel {
  return {
    upstreamMap: new Map(),
    downstreamMap: new Map(),
    columnNodes: [],
    nodeLayouts,
    graphEdges,
    svgWidth: 640,
    svgHeight: 320,
    hasRelatedNodes: graphEdges.length > 0,
    nodeWidth: 200,
    nodeHeight: 60,
    nodeRadius: 12,
    rowGap: 24,
    displayMode: 'focused',
    ...overrides,
  };
}
