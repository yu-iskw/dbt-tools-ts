import { DependencyService, type DependencyResult } from './service';

import type { ManifestGraph } from '../manifest/graph';

export type QueryDependenciesDirection = 'downstream' | 'upstream';

export interface QueryDependenciesInput {
  uniqueId: string;
  direction: QueryDependenciesDirection;
  depth?: number;
  buildOrder?: boolean;
}

export function queryDependencies(
  graph: ManifestGraph,
  input: QueryDependenciesInput,
): DependencyResult {
  return DependencyService.getDependencies(
    graph,
    input.uniqueId,
    input.direction,
    undefined,
    input.depth,
    'flat',
    input.buildOrder === true,
  ) as DependencyResult;
}
