import { queryDependencies } from '../analysis/dependencies/query.js';
import {
  type QueryDependenciesInputContract,
  queryDependenciesInputSchema,
} from '../contracts/dependency-query-input.js';
import { dependencyQueryOutputSchema } from '../contracts/dependency-query.js';

import type { UseCase } from './types.js';
import type { QueryDependenciesInput } from '../analysis/dependencies/query.js';
import type { LoadedArtifactWorkspace } from '../artifact-workspace/types.js';
import type { DependencyQueryOutputContract } from '../contracts/dependency-query.js';

function toQueryDependenciesInput(
  parsed: QueryDependenciesInputContract,
): QueryDependenciesInput {
  return {
    uniqueId: parsed.uniqueId,
    direction: parsed.direction,
    depth: parsed.depth,
    buildOrder: parsed.buildOrder === true,
  };
}

function stripUndefinedRecord(value: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (child !== undefined) {
      // nosemgrep: eslint.security.detect-object-injection -- bounded dependency node sanitizer
      out[key] = child;
    }
  }
  return out;
}

export const queryDependenciesUseCase: UseCase<
  QueryDependenciesInputContract,
  DependencyQueryOutputContract
> = {
  name: 'resource.dependencies',
  title: 'Query resource dependencies',
  input: queryDependenciesInputSchema,
  output: dependencyQueryOutputSchema,
  read: 'snapshot',
  run(snapshot: LoadedArtifactWorkspace, input: QueryDependenciesInputContract) {
    const result = queryDependencies(snapshot.graph, toQueryDependenciesInput(input));
    return {
      ...result,
      dependencies: result.dependencies.map((node) =>
        stripUndefinedRecord(node as Record<string, unknown>),
      ),
    } as DependencyQueryOutputContract;
  },
};
