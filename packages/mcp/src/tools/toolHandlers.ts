import {
  FAILURES_DEFAULT_LIMIT,
  FAILURES_MAX_LIMIT,
  RUN_REPORT_DEFAULT_LIMIT,
  RUN_REPORT_MAX_LIMIT,
  SEARCH_RESOURCES_DEFAULT_LIMIT,
  SEARCH_RESOURCES_MAX_LIMIT,
  type ArtifactWorkspaceStatus,
  type DbtToolsUseCases,
  type FailuresInput,
  type GetResourceInput,
  type ImpactInput,
  type LineageInput,
  type ResolvedArtifactRun,
  type RunReportInput,
  type SearchResourcesInput,
  type SwitchDbtTargetInput,
} from '@dbt-tools/core/artifact-workspace';
export interface ArtifactWorkspaceControl {
  getStatus(): Promise<ArtifactWorkspaceStatus>;
  refreshIfChanged(): Promise<ArtifactWorkspaceStatus>;
  listRuns(): Promise<ResolvedArtifactRun[]>;
  selectRun(runId: string): Promise<ArtifactWorkspaceStatus>;
  switchDbtTarget(input: SwitchDbtTargetInput): Promise<ArtifactWorkspaceStatus>;
}

export interface McpJsonToolResult {
  [key: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

type ToolInput = Record<string, unknown>;

const MSG_UNIQUE_ID_REQUIRED = 'uniqueId is required.';

function jsonResult(payload: unknown): McpJsonToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload) }],
  };
}

function optionalString(input: ToolInput, key: string): string | undefined {
  const value = input[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function optionalNumber(input: ToolInput, key: string): number | undefined {
  const value = input[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function boundedLimit(
  input: ToolInput,
  defaultLimit: number,
  maxLimit: number,
  key = 'limit',
): number {
  const raw = optionalNumber(input, key);
  if (raw == null) return defaultLimit;
  return Math.min(Math.max(1, Math.floor(raw)), maxLimit);
}

function offset(input: ToolInput): number {
  const raw = optionalNumber(input, 'offset');
  if (raw == null) return 0;
  return Math.max(0, Math.floor(raw));
}

function searchInput(input: ToolInput): SearchResourcesInput {
  return {
    query: optionalString(input, 'query'),
    type: optionalString(input, 'type'),
    package: optionalString(input, 'package'),
    tag: optionalString(input, 'tag'),
    path: optionalString(input, 'path'),
    limit: boundedLimit(input, SEARCH_RESOURCES_DEFAULT_LIMIT, SEARCH_RESOURCES_MAX_LIMIT),
    offset: offset(input),
  };
}

function getResourceInput(input: ToolInput): GetResourceInput {
  const uniqueId = optionalString(input, 'uniqueId');
  if (uniqueId == null) {
    throw new Error(MSG_UNIQUE_ID_REQUIRED);
  }
  return {
    uniqueId,
    includeCode: input.includeCode === true,
  };
}

function lineageInput(input: ToolInput): LineageInput {
  const uniqueId = optionalString(input, 'uniqueId');
  if (uniqueId == null) {
    throw new Error(MSG_UNIQUE_ID_REQUIRED);
  }
  const direction = input.direction === 'downstream' ? 'downstream' : 'upstream';
  return {
    uniqueId,
    direction,
    depth: optionalNumber(input, 'depth'),
  };
}

function impactInput(input: ToolInput): ImpactInput {
  const uniqueId = optionalString(input, 'uniqueId');
  if (uniqueId == null) {
    throw new Error(MSG_UNIQUE_ID_REQUIRED);
  }
  return {
    uniqueId,
    depth: optionalNumber(input, 'depth'),
  };
}

function failuresInput(input: ToolInput): FailuresInput {
  return {
    status: optionalString(input, 'status'),
    limit: boundedLimit(input, FAILURES_DEFAULT_LIMIT, FAILURES_MAX_LIMIT),
    offset: offset(input),
  };
}

function runReportInput(input: ToolInput): RunReportInput {
  return {
    nodeExecutionsLimit: boundedLimit(
      input,
      RUN_REPORT_DEFAULT_LIMIT,
      RUN_REPORT_MAX_LIMIT,
      'nodeExecutionsLimit',
    ),
    nodeExecutionsOffset: offset(input),
  };
}

export function createDbtToolsMcpToolHandlers(
  workspace: ArtifactWorkspaceControl,
  useCases: DbtToolsUseCases,
) {
  return {
    dbt_tools_status: async (_input: ToolInput): Promise<McpJsonToolResult> =>
      jsonResult(await workspace.getStatus()),

    dbt_tools_refresh: async (_input: ToolInput): Promise<McpJsonToolResult> =>
      jsonResult(await workspace.refreshIfChanged()),

    dbt_tools_list_runs: async (_input: ToolInput): Promise<McpJsonToolResult> =>
      jsonResult({ runs: await workspace.listRuns() }),

    dbt_tools_select_run: async (input: ToolInput): Promise<McpJsonToolResult> => {
      const runId = optionalString(input, 'runId');
      if (runId == null) {
        throw new Error('runId is required.');
      }
      return jsonResult(await workspace.selectRun(runId));
    },

    dbt_tools_set_target: async (input: ToolInput): Promise<McpJsonToolResult> => {
      const dbtTarget = optionalString(input, 'dbtTarget');
      if (dbtTarget == null) {
        throw new Error('dbtTarget is required.');
      }
      const switchInput: SwitchDbtTargetInput = { dbtTarget };
      if ('gcsProjectId' in input || 'gcsImpersonateServiceAccount' in input) {
        switchInput.gcsProjectId = optionalString(input, 'gcsProjectId');
        switchInput.gcsImpersonateServiceAccount = optionalString(
          input,
          'gcsImpersonateServiceAccount',
        );
      }
      return jsonResult(await workspace.switchDbtTarget(switchInput));
    },

    dbt_tools_search_resources: async (input: ToolInput): Promise<McpJsonToolResult> =>
      jsonResult(await useCases.searchResources(searchInput(input))),

    dbt_tools_get_resource: async (input: ToolInput): Promise<McpJsonToolResult> =>
      jsonResult(await useCases.getResource(getResourceInput(input))),

    dbt_tools_lineage: async (input: ToolInput): Promise<McpJsonToolResult> =>
      jsonResult(await useCases.getLineage(lineageInput(input))),

    dbt_tools_impact: async (input: ToolInput): Promise<McpJsonToolResult> =>
      jsonResult(await useCases.getImpact(impactInput(input))),

    dbt_tools_failures: async (input: ToolInput): Promise<McpJsonToolResult> =>
      jsonResult(await useCases.summarizeFailures(failuresInput(input))),

    dbt_tools_run_report: async (input: ToolInput): Promise<McpJsonToolResult> =>
      jsonResult(await useCases.buildRunReport(runReportInput(input))),
  };
}

export type DbtToolsMcpToolHandlers = ReturnType<typeof createDbtToolsMcpToolHandlers>;
