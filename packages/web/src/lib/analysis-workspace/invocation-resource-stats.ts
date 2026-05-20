import { incrementMapCount } from '@dbt-tools/core/browser';

import {
  isDefaultTimelineResource,
  isMainProjectResource,
} from '@web/lib/analysis-workspace/utils';

import type { AnalysisState, ResourceNode } from '@web/types';

/** Types always listed so operators can compare zeros (e.g. sources in graph vs timeline). */
const PINNED_RESOURCE_TYPES = ['model', 'source', 'seed', 'snapshot'] as const;

function countGraphNodesByTypeForProject(
  resources: readonly ResourceNode[],
  projectName: string,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const resource of resources) {
    if (!isMainProjectResource(resource, projectName)) continue;
    incrementMapCount(out, resource.resourceType);
  }
  return out;
}

export interface InvocationResourceComparisonRow {
  resourceType: string;
  graphCount: number;
  runCount: number;
  timelineCount: number;
}

/**
 * Compare manifest graph size, this invocation's run_results rows, and timeline
 * gantt rows (after default timeline scoping). When `projectName` is set, manifest
 * counts match that package (same scope as run/timeline); otherwise they use the
 * full graph summary. Helps explain missing types such as `source` when dbt did
 * not execute them but the manifest defines them.
 */
export function buildInvocationResourceComparison(
  analysis: AnalysisState,
  projectName: string | null,
): InvocationResourceComparisonRow[] {
  const resources = analysis.resources ?? [];
  const graphByType =
    projectName != null
      ? countGraphNodesByTypeForProject(resources, projectName)
      : new Map(Object.entries(analysis.graphSummary.nodesByType));

  const executionsByType = new Map<string, number>();
  for (const row of analysis.executions) {
    if (projectName != null && !isMainProjectResource(row, projectName)) {
      continue;
    }
    incrementMapCount(executionsByType, row.resourceType);
  }

  const timelineByType = new Map<string, number>();
  for (const item of analysis.ganttData) {
    if (!isDefaultTimelineResource(item, projectName)) continue;
    incrementMapCount(timelineByType, item.resourceType);
  }

  const typeSet = new Set<string>([
    ...PINNED_RESOURCE_TYPES,
    ...graphByType.keys(),
    ...executionsByType.keys(),
    ...timelineByType.keys(),
  ]);

  const rows: InvocationResourceComparisonRow[] = [];
  for (const resourceType of [...typeSet].sort((a, b) => a.localeCompare(b))) {
    rows.push({
      resourceType,
      graphCount: graphByType.get(resourceType) ?? 0,
      runCount: executionsByType.get(resourceType) ?? 0,
      timelineCount: timelineByType.get(resourceType) ?? 0,
    });
  }

  return rows.filter(
    (r) =>
      (PINNED_RESOURCE_TYPES as readonly string[]).includes(r.resourceType) ||
      r.graphCount > 0 ||
      r.runCount > 0 ||
      r.timelineCount > 0,
  );
}
