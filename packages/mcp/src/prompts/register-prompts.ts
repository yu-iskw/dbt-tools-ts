import {
  analyzeModelBlastRadiusMcpArgsSchema,
  buildAnalyzeModelBlastRadiusMessages,
  buildInspectDbtResourceMessages,
  buildOptimizeDbtRunMessages,
  buildReviewArtifactSnapshotMessages,
  buildTriageDbtRunMessages,
  inspectDbtResourceMcpArgsSchema,
  optimizeDbtRunMcpArgsSchema,
  reviewArtifactSnapshotArgsSchema,
  triageDbtRunMcpArgsSchema,
} from './prompt-definitions.js';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerDbtToolsPrompts(server: McpServer): void {
  server.registerPrompt(
    'triage_dbt_run',
    {
      title: 'Triage dbt run',
      description: 'Investigate the loaded run: failures, skips, and bottlenecks.',
      argsSchema: triageDbtRunMcpArgsSchema.shape,
    },
    (args) => ({ messages: buildTriageDbtRunMessages(triageDbtRunMcpArgsSchema.parse(args)) }),
  );

  server.registerPrompt(
    'analyze_model_blast_radius',
    {
      title: 'Analyze model blast radius',
      description: 'Review upstream or downstream impact for one dbt resource.',
      argsSchema: analyzeModelBlastRadiusMcpArgsSchema.shape,
    },
    (args) => ({
      messages: buildAnalyzeModelBlastRadiusMessages(
        analyzeModelBlastRadiusMcpArgsSchema.parse(args),
      ),
    }),
  );

  server.registerPrompt(
    'inspect_dbt_resource',
    {
      title: 'Inspect dbt resource',
      description: 'Compact review packet for a single dbt resource.',
      argsSchema: inspectDbtResourceMcpArgsSchema.shape,
    },
    (args) => ({
      messages: buildInspectDbtResourceMessages(inspectDbtResourceMcpArgsSchema.parse(args)),
    }),
  );

  server.registerPrompt(
    'optimize_dbt_run',
    {
      title: 'Optimize dbt run',
      description: 'Find runtime and cost optimization candidates.',
      argsSchema: optimizeDbtRunMcpArgsSchema.shape,
    },
    (args) => ({
      messages: buildOptimizeDbtRunMessages(optimizeDbtRunMcpArgsSchema.parse(args)),
    }),
  );

  server.registerPrompt(
    'review_artifact_snapshot',
    {
      title: 'Review artifact snapshot',
      description: 'Check target binding, freshness, and cache readiness.',
      argsSchema: reviewArtifactSnapshotArgsSchema.shape,
    },
    () => ({ messages: buildReviewArtifactSnapshotMessages() }),
  );
}
