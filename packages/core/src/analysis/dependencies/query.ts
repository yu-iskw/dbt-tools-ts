import { DependencyService, type DependencyResult } from './service';

import type { ManifestGraph } from '../manifest/graph';

export type QueryDependenciesDirection = 'downstream' | 'upstream';

export interface QueryDependenciesInput {
  uniqueId: string;
  direction: QueryDependenciesDirection;
  depth?: number;
  buildOrder?: boolean;
  /** When false (default), omit raw_code and compiled_code. Use get_resource for SQL. */
  includeCode?: boolean;
}

function withOptionalCode(
  dep: DependencyResult['dependencies'][number],
  includeCode: boolean,
): DependencyResult['dependencies'][number] {
  if (!includeCode) return dep;

  const compiled =
    typeof dep.compiled_code === 'string' ? { compiled_code: dep.compiled_code } : {};
  const raw = typeof dep.raw_code === 'string' ? { raw_code: dep.raw_code } : {};
  return { ...dep, ...compiled, ...raw };
}

export function queryDependencies(
  graph: ManifestGraph,
  input: QueryDependenciesInput,
): DependencyResult {
  const includeCode = input.includeCode === true;
  const raw = DependencyService.getDependencies(
    graph,
    input.uniqueId,
    input.direction,
    undefined,
    input.depth,
    'flat',
    input.buildOrder === true,
    includeCode ? 'full' : 'identity',
  ) as DependencyResult;

  if (!includeCode) return raw;

  return {
    ...raw,
    dependencies: raw.dependencies.map((dep) => withOptionalCode(dep, true)),
  };
}
