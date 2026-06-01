import { QueryExecutionsValidationError } from '@dbt-tools/core';
import {
  artifactWorkspaceStatusSchema,
  dependencyQueryOutputSchema,
  getResourceToolOutputSchema,
  queryExecutionsOutputSchema,
  runSummaryOutputSchema,
  searchResourcesOutputSchema,
} from '@dbt-tools/core/contracts';

import { runToolWithLoadedUseCases } from '../loaded-use-cases.js';
import { assertRemoteFlagsMatchTarget, type McpRemoteClientFlagOptions } from '../options.js';
import {
  createMcpLoadProgressNotifier,
  type McpToolRequestExtra,
} from '../progress/map-load-progress.js';
import { loadResourceNode, toGetResourceToolOutput } from '../resources/fetch-resource.js';

import {
  emptyToolInputSchema,
  getResourceInputSchema,
  queryDependenciesInputSchema,
  queryExecutionsInputSchema,
  searchResourcesInputSchema,
  setTargetInputSchema,
  toGetResourceInput,
  toQueryDependenciesInput,
  toQueryExecutionsRequest,
  toSearchResourcesInput,
} from './tool-input-schemas.js';
import { jsonResult, jsonToolError } from './tool-result.js';

import type { ArtifactWorkspaceControl } from '../workspace-control.js';
import type { DbtToolsUseCases } from '@dbt-tools/core/artifact-workspace';
import type * as z from 'zod/v4';

export type { ArtifactWorkspaceControl } from '../workspace-control.js';

export interface McpJsonToolResult {
  [key: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

type ToolInput = Record<string, unknown>;

function invalidInputResult(error: z.ZodError): McpJsonToolResult {
  return jsonToolError({
    error: 'Invalid tool input.',
    hint: error.message,
  });
}

function validationErrorResult(error: QueryExecutionsValidationError): McpJsonToolResult {
  return jsonToolError({
    error: error.message,
    hint: error.hint,
    allowed_sorts: error.allowed_sorts,
    allowed_min_filters: error.allowed_min_filters,
  });
}

type McpToolHandler = (input: ToolInput, extra?: McpToolRequestExtra) => Promise<McpJsonToolResult>;

export type DbtToolsMcpToolHandlers = {
  dbt_tools_status: McpToolHandler;
  dbt_tools_set_target: McpToolHandler;
  dbt_tools_unset_target: McpToolHandler;
  dbt_tools_clear_cached_targets: McpToolHandler;
  dbt_tools_refresh: McpToolHandler;
  dbt_tools_search_resources: McpToolHandler;
  dbt_tools_get_resource: McpToolHandler;
  dbt_tools_query_dependencies: McpToolHandler;
  dbt_tools_query_executions: McpToolHandler;
  dbt_tools_get_run_summary: McpToolHandler;
};

export function createDbtToolsMcpToolHandlers(
  workspace: ArtifactWorkspaceControl,
  useCases: DbtToolsUseCases,
  startupOptions: McpRemoteClientFlagOptions = {},
): DbtToolsMcpToolHandlers {
  return {
    dbt_tools_status: async (_input: ToolInput): Promise<McpJsonToolResult> =>
      jsonResult(artifactWorkspaceStatusSchema, await workspace.getStatus()),

    dbt_tools_set_target: async (
      input: ToolInput,
      extra?: McpToolRequestExtra,
    ): Promise<McpJsonToolResult> => {
      const parsed = setTargetInputSchema.safeParse(input);
      if (!parsed.success) {
        return invalidInputResult(parsed.error);
      }
      try {
        assertRemoteFlagsMatchTarget(parsed.data.target, startupOptions);
        const onProgress = createMcpLoadProgressNotifier(extra);
        return jsonResult(
          artifactWorkspaceStatusSchema,
          await workspace.setTarget(parsed.data.target, { onProgress }),
        );
      } catch (error) {
        return jsonToolError({
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },

    dbt_tools_unset_target: async (_input: ToolInput): Promise<McpJsonToolResult> =>
      jsonResult(artifactWorkspaceStatusSchema, await workspace.unsetTarget()),

    dbt_tools_clear_cached_targets: async (_input: ToolInput): Promise<McpJsonToolResult> =>
      jsonResult(artifactWorkspaceStatusSchema, await workspace.clearCachedTargets()),

    dbt_tools_refresh: async (
      _input: ToolInput,
      extra?: McpToolRequestExtra,
    ): Promise<McpJsonToolResult> => {
      const onProgress = createMcpLoadProgressNotifier(extra);
      return jsonResult(
        artifactWorkspaceStatusSchema,
        await workspace.refreshIfChanged({ onProgress }),
      );
    },

    dbt_tools_search_resources: async (input: ToolInput): Promise<McpJsonToolResult> => {
      const parsed = searchResourcesInputSchema.safeParse(input);
      if (!parsed.success) {
        return invalidInputResult(parsed.error);
      }
      return runToolWithLoadedUseCases(searchResourcesOutputSchema, useCases, (uc) =>
        uc.searchResources(toSearchResourcesInput(parsed.data)),
      );
    },

    dbt_tools_get_resource: async (input: ToolInput): Promise<McpJsonToolResult> => {
      const parsed = getResourceInputSchema.safeParse(input);
      if (!parsed.success) {
        return invalidInputResult(parsed.error);
      }
      const request = toGetResourceInput(parsed.data);
      return runToolWithLoadedUseCases(
        getResourceToolOutputSchema,
        useCases,
        async (uc) =>
          toGetResourceToolOutput(
            await loadResourceNode(
              uc,
              request.uniqueId,
              request.includeCode ? 'truncate-for-json' : 'omit',
            ),
          ),
        { contentPayload: (body) => body.resource },
      );
    },

    dbt_tools_query_dependencies: async (input: ToolInput): Promise<McpJsonToolResult> => {
      const parsed = queryDependenciesInputSchema.safeParse(input);
      if (!parsed.success) {
        return invalidInputResult(parsed.error);
      }
      return runToolWithLoadedUseCases(dependencyQueryOutputSchema, useCases, (uc) =>
        uc.queryDependencies(toQueryDependenciesInput(parsed.data)),
      );
    },

    dbt_tools_query_executions: async (input: ToolInput): Promise<McpJsonToolResult> => {
      const parsed = queryExecutionsInputSchema.safeParse(input);
      if (!parsed.success) {
        return invalidInputResult(parsed.error);
      }
      try {
        return await runToolWithLoadedUseCases(queryExecutionsOutputSchema, useCases, (uc) =>
          uc.queryExecutions(toQueryExecutionsRequest(parsed.data)),
        );
      } catch (error) {
        if (error instanceof QueryExecutionsValidationError) {
          return validationErrorResult(error);
        }
        throw error;
      }
    },

    dbt_tools_get_run_summary: async (input: ToolInput): Promise<McpJsonToolResult> => {
      const parsed = emptyToolInputSchema.safeParse(input);
      if (!parsed.success) {
        return invalidInputResult(parsed.error);
      }
      return runToolWithLoadedUseCases(runSummaryOutputSchema, useCases, (uc) =>
        uc.getRunSummary(),
      );
    },
  };
}
