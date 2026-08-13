import { getResourceToolOutputSchema, toQueryExecutionsRequest } from '@dbt-tools/core/contracts';
import {
  MCP_ANALYSIS_TOOL_NAMES,
  USE_CASE_REGISTRY,
  findUseCaseByName,
} from '@dbt-tools/core/usecases';

import { runToolWithLoadedUseCases } from '../loaded-use-cases.js';
import { loadResourceNode, toGetResourceToolOutput } from '../resources/fetch-resource.js';

import { bindMcpToolHandler } from './bind-tool-handler.js';
import {
  getResourceInputSchema,
  queryDependenciesInputSchema,
  queryExecutionsInputSchema,
  searchResourcesInputSchema,
  toSearchResourcesInput,
} from './tool-input-schemas.js';
import { invalidToolInputResult } from './tool-result.js';

import type { DbtToolsMcpToolHandlers } from './tool-handlers.js';
import type { DbtToolsUseCases } from '@dbt-tools/core/artifact-workspace';
import type { McpServer } from '@modelcontextprotocol/server';
import type * as z from 'zod/v4';

type ToolInput = Record<string, unknown>;

const MCP_INPUT_SCHEMAS: Record<string, z.ZodType<unknown>> = {
  'resource.search': searchResourcesInputSchema,
  'resource.details': getResourceInputSchema,
  'resource.dependencies': queryDependenciesInputSchema,
  'runs.query': queryExecutionsInputSchema,
};

/**
 * Register analysis tools from the shared use-case registry (RFC-0001 §4.4).
 */
export function registerRegistryAnalysisTools(
  server: McpServer,
  handlers: Pick<
    DbtToolsMcpToolHandlers,
    | 'dbt_tools_get_resource'
    | 'dbt_tools_get_run_summary'
    | 'dbt_tools_query_dependencies'
    | 'dbt_tools_query_executions'
    | 'dbt_tools_search_resources'
  >,
): void {
  for (const useCase of USE_CASE_REGISTRY) {
    const toolName = MCP_ANALYSIS_TOOL_NAMES[useCase.name];
    if (toolName == null) {
      throw new Error(`Missing MCP tool mapping for use case ${useCase.name}`);
    }
    const handler = handlers[toolName as keyof typeof handlers];
    server.registerTool(
      toolName,
      {
        title: useCase.title,
        description: useCase.title,
        inputSchema: MCP_INPUT_SCHEMAS[useCase.name] ?? useCase.input,
        outputSchema: useCase.output,
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      bindMcpToolHandler(handler),
    );
  }
}

export function createRegistryAnalysisToolHandlers(
  useCases: DbtToolsUseCases,
): Pick<
  DbtToolsMcpToolHandlers,
  | 'dbt_tools_get_resource'
  | 'dbt_tools_get_run_summary'
  | 'dbt_tools_query_dependencies'
  | 'dbt_tools_query_executions'
  | 'dbt_tools_search_resources'
> {
  const searchUseCase = findUseCaseByName('resource.search')!;
  const dependenciesUseCase = findUseCaseByName('resource.dependencies')!;
  const executionsUseCase = findUseCaseByName('runs.query')!;
  const summaryUseCase = findUseCaseByName('runs.summary')!;

  return {
    dbt_tools_search_resources: async (input: ToolInput) => {
      const parsed = searchResourcesInputSchema.safeParse(input);
      if (!parsed.success) {
        return invalidToolInputResult(parsed.error);
      }
      return runToolWithLoadedUseCases(searchUseCase.output, useCases, (uc) =>
        uc.searchResources(toSearchResourcesInput(parsed.data)),
      );
    },

    dbt_tools_get_resource: async (input: ToolInput) => {
      const parsed = getResourceInputSchema.safeParse(input);
      if (!parsed.success) {
        return invalidToolInputResult(parsed.error);
      }
      return runToolWithLoadedUseCases(
        getResourceToolOutputSchema,
        useCases,
        async (uc) => {
          const resource = await loadResourceNode(
            uc,
            parsed.data.uniqueId,
            parsed.data.includeCode === true ? 'truncate-for-json' : 'omit',
          );
          return toGetResourceToolOutput(resource);
        },
        { contentPayload: (body) => body.resource },
      );
    },

    dbt_tools_query_dependencies: async (input: ToolInput) => {
      const parsed = queryDependenciesInputSchema.safeParse(input);
      if (!parsed.success) {
        return invalidToolInputResult(parsed.error);
      }
      return runToolWithLoadedUseCases(dependenciesUseCase.output, useCases, (uc) =>
        uc.queryDependencies(parsed.data),
      );
    },

    dbt_tools_query_executions: async (input: ToolInput) => {
      const parsed = queryExecutionsInputSchema.safeParse(input);
      if (!parsed.success) {
        return invalidToolInputResult(parsed.error);
      }
      return runToolWithLoadedUseCases(executionsUseCase.output, useCases, (uc) =>
        uc.queryExecutions(toQueryExecutionsRequest(parsed.data)),
      );
    },

    dbt_tools_get_run_summary: async (_input: ToolInput) => {
      return runToolWithLoadedUseCases(summaryUseCase.output, useCases, (uc) => uc.getRunSummary());
    },
  };
}
