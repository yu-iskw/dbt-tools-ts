#!/usr/bin/env node
import {
  ManifestGraph,
  loadManifest,
  loadCatalog,
  validateSafePath,
  validateDepth,
  validateResourceId,
  shouldOutputJSON,
  formatOutput,
  formatSummary,
  FieldFilter,
  ErrorHandler,
  SQLAnalyzer,
  sqlDialectFromDbtAdapterType,
  getCommandSchema,
  getAllSchemas,
  exportGraphToFormat,
  writeGraphOutput,
  parseAdapterHeavyMetric,
} from '@dbt-tools/core';
import { Command } from 'commander';

import {
  depsAction,
  inventoryAction,
  timelineAction,
  searchAction,
  discoverAction,
  explainAction,
  diagnoseRunAction,
  diagnoseNodeAction,
  exportAction,
  statusAction,
  queryExecutionsAction,
  runSummaryAction,
  runReportAction,
  failuresAction,
  impactAction,
} from './cli-actions';
import { resolveCliArtifactPaths } from './internal/cli-artifact-resolve';
import { registerQueryExecutionsCommand } from './internal/cli-query-executions-register';
import { CLI_PACKAGE_VERSION } from './internal/version';

const program = new Command();

type ArtifactRootFlags = {
  dbtTarget?: string;
};

/** CLI option/argument description constants (avoid no-duplicate-string) */
const OPT_DBT_TARGET = '--dbt-target <string>';
const DESC_DBT_TARGET =
  'Directory with manifest.json + run_results.json, or s3://bucket/prefix / gs://bucket/prefix. Default: DBT_TOOLS_DBT_TARGET env when set.';
const OPT_JSON = '--json';
const DESC_JSON = 'Force JSON output (stdout and structured errors on stderr)';
const OPT_NO_JSON = '--no-json';
const DESC_NO_JSON = 'Force human-readable output';
const OPT_TRACE = '--trace';
const DESC_TRACE = 'Include investigation_transcript in JSON output (discover / intent commands)';
const OPT_FILTER_TYPE = '--type <type>';
const DESC_FILTER_TYPE = 'Filter by resource type(s), comma-separated';
const OPT_FILTER_PACKAGE = '--package <package>';
const DESC_FILTER_PACKAGE = 'Filter by package name';
const OPT_FILTER_TAG = '--tag <tag>';
const DESC_FILTER_TAG = 'Filter by tag(s), comma-separated';
const OPT_FILTER_PATH = '--path <path>';
const DESC_FILTER_PATH = 'Filter by file path substring';
const DESC_ARG_RESOURCE_OR_DISCOVER = 'unique_id or discover query';
const ARG_RESOURCE = '<resource>';
const DESC_GRAPH_FORMAT = 'Export format: json, dot, gexf';
const DEFAULT_GRAPH_FORMAT = 'json';
const OPT_FIELDS = '--fields <fields>';
const DESC_FIELDS = 'Comma-separated list of fields to include';
const OPT_FORMAT = '--format <format>';
const OPT_LIMIT_N = '--limit <n>';
const OPT_OFFSET_N = '--offset <n>';
const DESC_INVENTORY_LIMIT = 'Return at most N entries after filters (max 200); omit for full list';
const DESC_SEARCH_LIMIT = 'Return at most N matches after scoring (max 200); omit for full list';
const DESC_OFFSET_REQUIRES_LIMIT = 'Skip N rows after sort (requires --limit)';
program
  .name('dbt-tools')
  .description('Command-line interface for dbt artifact analysis')
  .version(CLI_PACKAGE_VERSION);

/**
 * Handle errors: structured JSON on stderr only when `preferStructuredErrors`
 * (typically `shouldOutputJSON(--json, --no-json)`).
 */
function handleCliError(error: unknown, preferStructuredErrors: boolean): void {
  const formatted = ErrorHandler.formatError(
    error instanceof Error ? error : new Error(String(error)),
    !preferStructuredErrors,
  );

  if (typeof formatted === 'string') {
    console.error(formatted);
  } else {
    console.error(JSON.stringify(formatted, null, 2));
  }
  process.exit(1);
}

function tryApplyFieldLevelLineageToGraph(
  graph: ManifestGraph,
  manifest: ReturnType<typeof loadManifest>,
  catalogPath: string,
): void {
  validateSafePath(catalogPath);
  let catalog: ReturnType<typeof loadCatalog> | undefined;
  try {
    catalog = loadCatalog(catalogPath);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    if (msg.startsWith('Catalog file not found:')) {
      console.warn(
        'Warning: --field-level requires catalog.json, but it was not found. Falling back to resource-level lineage.',
      );
      return;
    }
    throw error;
  }
  graph.addFieldNodes(catalog);

  const analyzer = new SQLAnalyzer();
  const adapterType = (manifest.metadata as { adapter_type?: string } | undefined)?.adapter_type;
  const sqlDialect = sqlDialectFromDbtAdapterType(adapterType);

  if (manifest.nodes) {
    for (const [uniqueId, node] of Object.entries(manifest.nodes)) {
      const compiledCode = (node as Record<string, unknown>).compiled_code as string | undefined;
      if (compiledCode) {
        const fieldDeps = analyzer.analyze(compiledCode, sqlDialect);
        graph.addFieldEdges(uniqueId, fieldDeps);
      }
    }
  }
}

/**
 * Summary command: Basic summary of project structure
 */
program
  .command('summary')
  .description('Provide summary statistics for dbt manifest')
  .option(OPT_DBT_TARGET, DESC_DBT_TARGET)
  .option(OPT_JSON, DESC_JSON)
  .option(OPT_NO_JSON, DESC_NO_JSON)
  .action(
    async (
      options: ArtifactRootFlags & {
        fields?: string;
        json?: boolean;
        noJson?: boolean;
      },
    ) => {
      try {
        const paths = await resolveCliArtifactPaths(
          {
            dbtTarget: options.dbtTarget,
          },
          { manifest: true, runResults: false },
        );

        // Validate path
        validateSafePath(paths.manifest);

        // Load manifest
        const manifest = loadManifest(paths.manifest);
        const graph = new ManifestGraph(manifest);
        let summary = graph.getSummary();

        // Apply field filtering if requested
        if (options.fields) {
          summary = FieldFilter.filterFields(summary, options.fields) as typeof summary;
        }

        // Format output
        const useJson = shouldOutputJSON(options.json, options.noJson);

        if (useJson) {
          console.log(formatOutput(summary, true));
        } else {
          console.log(formatSummary(summary));
        }
      } catch (error) {
        handleCliError(error, shouldOutputJSON(options.json, options.noJson));
      }
    },
  );

/**
 * Graph export command: Export graph in various formats.
 * Supports optional subgraph focus via --focus, --focus-depth, --focus-direction,
 * and --resource-types.
 */
program
  .command('graph')
  .description('Export dependency graph')
  .option(OPT_FORMAT, DESC_GRAPH_FORMAT, DEFAULT_GRAPH_FORMAT)
  .option('--output <path>', 'Output file path (default: stdout)')
  .option(OPT_DBT_TARGET, DESC_DBT_TARGET)
  .option(OPT_FIELDS, DESC_FIELDS)
  .option('--field-level', 'Include field-level (column-level) lineage')
  .option('--focus <resource-id>', 'Focus on a single node; exports its subgraph only')
  .option(
    '--focus-depth <number>',
    'Max traversal depth for --focus (default: unlimited)',
    parseInt,
  )
  .option(
    '--focus-direction <direction>',
    'Traversal direction for --focus: upstream, downstream, or both (default: both)',
    'both',
  )
  .option(
    '--resource-types <types>',
    'Comma-separated resource types to include (filters nodes when --focus is set)',
  )
  .action(
    async (
      options: ArtifactRootFlags & {
        format?: string;
        output?: string;
        fields?: string;
        fieldLevel?: boolean;
        focus?: string;
        focusDepth?: number;
        focusDirection?: string;
        resourceTypes?: string;
      },
    ) => {
      try {
        // Resolve artifact paths
        const paths = await resolveCliArtifactPaths(
          {
            dbtTarget: options.dbtTarget,
          },
          { manifest: true, runResults: false },
        );

        // Validate path
        validateSafePath(paths.manifest);
        if (options.output) {
          validateSafePath(options.output);
        }

        const focusDirection = (options.focusDirection ?? 'both').toLowerCase();
        if (!['upstream', 'downstream', 'both'].includes(focusDirection)) {
          throw new Error(`--focus-direction must be one of: upstream, downstream, both`);
        }

        if (options.focusDepth !== undefined) {
          validateDepth(options.focusDepth);
        }

        // Load manifest
        const manifest = loadManifest(paths.manifest);
        const graph = new ManifestGraph(manifest);

        // Enhance with field-level lineage if requested
        if (options.fieldLevel && paths.catalog) {
          tryApplyFieldLevelLineageToGraph(graph, manifest, paths.catalog);
        }

        let targetGraph = graph.getGraph();

        // Apply subgraph focus if requested
        if (options.focus) {
          validateResourceId(options.focus);
          const allowedTypes = options.resourceTypes
            ? new Set(
                options.resourceTypes
                  .split(',')
                  .map((t) => t.trim().toLowerCase())
                  .filter(Boolean),
              )
            : undefined;
          targetGraph = graph.buildSubgraph(
            options.focus,
            focusDirection as 'both' | 'downstream' | 'upstream',
            options.focusDepth,
            allowedTypes,
          );
        }

        const output = exportGraphToFormat(targetGraph, {
          format: options.format,
          output: options.output,
          fields: options.fields,
        });
        if (options.output) {
          writeGraphOutput(output, options.output);
        } else {
          console.log(output);
        }
      } catch (error) {
        handleCliError(error, shouldOutputJSON(undefined, undefined));
      }
    },
  );

registerQueryExecutionsCommand(
  program,
  {
    OPT_DBT_TARGET,
    DESC_DBT_TARGET,
    OPT_JSON,
    DESC_JSON,
    OPT_NO_JSON,
    DESC_NO_JSON,
    OPT_FIELDS,
    DESC_FIELDS,
  },
  async (options) => {
    await queryExecutionsAction(options, handleCliError);
  },
);

program
  .command('run-summary')
  .description(
    'Run-level summary, status breakdown, bottlenecks, and adapter totals (no node list)',
  )
  .option(OPT_DBT_TARGET, DESC_DBT_TARGET)
  .option(OPT_FIELDS, DESC_FIELDS)
  .option(OPT_JSON, DESC_JSON)
  .option(OPT_NO_JSON, DESC_NO_JSON)
  .action(
    async (
      options: ArtifactRootFlags & {
        fields?: string;
        json?: boolean;
        noJson?: boolean;
      },
    ) => {
      await runSummaryAction(options, handleCliError);
    },
  );

program
  .command('run-report')
  .description(
    'Execution summary with optional bottlenecks, adapter metrics, and paginated node_executions',
  )
  .option(OPT_DBT_TARGET, DESC_DBT_TARGET)
  .option(OPT_FIELDS, DESC_FIELDS)
  .option('--bottlenecks', 'Include slow-node bottleneck section')
  .option('--bottlenecks-top <n>', 'Top N slow nodes when using --bottlenecks', parseInt)
  .option(
    '--bottlenecks-threshold <seconds>',
    'Nodes slower than threshold (seconds) when using --bottlenecks',
    parseFloat,
  )
  .option('--adapter-summary', 'Include adapter_totals in output')
  .option(
    '--adapter-top-by <metric>',
    'Rank nodes by adapter metric: bytes_billed, bytes_processed, slot_ms, rows_affected, rows_inserted, rows_updated, rows_deleted, rows_duplicated',
  )
  .option('--adapter-top-n <n>', 'Top N nodes for --adapter-top-by', parseInt)
  .option('--adapter-min-bytes <n>', 'Filter adapter metrics by minimum bytes', parseInt)
  .option('--adapter-min-slot-ms <n>', 'Filter adapter metrics by minimum slot_ms', parseInt)
  .option(
    '--adapter-min-rows-affected <n>',
    'Filter adapter metrics by minimum rows_affected',
    parseInt,
  )
  .option('--node-executions-limit <n>', 'Cap node_executions rows in JSON output', parseInt)
  .option('--node-executions-offset <n>', 'Skip rows when using --node-executions-limit', parseInt)
  .option(OPT_JSON, DESC_JSON)
  .option(OPT_NO_JSON, DESC_NO_JSON)
  .action(
    async (
      options: ArtifactRootFlags & {
        fields?: string;
        bottlenecks?: boolean;
        bottlenecksTop?: number;
        bottlenecksThreshold?: number;
        adapterSummary?: boolean;
        adapterTopBy?: string;
        adapterTopN?: number;
        adapterMinBytes?: number;
        adapterMinSlotMs?: number;
        adapterMinRowsAffected?: number;
        nodeExecutionsLimit?: number;
        nodeExecutionsOffset?: number;
        json?: boolean;
        noJson?: boolean;
      },
    ) => {
      await runReportAction(
        {
          dbtTarget: options.dbtTarget,
          fields: options.fields,
          bottlenecks: options.bottlenecks,
          bottlenecksTop: options.bottlenecksTop,
          bottlenecksThreshold: options.bottlenecksThreshold,
          adapterSummary: options.adapterSummary,
          adapterTopBy: parseAdapterHeavyMetric(options.adapterTopBy),
          adapterTopN: options.adapterTopN,
          adapterMinBytes: options.adapterMinBytes,
          adapterMinSlotMs: options.adapterMinSlotMs,
          adapterMinRowsAffected: options.adapterMinRowsAffected,
          nodeExecutionsLimit: options.nodeExecutionsLimit,
          nodeExecutionsOffset: options.nodeExecutionsOffset,
          json: options.json,
          noJson: options.noJson,
        },
        handleCliError,
      );
    },
  );

program
  .command('failures')
  .description('Bounded list of non-successful run_results rows for triage and agents')
  .option(OPT_DBT_TARGET, DESC_DBT_TARGET)
  .option(OPT_FIELDS, DESC_FIELDS)
  .option('--status <status>', 'Filter by status (comma-separated, e.g. error,warn)')
  .option(OPT_LIMIT_N, 'Max failures to return (default 50, max 200)', parseInt)
  .option(OPT_OFFSET_N, DESC_OFFSET_REQUIRES_LIMIT, parseInt)
  .option('--message-max-chars <n>', 'Truncate message fields (default 4000)', parseInt)
  .option('--include-path', 'Include resource path fields in output')
  .option('--include-compiled', 'Include compiled_code in output')
  .option('--compiled-max-chars <n>', 'Truncate compiled_code (default 8000)', parseInt)
  .option(OPT_JSON, DESC_JSON)
  .option(OPT_NO_JSON, DESC_NO_JSON)
  .action(
    async (
      options: ArtifactRootFlags & {
        fields?: string;
        status?: string;
        limit?: number;
        offset?: number;
        messageMaxChars?: number;
        includePath?: boolean;
        includeCompiled?: boolean;
        compiledMaxChars?: number;
        json?: boolean;
        noJson?: boolean;
      },
    ) => {
      await failuresAction(options, handleCliError);
    },
  );

program
  .command('impact')
  .description('Intent: upstream/downstream impact counts and critical dependents for a resource')
  .argument(ARG_RESOURCE, DESC_ARG_RESOURCE_OR_DISCOVER)
  .option(OPT_FIELDS, DESC_FIELDS)
  .option(OPT_DBT_TARGET, DESC_DBT_TARGET)
  .option(OPT_JSON, DESC_JSON)
  .option(OPT_NO_JSON, DESC_NO_JSON)
  .option(OPT_TRACE, DESC_TRACE)
  .action(
    async (
      resource: string,
      options: ArtifactRootFlags & {
        fields?: string;
        json?: boolean;
        noJson?: boolean;
        trace?: boolean;
      },
    ) => {
      await impactAction(resource, options, handleCliError);
    },
  );

/**
 * Deps command: Get upstream or downstream dependencies
 */
program
  .command('deps')
  .description('Get upstream or downstream dependencies for a dbt resource')
  .argument('<resource-id>', 'Unique ID of the dbt resource (e.g., model.my_project.customers)')
  .option('--direction <direction>', 'Direction: upstream or downstream', 'downstream')
  .option(OPT_DBT_TARGET, DESC_DBT_TARGET)
  .option(OPT_FIELDS, DESC_FIELDS)
  .option('--field <name>', 'Specific field (column) to trace dependencies for')
  .option(
    '--depth <number>',
    'Max traversal depth; 1 = immediate neighbors, omit for all levels',
    parseInt,
  )
  .option(OPT_FORMAT, 'Output structure: flat list or nested tree', 'tree')
  .option(
    '--build-order',
    'Output upstream dependencies in topological build order (only with --direction upstream)',
  )
  .option(OPT_JSON, DESC_JSON)
  .option(OPT_NO_JSON, DESC_NO_JSON)
  .action(
    async (
      resourceId: string,
      options: ArtifactRootFlags & {
        direction?: string;
        fields?: string;
        field?: string;
        depth?: number;
        format?: string;
        buildOrder?: boolean;
        json?: boolean;
        noJson?: boolean;
      },
    ) => {
      await depsAction(resourceId, options, handleCliError);
    },
  );

/**
 * Inventory command: List and filter dbt resources from manifest
 */
program
  .command('inventory')
  .description('List and filter dbt resources from manifest')
  .option(OPT_FILTER_TYPE, DESC_FILTER_TYPE)
  .option(OPT_FILTER_PACKAGE, DESC_FILTER_PACKAGE)
  .option(OPT_FILTER_TAG, DESC_FILTER_TAG)
  .option(OPT_FILTER_PATH, DESC_FILTER_PATH)
  .option(OPT_FIELDS, DESC_FIELDS)
  .option(OPT_LIMIT_N, DESC_INVENTORY_LIMIT, parseInt)
  .option(OPT_OFFSET_N, DESC_OFFSET_REQUIRES_LIMIT, parseInt)
  .option(OPT_DBT_TARGET, DESC_DBT_TARGET)
  .option(OPT_JSON, DESC_JSON)
  .option(OPT_NO_JSON, DESC_NO_JSON)
  .action(
    async (
      options: ArtifactRootFlags & {
        type?: string;
        package?: string;
        tag?: string;
        path?: string;
        fields?: string;
        limit?: number;
        offset?: number;
        json?: boolean;
        noJson?: boolean;
      },
    ) => {
      await inventoryAction(options, handleCliError);
    },
  );

/**
 * Timeline command: Per-node execution entries from run_results.json
 */
program
  .command('timeline')
  .description(
    'Show per-node execution timeline from run_results.json (row-level; use query-executions for ranked filters)',
  )
  .option(OPT_DBT_TARGET, DESC_DBT_TARGET)
  .option(
    '--sort <key>',
    'Sort key: duration | start | query_id | adapter_code | adapter_message | bytes_processed | bytes_billed | slot_ms | rows_affected | rows_inserted | rows_updated | rows_deleted | rows_duplicated',
    'duration',
  )
  .option('--top <n>', 'Show top N entries only', parseInt)
  .option('--failed-only', 'Show only non-successful executions')
  .option('--status <status>', 'Filter by status (comma-separated, e.g. error,warn)')
  .option(
    '--adapter-text <text>',
    'Filter by normalized adapter text (query ID, code, message, location, project)',
  )
  .option(OPT_FORMAT, 'Output format: json (default non-TTY), table (default TTY), csv')
  .option(OPT_JSON, DESC_JSON)
  .option(OPT_NO_JSON, DESC_NO_JSON)
  .action(
    async (
      options: ArtifactRootFlags & {
        sort?: string;
        top?: number;
        failedOnly?: boolean;
        status?: string;
        adapterText?: string;
        format?: string;
        json?: boolean;
        noJson?: boolean;
      },
    ) => {
      await timelineAction(options, handleCliError);
    },
  );

/**
 * Search command: Fast manifest search across dbt entities
 */
program
  .command('search')
  .description('Search for dbt resources by name, tag, type, or free text')
  .argument('[query]', 'Search query; supports key:value tokens like type:model tag:finance')
  .option(OPT_FILTER_TYPE, DESC_FILTER_TYPE)
  .option(OPT_FILTER_PACKAGE, DESC_FILTER_PACKAGE)
  .option(OPT_FILTER_TAG, DESC_FILTER_TAG)
  .option(OPT_FILTER_PATH, DESC_FILTER_PATH)
  .option(OPT_FIELDS, DESC_FIELDS)
  .option(OPT_LIMIT_N, DESC_SEARCH_LIMIT, parseInt)
  .option(OPT_OFFSET_N, DESC_OFFSET_REQUIRES_LIMIT, parseInt)
  .option(OPT_DBT_TARGET, DESC_DBT_TARGET)
  .option(OPT_JSON, DESC_JSON)
  .option(OPT_NO_JSON, DESC_NO_JSON)
  .action(
    async (
      query: string | undefined,
      options: ArtifactRootFlags & {
        type?: string;
        package?: string;
        tag?: string;
        path?: string;
        fields?: string;
        limit?: number;
        offset?: number;
        json?: boolean;
        noJson?: boolean;
      },
    ) => {
      await searchAction(query, options, handleCliError);
    },
  );

/**
 * Discover command: Ranked resource discovery with reasons, related nodes, and next actions
 */
program
  .command('discover')
  .description(
    'Artifact-grounded discovery with scores, reasons, disambiguation, and suggested follow-ups',
  )
  .argument(
    '[query]',
    'Search query (same token syntax as search: type:, tag:, …); omit or pass "" when using filters only',
  )
  .option(OPT_FILTER_TYPE, DESC_FILTER_TYPE)
  .option(OPT_FILTER_PACKAGE, DESC_FILTER_PACKAGE)
  .option(OPT_FILTER_TAG, DESC_FILTER_TAG)
  .option(OPT_FILTER_PATH, DESC_FILTER_PATH)
  .option(OPT_LIMIT_N, 'Max matches (default 50, max 200)', parseInt)
  .option(OPT_FIELDS, DESC_FIELDS)
  .option(OPT_DBT_TARGET, DESC_DBT_TARGET)
  .option(OPT_JSON, DESC_JSON)
  .option(OPT_NO_JSON, DESC_NO_JSON)
  .option(OPT_TRACE, DESC_TRACE)
  .action(
    async (
      query: string | undefined,
      options: ArtifactRootFlags & {
        type?: string;
        package?: string;
        tag?: string;
        path?: string;
        limit?: number;
        fields?: string;
        json?: boolean;
        noJson?: boolean;
        trace?: boolean;
      },
    ) => {
      await discoverAction(query, options, handleCliError);
    },
  );

/**
 * Explain intent: resolved resource summary (compiles to discover + manifest fields)
 */
program
  .command('explain')
  .description('Summarize a resource (intent; resolves short names via discover)')
  .argument(ARG_RESOURCE, DESC_ARG_RESOURCE_OR_DISCOVER)
  .option(OPT_FIELDS, DESC_FIELDS)
  .option(OPT_DBT_TARGET, DESC_DBT_TARGET)
  .option(OPT_JSON, DESC_JSON)
  .option(OPT_NO_JSON, DESC_NO_JSON)
  .option(OPT_TRACE, DESC_TRACE)
  .action(
    async (
      resource: string,
      options: ArtifactRootFlags & {
        fields?: string;
        json?: boolean;
        noJson?: boolean;
        trace?: boolean;
      },
    ) => {
      await explainAction(resource, options, handleCliError);
    },
  );

const diagnoseCmd = program
  .command('diagnose')
  .description(
    'Operational diagnosis facade (points to runSummary, query-executions, timeline, deps primitives)',
  );

diagnoseCmd
  .command('run')
  .description('Diagnose the current run (execution-focused primitives)')
  .option(OPT_FIELDS, DESC_FIELDS)
  .option(OPT_DBT_TARGET, DESC_DBT_TARGET)
  .option(OPT_JSON, DESC_JSON)
  .option(OPT_NO_JSON, DESC_NO_JSON)
  .action(
    async (
      options: ArtifactRootFlags & {
        fields?: string;
        json?: boolean;
        noJson?: boolean;
      },
    ) => {
      await diagnoseRunAction(options, handleCliError);
    },
  );

diagnoseCmd
  .command('node')
  .description('Diagnose a specific resource (deps + run-summary / query-executions primitives)')
  .argument(ARG_RESOURCE, DESC_ARG_RESOURCE_OR_DISCOVER)
  .option(OPT_FIELDS, DESC_FIELDS)
  .option(OPT_DBT_TARGET, DESC_DBT_TARGET)
  .option(OPT_JSON, DESC_JSON)
  .option(OPT_NO_JSON, DESC_NO_JSON)
  .action(
    async (
      resource: string,
      options: ArtifactRootFlags & {
        fields?: string;
        json?: boolean;
        noJson?: boolean;
      },
    ) => {
      await diagnoseNodeAction(resource, options, handleCliError);
    },
  );

/**
 * Export intent: graph export with a normalized JSON envelope
 */
program
  .command('export')
  .description('Export dependency graph (intent wrapper over graph export)')
  .option(OPT_FORMAT, DESC_GRAPH_FORMAT, DEFAULT_GRAPH_FORMAT)
  .option('--output <path>', 'Output file path (when omitted, stdout)')
  .option(OPT_DBT_TARGET, DESC_DBT_TARGET)
  .option(OPT_FIELDS, DESC_FIELDS)
  .option('--focus <resource-id>', 'Export subgraph centered on this node')
  .option('--focus-depth <number>', 'Max depth for --focus', parseInt)
  .option('--focus-direction <direction>', 'upstream | downstream | both (default: both)', 'both')
  .option(OPT_JSON, DESC_JSON)
  .option(OPT_NO_JSON, DESC_NO_JSON)
  .action(
    async (
      options: ArtifactRootFlags & {
        format?: string;
        output?: string;
        fields?: string;
        focus?: string;
        focusDepth?: number;
        focusDirection?: string;
        json?: boolean;
        noJson?: boolean;
      },
    ) => {
      await exportAction(options, handleCliError);
    },
  );

/**
 * Status command: Report artifact presence, freshness, and readiness
 */
program
  .command('status')
  .description('Report dbt artifact presence, modification times, and analysis readiness')
  .option(OPT_DBT_TARGET, DESC_DBT_TARGET)
  .option(OPT_JSON, DESC_JSON)
  .option(OPT_NO_JSON, DESC_NO_JSON)
  .action(
    async (
      options: ArtifactRootFlags & {
        json?: boolean;
        noJson?: boolean;
      },
    ) => {
      await statusAction(options, handleCliError);
    },
  );

/**
 * Freshness command: Alias for status with freshness framing
 */
program
  .command('freshness')
  .description('Alias for status – shows artifact recency and readiness')
  .option(OPT_DBT_TARGET, DESC_DBT_TARGET)
  .option(OPT_JSON, DESC_JSON)
  .option(OPT_NO_JSON, DESC_NO_JSON)
  .action(
    async (
      options: ArtifactRootFlags & {
        json?: boolean;
        noJson?: boolean;
      },
    ) => {
      await statusAction(options, handleCliError);
    },
  );

/**
 * Schema command: Get command schema for introspection
 */
program
  .command('schema')
  .description('Get machine-readable schema for a command')
  .argument('[command]', 'Command name (if omitted, returns all command schemas)')
  .option('--json', 'Force JSON output (always JSON by default)')
  .action((command: string | undefined, _options: { json?: boolean }) => {
    try {
      let result: unknown;

      if (command) {
        const schema = getCommandSchema(command);
        if (!schema) {
          throw new Error(`Unknown command: ${command}`);
        }
        result = schema;
      } else {
        result = getAllSchemas();
      }

      // Schema command always outputs JSON
      console.log(formatOutput(result, true));
    } catch (error) {
      handleCliError(error, false);
    }
  });

export { program };

// Parse command line arguments when executed as the CLI entrypoint.
if (require.main === module) {
  program.parse();
}
