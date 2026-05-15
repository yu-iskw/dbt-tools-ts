import { COMMAND_STABILITY, type StabilityLevel } from './command-stability';

/**
 * Command schema definition for runtime introspection
 */
export interface CommandSchema {
  command: string;
  description: string;
  arguments: Array<{
    name: string;
    required: boolean;
    description: string;
  }>;
  options: Array<{
    name: string;
    type: string;
    values?: string[];
    default?: string;
    description: string;
  }>;
  output_format: string;
  example: string;
  stability?: StabilityLevel;
}

type SchemaOption = {
  name: string;
  type: string;
  values?: string[];
  default?: string;
  description: string;
};

const OPT_DBT_TARGET = '--dbt-target';
const OPT_STDOUT_FORMAT = '--format';
const OPT_TRACE = '--trace';
const TYPE_STRING = 'string';
const TYPE_BOOLEAN = 'boolean';
const TYPE_NUMBER = 'number';
const OUTPUT_JSON_OR_TEXT = 'json (default) or text';
const DESC_STDOUT_FORMAT =
  'Stdout format: json (default) or text; json uses structured errors on stderr.';
const DESC_DBT_TARGET =
  'Directory containing manifest.json + run_results.json, or s3://bucket/prefix / gs://bucket/prefix. When omitted, uses DBT_TOOLS_DBT_TARGET if set.';
const DESC_TRACE = 'Include investigation_transcript in JSON output (intent / discover)';
const DESC_SCHEMA_FILTER_PACKAGE = 'Filter by package name';
const DESC_SCHEMA_FILTER_TAG = 'Filter by tag(s), comma-separated';
const DESC_SCHEMA_FILTER_PATH = 'Filter by file path substring';
const DESC_SCHEMA_ARG_UNIQUE_DISCOVER = 'unique_id or discover query string';
const DESC_FIELDS = 'Comma-separated list of fields to include in response (e.g., unique_id,name)';

function getArtifactRootCliSchemaOptions(): SchemaOption[] {
  return [
    {
      name: OPT_DBT_TARGET,
      type: TYPE_STRING,
      description: DESC_DBT_TARGET,
    },
  ];
}

function getStdoutFormatSchemaOptions(): SchemaOption[] {
  return [
    {
      name: OPT_STDOUT_FORMAT,
      type: 'enum',
      values: ['json', 'text'],
      default: 'json',
      description: DESC_STDOUT_FORMAT,
    },
  ];
}

function getSummarySchema(): CommandSchema {
  return {
    command: 'summary',
    description: 'Provide summary statistics for dbt manifest',
    arguments: [],
    options: [
      {
        name: '--fields',
        type: TYPE_STRING,
        description: DESC_FIELDS,
      },
      ...getStdoutFormatSchemaOptions(),
      ...getArtifactRootCliSchemaOptions(),
    ],
    output_format: OUTPUT_JSON_OR_TEXT,
    example: 'dbt-tools summary --dbt-target ./target',
  };
}

function getGraphSchema(): CommandSchema {
  return {
    command: 'graph',
    description: 'Export dependency graph in various formats',
    arguments: [],
    options: [
      {
        name: '--format',
        type: 'enum',
        values: ['json', 'dot', 'gexf'],
        default: 'json',
        description: 'Export format',
      },
      {
        name: '--output',
        type: TYPE_STRING,
        description: 'Output file path (default: stdout)',
      },
      {
        name: '--fields',
        type: TYPE_STRING,
        description: DESC_FIELDS,
      },
      {
        name: '--field-level',
        type: TYPE_BOOLEAN,
        description: 'Include field-level (column-level) lineage',
      },
      {
        name: '--focus',
        type: TYPE_STRING,
        description: 'Focus on a single node (unique_id); exports only its subgraph',
      },
      {
        name: '--focus-depth',
        type: 'number',
        description: 'Max traversal hops for --focus (default: unlimited)',
      },
      {
        name: '--focus-direction',
        type: 'enum',
        values: ['upstream', 'downstream', 'both'],
        default: 'both',
        description: 'Traversal direction for --focus',
      },
      {
        name: '--resource-types',
        type: TYPE_STRING,
        description:
          'Comma-separated resource types to keep in the subgraph (e.g. model,test); focus node is always included',
      },
      ...getArtifactRootCliSchemaOptions(),
    ],
    output_format: 'json, dot, or gexf',
    example: 'dbt-tools graph --focus model.my_project.orders --focus-depth 2',
  };
}

function getRunReportSchema(): CommandSchema {
  return {
    command: 'run-report',
    description: 'Generate execution report from run_results.json',
    arguments: [],
    options: [
      {
        name: '--fields',
        type: TYPE_STRING,
        description: DESC_FIELDS,
      },
      {
        name: '--bottlenecks',
        type: TYPE_BOOLEAN,
        description: 'Include bottleneck section in report',
      },
      {
        name: '--bottlenecks-top',
        type: 'number',
        default: '10',
        description: 'Top N slowest nodes (default: 10 when --bottlenecks)',
      },
      {
        name: '--bottlenecks-threshold',
        type: 'number',
        description: 'Nodes exceeding N seconds (alternative to top-N)',
      },
      {
        name: '--adapter-summary',
        type: TYPE_BOOLEAN,
        description: 'Include adapter_response aggregates (human default top-5 slot/bytes)',
      },
      {
        name: '--adapter-top-by',
        type: TYPE_STRING,
        values: ['bytes_processed', 'slot_ms', 'rows_affected'],
        description: 'Rank nodes by adapter metric',
      },
      {
        name: '--adapter-top-n',
        type: 'number',
        default: '10',
        description: 'Top N for --adapter-top-by',
      },
      {
        name: '--adapter-min-bytes',
        type: 'number',
        description: 'With --adapter-top-by, require bytes_processed >= n',
      },
      {
        name: '--adapter-min-slot-ms',
        type: 'number',
        description: 'With --adapter-top-by, require slot_ms >= n',
      },
      {
        name: '--node-executions-limit',
        type: TYPE_NUMBER,
        description:
          'When set, cap node_executions in JSON (stable sort); summary metrics still use full run',
      },
      {
        name: '--node-executions-offset',
        type: TYPE_NUMBER,
        description:
          'Skip N node_executions rows before --node-executions-limit (requires --node-executions-limit)',
      },
      ...getStdoutFormatSchemaOptions(),
      ...getArtifactRootCliSchemaOptions(),
    ],
    output_format: OUTPUT_JSON_OR_TEXT,
    example: 'dbt-tools run-report --dbt-target ./target --bottlenecks',
  };
}

function getDepsSchemaOptions(): SchemaOption[] {
  return [
    {
      name: '--direction',
      type: 'enum',
      values: ['upstream', 'downstream'],
      default: 'downstream',
      description: 'Direction of dependency traversal',
    },
    {
      name: '--fields',
      type: TYPE_STRING,
      description: DESC_FIELDS,
    },
    {
      name: '--field',
      type: TYPE_STRING,
      description: 'Specific field (column) to trace dependencies for',
    },
    {
      name: '--depth',
      type: 'number',
      description: 'Max traversal depth; 1 = immediate neighbors, omit for all levels',
    },
    {
      name: '--layout',
      type: 'enum',
      values: ['flat', 'tree'],
      default: 'tree',
      description: 'Dependency listing: flat list or nested tree',
    },
    {
      name: '--build-order',
      type: TYPE_BOOLEAN,
      description:
        'Output upstream dependencies in topological build order (only with --direction upstream)',
    },
    ...getStdoutFormatSchemaOptions(),
    ...getArtifactRootCliSchemaOptions(),
  ];
}

function getDepsSchema(): CommandSchema {
  return {
    command: 'deps',
    description: 'Get upstream or downstream dependencies for a dbt resource',
    arguments: [
      {
        name: 'resource-id',
        required: true,
        description: 'Unique ID of the dbt resource (e.g., model.my_project.customers)',
      },
    ],
    options: getDepsSchemaOptions(),
    output_format: OUTPUT_JSON_OR_TEXT,
    example: 'dbt-tools deps model.my_project.customers --direction downstream',
  };
}

function getSchemaCommandSchema(): CommandSchema {
  return {
    command: 'schema',
    description: 'Get machine-readable schema for a command',
    arguments: [
      {
        name: 'command',
        required: false,
        description: 'Command name (if omitted, returns all command schemas)',
      },
    ],
    options: [],
    output_format: 'json',
    example: 'dbt-tools schema deps',
  };
}

/**
 * Get schema for a specific command
 */
export function getCommandSchema(command: string): CommandSchema | null {
  const schemas = getAllSchemas();
  return schemas[command] || null;
}

function getInventorySchema(): CommandSchema {
  return {
    command: 'inventory',
    description: 'List and filter dbt resources from manifest',
    arguments: [],
    options: [
      {
        name: '--type',
        type: TYPE_STRING,
        description: 'Filter by resource type(s), comma-separated (e.g. model,test)',
      },
      {
        name: '--package',
        type: TYPE_STRING,
        description: DESC_SCHEMA_FILTER_PACKAGE,
      },
      {
        name: '--tag',
        type: TYPE_STRING,
        description: DESC_SCHEMA_FILTER_TAG,
      },
      {
        name: '--path',
        type: TYPE_STRING,
        description: DESC_SCHEMA_FILTER_PATH,
      },
      {
        name: '--fields',
        type: TYPE_STRING,
        description: DESC_FIELDS,
      },
      {
        name: '--limit',
        type: TYPE_NUMBER,
        description: 'Return at most N entries after filters (max 200)',
      },
      {
        name: '--offset',
        type: TYPE_NUMBER,
        description: 'Skip N entries after sort (requires --limit)',
      },
      ...getStdoutFormatSchemaOptions(),
      ...getArtifactRootCliSchemaOptions(),
    ],
    output_format: OUTPUT_JSON_OR_TEXT,
    example: 'dbt-tools inventory --dbt-target ./target --type model --tag finance',
  };
}

function getFailuresSchema(): CommandSchema {
  return {
    command: 'failures',
    description:
      'List non-successful nodes from run_results.json with optional manifest enrichment and suggested follow-up commands',
    arguments: [],
    options: [
      {
        name: '--status',
        type: TYPE_STRING,
        description: 'Comma-separated statuses to include (default: all except success and pass)',
      },
      {
        name: '--limit',
        type: TYPE_NUMBER,
        description: 'Max rows returned (default 50, max 200)',
      },
      {
        name: '--offset',
        type: TYPE_NUMBER,
        description: 'Skip N rows after sort (paging; default limit still applies)',
      },
      {
        name: '--message-max-chars',
        type: TYPE_NUMBER,
        description: 'Truncate message field beyond N characters',
      },
      {
        name: '--include-path',
        type: TYPE_BOOLEAN,
        description: 'Add path, original_file_path, and resource_type from manifest when available',
      },
      {
        name: '--include-compiled',
        type: TYPE_BOOLEAN,
        description: 'Include compiled_code and raw_code snippets from manifest (capped)',
      },
      {
        name: '--compiled-max-chars',
        type: TYPE_NUMBER,
        description: 'Max characters per compiled/raw snippet when --include-compiled is set',
      },
      {
        name: '--fields',
        type: TYPE_STRING,
        description: DESC_FIELDS,
      },
      ...getStdoutFormatSchemaOptions(),
      ...getArtifactRootCliSchemaOptions(),
    ],
    output_format: OUTPUT_JSON_OR_TEXT,
    example: 'dbt-tools failures --dbt-target ./target --limit 20',
  };
}

function getTimelineSchema(): CommandSchema {
  return {
    command: 'timeline',
    description:
      'Show per-node execution timeline from run_results.json (row-level entries, unlike run-report)',
    arguments: [],
    options: [
      {
        name: '--sort',
        type: 'enum',
        values: ['duration', 'start'],
        default: 'duration',
        description: 'Sort order for entries',
      },
      {
        name: '--top',
        type: 'number',
        description: 'Show top N entries only',
      },
      {
        name: '--failed-only',
        type: TYPE_BOOLEAN,
        description: 'Show only non-successful executions',
      },
      {
        name: '--status',
        type: TYPE_STRING,
        description: 'Filter by status (comma-separated, e.g. error,warn)',
      },
      {
        name: OPT_STDOUT_FORMAT,
        type: 'enum',
        values: ['json', 'table', 'csv'],
        default: 'json',
        description: 'Output format: json (default), table, or csv',
      },
      ...getArtifactRootCliSchemaOptions(),
    ],
    output_format: 'json, table, or csv',
    example: 'dbt-tools timeline --dbt-target ./target --sort duration --top 20 --failed-only',
  };
}

function getDiscoverSchema(): CommandSchema {
  return {
    command: 'discover',
    description:
      'Ranked, explainable discovery over manifest resources (scores, reasons, related, next actions)',
    arguments: [
      {
        name: 'query',
        required: false,
        description:
          'Search query; supports key:value tokens like type:model tag:finance. May be empty when --type/--package/--tag/--path is set.',
      },
    ],
    options: [
      {
        name: '--type',
        type: TYPE_STRING,
        description: 'Filter by resource type(s), comma-separated',
      },
      {
        name: '--package',
        type: TYPE_STRING,
        description: DESC_SCHEMA_FILTER_PACKAGE,
      },
      {
        name: '--tag',
        type: TYPE_STRING,
        description: DESC_SCHEMA_FILTER_TAG,
      },
      {
        name: '--path',
        type: TYPE_STRING,
        description: DESC_SCHEMA_FILTER_PATH,
      },
      {
        name: '--limit',
        type: TYPE_NUMBER,
        description: 'Max matches (default 50, max 200)',
      },
      {
        name: '--fields',
        type: TYPE_STRING,
        description: DESC_FIELDS,
      },
      ...getStdoutFormatSchemaOptions(),
      { name: OPT_TRACE, type: TYPE_BOOLEAN, description: DESC_TRACE },
      ...getArtifactRootCliSchemaOptions(),
    ],
    output_format: OUTPUT_JSON_OR_TEXT,
    example: 'dbt-tools discover --dbt-target ./target "orders"',
  };
}

function getExplainSchema(): CommandSchema {
  return {
    command: 'explain',
    description:
      'Intent: summarize a resource (resolves short names via discover, then reads manifest graph fields)',
    arguments: [
      {
        name: 'resource',
        required: true,
        description: DESC_SCHEMA_ARG_UNIQUE_DISCOVER,
      },
    ],
    options: [
      {
        name: '--fields',
        type: TYPE_STRING,
        description: DESC_FIELDS,
      },
      ...getStdoutFormatSchemaOptions(),
      { name: OPT_TRACE, type: TYPE_BOOLEAN, description: DESC_TRACE },
      ...getArtifactRootCliSchemaOptions(),
    ],
    output_format: OUTPUT_JSON_OR_TEXT,
    example: 'dbt-tools explain --dbt-target ./target model.my_pkg.orders',
  };
}

function getImpactSchema(): CommandSchema {
  return {
    command: 'impact',
    description: 'Intent: upstream/downstream counts and notable downstream models (deps-based)',
    arguments: [
      {
        name: 'resource',
        required: true,
        description: DESC_SCHEMA_ARG_UNIQUE_DISCOVER,
      },
    ],
    options: [
      {
        name: '--fields',
        type: TYPE_STRING,
        description: DESC_FIELDS,
      },
      ...getStdoutFormatSchemaOptions(),
      { name: OPT_TRACE, type: TYPE_BOOLEAN, description: DESC_TRACE },
      ...getArtifactRootCliSchemaOptions(),
    ],
    output_format: OUTPUT_JSON_OR_TEXT,
    example: 'dbt-tools impact --dbt-target ./target model.my_pkg.orders',
  };
}

function getDiagnoseRunSchema(): CommandSchema {
  return {
    command: 'diagnose run',
    description: 'Intent: run-level diagnosis facade (primitive commands: run-report, timeline)',
    arguments: [],
    options: [
      {
        name: '--fields',
        type: TYPE_STRING,
        description: DESC_FIELDS,
      },
      ...getStdoutFormatSchemaOptions(),
      ...getArtifactRootCliSchemaOptions(),
    ],
    output_format: OUTPUT_JSON_OR_TEXT,
    example: 'dbt-tools diagnose run --dbt-target ./target',
  };
}

function getDiagnoseNodeSchema(): CommandSchema {
  return {
    command: 'diagnose node',
    description:
      'Intent: resource-level diagnosis facade (primitive commands: run-report, deps, explain)',
    arguments: [
      {
        name: 'resource',
        required: true,
        description: DESC_SCHEMA_ARG_UNIQUE_DISCOVER,
      },
    ],
    options: [
      {
        name: '--fields',
        type: TYPE_STRING,
        description: DESC_FIELDS,
      },
      ...getStdoutFormatSchemaOptions(),
      ...getArtifactRootCliSchemaOptions(),
    ],
    output_format: OUTPUT_JSON_OR_TEXT,
    example: 'dbt-tools diagnose node --dbt-target ./target model.my_pkg.orders',
  };
}

function getExportIntentSchema(): CommandSchema {
  return {
    command: 'export',
    description:
      'Intent: export dependency graph with a normalized JSON envelope (wraps graph export)',
    arguments: [],
    options: [
      {
        name: '--format',
        type: 'enum',
        values: ['json', 'dot', 'gexf'],
        description: 'Export format',
      },
      { name: '--output', type: TYPE_STRING, description: 'Output file path' },
      {
        name: '--focus',
        type: TYPE_STRING,
        description: 'Center subgraph on this unique_id',
      },
      {
        name: '--focus-depth',
        type: TYPE_NUMBER,
        description: 'Max traversal depth for --focus',
      },
      {
        name: '--focus-direction',
        type: TYPE_STRING,
        description: 'upstream | downstream | both',
      },
      {
        name: '--fields',
        type: TYPE_STRING,
        description: DESC_FIELDS,
      },
      ...getArtifactRootCliSchemaOptions(),
    ],
    output_format: 'json envelope (graph export format via --format json|dot|gexf)',
    example: 'dbt-tools export --dbt-target ./target --format json --focus model.p.m',
  };
}

function getSearchSchema(): CommandSchema {
  return {
    command: 'search',
    description: 'Search for dbt resources by name, tag, type, or free text',
    arguments: [
      {
        name: 'query',
        required: false,
        description: 'Search query; supports key:value tokens like type:model tag:finance',
      },
    ],
    options: [
      {
        name: '--type',
        type: TYPE_STRING,
        description: 'Filter by resource type(s), comma-separated',
      },
      {
        name: '--package',
        type: TYPE_STRING,
        description: DESC_SCHEMA_FILTER_PACKAGE,
      },
      {
        name: '--tag',
        type: TYPE_STRING,
        description: DESC_SCHEMA_FILTER_TAG,
      },
      {
        name: '--path',
        type: TYPE_STRING,
        description: DESC_SCHEMA_FILTER_PATH,
      },
      {
        name: '--fields',
        type: TYPE_STRING,
        description: DESC_FIELDS,
      },
      {
        name: '--limit',
        type: TYPE_NUMBER,
        description: 'Return at most N matches after scoring (max 200)',
      },
      {
        name: '--offset',
        type: TYPE_NUMBER,
        description: 'Skip N matches after sort (requires --limit)',
      },
      ...getStdoutFormatSchemaOptions(),
      ...getArtifactRootCliSchemaOptions(),
    ],
    output_format: OUTPUT_JSON_OR_TEXT,
    example: 'dbt-tools search --dbt-target ./target orders',
  };
}

function getStatusSchema(): CommandSchema {
  return {
    command: 'status',
    description: 'Report dbt artifact presence, modification times, and analysis readiness',
    arguments: [],
    options: [...getStdoutFormatSchemaOptions(), ...getArtifactRootCliSchemaOptions()],
    output_format: OUTPUT_JSON_OR_TEXT,
    example: 'dbt-tools status --dbt-target ./target',
  };
}

/**
 * Get all command schemas
 */
export function getAllSchemas(): Record<string, CommandSchema> {
  const raw = {
    summary: getSummarySchema(),
    graph: getGraphSchema(),
    'run-report': getRunReportSchema(),
    deps: getDepsSchema(),
    inventory: getInventorySchema(),
    failures: getFailuresSchema(),
    timeline: getTimelineSchema(),
    search: getSearchSchema(),
    discover: getDiscoverSchema(),
    explain: getExplainSchema(),
    impact: getImpactSchema(),
    'diagnose run': getDiagnoseRunSchema(),
    'diagnose node': getDiagnoseNodeSchema(),
    export: getExportIntentSchema(),
    status: getStatusSchema(),
    freshness: {
      ...getStatusSchema(),
      command: 'freshness',
      description: 'Alias for status – shows artifact recency and readiness',
      example: 'dbt-tools freshness --dbt-target ./target',
    },
    schema: getSchemaCommandSchema(),
  } satisfies Record<string, CommandSchema>;

  return Object.fromEntries(
    Object.entries(raw).map(([key, schema]) => [
      key,
      {
        ...schema,
        stability: COMMAND_STABILITY[key] ?? 'core',
      } satisfies CommandSchema,
    ]),
  ) as Record<string, CommandSchema>;
}
