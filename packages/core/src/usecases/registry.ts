import { getResourceUseCase } from './get-resource.js';
import { getRunSummaryUseCase } from './get-run-summary.js';
import { queryDependenciesUseCase } from './query-dependencies.js';
import { queryExecutionsUseCase } from './query-executions.js';
import { searchResourcesUseCase } from './search-resources.js';

import type { UseCase } from './types.js';

export const USE_CASE_REGISTRY: UseCase<unknown, unknown>[] = [
  searchResourcesUseCase,
  getResourceUseCase,
  queryDependenciesUseCase,
  queryExecutionsUseCase,
  getRunSummaryUseCase,
];

export function findUseCaseByName(name: string): UseCase<unknown, unknown> | undefined {
  return USE_CASE_REGISTRY.find((entry) => entry.name === name);
}

export const MCP_ANALYSIS_TOOL_NAMES: Record<string, string> = {
  'resource.search': 'dbt_tools_search_resources',
  'resource.details': 'dbt_tools_get_resource',
  'resource.dependencies': 'dbt_tools_query_dependencies',
  'runs.query': 'dbt_tools_query_executions',
  'runs.summary': 'dbt_tools_get_run_summary',
};
