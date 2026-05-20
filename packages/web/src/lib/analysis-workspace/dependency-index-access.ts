import { getObjectProperty } from '@dbt-tools/core/browser';

import type { AnalysisState } from '@web/types';

export type DependencyIndex = AnalysisState['dependencyIndex'];
type DependencyRelation = DependencyIndex[string];

/** Safe lookup on manifest dependency index (avoids dynamic bracket access). */
export function getDependencyRelation(
  index: DependencyIndex,
  nodeId: string,
): DependencyRelation | undefined {
  return getObjectProperty(index as Record<string, unknown>, nodeId) as
    | DependencyRelation
    | undefined;
}
