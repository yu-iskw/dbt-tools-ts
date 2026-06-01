import * as z from 'zod/v4';

import type { PromptMessage } from '@modelcontextprotocol/sdk/types.js';

const NO_DBT_EXECUTION_LINE = 'Do not modify files or execute dbt commands.';

export const triageDbtRunArgsSchema = z.object({
  focus: z.enum(['failures', 'performance', 'cost', 'all']).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export const analyzeModelBlastRadiusArgsSchema = z.object({
  uniqueId: z.string().min(1),
  direction: z.enum(['upstream', 'downstream']).optional(),
  depth: z.number().int().min(1).optional(),
});

export const inspectDbtResourceArgsSchema = z.object({
  uniqueId: z.string().min(1),
  includeSql: z.boolean().optional(),
});

export const optimizeDbtRunArgsSchema = z.object({
  focus: z.enum(['runtime', 'cost', 'balanced']).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export const reviewArtifactSnapshotArgsSchema = z.object({});

export const triageDbtRunMcpArgsSchema = triageDbtRunArgsSchema.extend({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const analyzeModelBlastRadiusMcpArgsSchema = analyzeModelBlastRadiusArgsSchema.extend({
  depth: z.coerce.number().int().min(1).optional(),
});

export const inspectDbtResourceMcpArgsSchema = inspectDbtResourceArgsSchema.extend({
  includeSql: z.coerce.boolean().optional(),
});

export const optimizeDbtRunMcpArgsSchema = optimizeDbtRunArgsSchema.extend({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export function buildTriageDbtRunMessages(
  args: z.infer<typeof triageDbtRunArgsSchema>,
): PromptMessage[] {
  const focus = args.focus ?? 'all';
  const limit = args.limit ?? 10;
  return [
    {
      role: 'user' as const,
      content: {
        type: 'text' as const,
        text: [
          'Investigate the currently loaded dbt run and prioritize failures and bottlenecks.',
          '',
          `Focus: ${focus}. Discuss at most ${limit} nodes.`,
          '',
          'Steps:',
          '1. Call dbt_tools_status or read dbt-tools://status.',
          '2. If no target is configured, tell the user to run dbt_tools_set_target.',
          '3. Call dbt_tools_get_run_summary or read dbt-tools://runs/current/summary.',
          '4. Use dbt_tools_query_executions for failures, skipped nodes, and slow nodes.',
          '5. For warehouse-specific cost/runtime focus, use adapter blocks on query_executions when supported.',
          '6. Recommend dbt-tools://resources/{uniqueId} reads for follow-up inspection.',
          '',
          NO_DBT_EXECUTION_LINE,
        ].join('\n'),
      },
    },
  ];
}

export function buildAnalyzeModelBlastRadiusMessages(
  args: z.infer<typeof analyzeModelBlastRadiusArgsSchema>,
): PromptMessage[] {
  const direction = args.direction ?? 'downstream';
  const depthLine = args.depth != null ? `Limit traversal depth to ${args.depth}.` : '';
  return [
    {
      role: 'user' as const,
      content: {
        type: 'text' as const,
        text: [
          `Review ${direction} blast radius for dbt resource ${args.uniqueId}.`,
          depthLine,
          '',
          'Steps:',
          '1. Check dbt-tools://status or dbt_tools_status.',
          '2. Call dbt_tools_get_resource or read dbt-tools://resources/{uniqueId}.',
          `3. Call dbt_tools_query_dependencies or read dbt-tools://resources/${args.uniqueId}/dependencies/${direction}.`,
          '4. Highlight critical downstream models, tests, and exposures when present.',
          '5. Explain rollout risk and suggest validation steps.',
          '',
          NO_DBT_EXECUTION_LINE,
        ]
          .filter(Boolean)
          .join('\n'),
      },
    },
  ];
}

export function buildInspectDbtResourceMessages(
  args: z.infer<typeof inspectDbtResourceArgsSchema>,
): PromptMessage[] {
  const sqlLine = args.includeSql
    ? `4. Read SQL via dbt-tools://resources/${args.uniqueId}/sql/raw or /sql/compiled as needed.`
    : '4. Do not fetch SQL unless the user asks.';
  return [
    {
      role: 'user' as const,
      content: {
        type: 'text' as const,
        text: [
          `Gather a compact review packet for ${args.uniqueId}.`,
          '',
          'Steps:',
          '1. Read dbt-tools://resources/{uniqueId} or call dbt_tools_get_resource.',
          '2. Confirm dbt_tools_status shows a bound target.',
          '3. Note resource type, status, and execution metrics from the metadata.',
          sqlLine,
          '5. Query upstream and downstream via dbt_tools_query_dependencies.',
          '6. Use dbt_tools_query_executions when execution context helps.',
          '7. Summarize purpose, dependencies, performance, and risks.',
          '',
          NO_DBT_EXECUTION_LINE,
        ].join('\n'),
      },
    },
  ];
}

export function buildOptimizeDbtRunMessages(
  args: z.infer<typeof optimizeDbtRunArgsSchema>,
): PromptMessage[] {
  const focus = args.focus ?? 'balanced';
  const limit = args.limit ?? 10;
  return [
    {
      role: 'user' as const,
      content: {
        type: 'text' as const,
        text: [
          `Identify high-value optimization opportunities (focus: ${focus}, up to ${limit} candidates).`,
          '',
          'Steps:',
          '1. Read dbt-tools://runs/current/summary or dbt_tools_get_run_summary.',
          '2. Rank slow resources with dbt_tools_query_executions.',
          '3. Rank warehouse metric leaders when the adapter supports them.',
          '4. Explain evidence vs hypotheses for each candidate.',
          '5. Recommend manual validation before code changes.',
          '',
          NO_DBT_EXECUTION_LINE,
        ].join('\n'),
      },
    },
  ];
}

export function buildReviewArtifactSnapshotMessages(): PromptMessage[] {
  return [
    {
      role: 'user' as const,
      content: {
        type: 'text' as const,
        text: [
          'Confirm artifact snapshot health and freshness.',
          '',
          'Steps:',
          '1. Read dbt-tools://status or call dbt_tools_status.',
          '2. Explain target, run id, loaded time, stale flag, version token, warehouse type, and cache state.',
          '3. Recommend dbt_tools_refresh when stale or outdated.',
          '4. State whether the server is ready for analysis.',
          '',
          NO_DBT_EXECUTION_LINE,
        ].join('\n'),
      },
    },
  ];
}
