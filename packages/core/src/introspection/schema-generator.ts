import { getObjectProperty } from '../util/typed-map';

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
const OPT_JSON = '--json';
const OPT_NO_JSON = '--no-json';
const OPT_TRACE = '--trace';
const TYPE_STRING = 'string';
const TYPE_BOOLEAN = 'boolean';
const TYPE_NUMBER = 'number';
const OUTPUT_JSON_OR_HUMAN = 'json or human-readable';
const DESC_DBT_TARGET =
  'Directory containing manifest.json + run_results.json, or s3://bucket/prefix / gs://bucket/prefix. When omitted, uses DBT_TOOLS_DBT_TARGET if set.';
const DESC_FORCE_JSON = 'Force JSON stdout; with --json, errors on stderr use structured JSON';
const DESC_FORCE_HUMAN = 'Force human-readable output';
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
      {
        name: OPT_JSON,
        type: TYPE_BOOLEAN,
        description: DESC_FORCE_JSON,
      },
      {
        name: OPT_NO_JSON,
        type: TYPE_BOOLEAN,
        description: DESC_FORCE_HUMAN,
      },
      ...getArtifactRootCliSchemaOptions(),
    ],
    output_format: OUTPUT_JSON_OR_HUMAN,
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

function getQueryExecutionsCommonOptions(): SchemaOption[] {
  return [
    {
      name: '--sort',
      type: TYPE_STRING,
      description: 'Sort key (execution_time_desc, slot_ms_desc, rows_inserted_desc, …)',
    },
    {
      name: '--status',
      type: TYPE_STRING,
      description: 'Comma-separated statuses to include',
    },
    { name: '--limit', type: TYPE_NUMBER, description: 'Max rows (default 10, max 50)' },
    {
      name: '--offset',
      type: TYPE_NUMBER,
      description: 'Skip rows (requires --limit)',
    },
    {
      name: '--resource-types',
      type: TYPE_STRING,
      description: 'Comma-separated resource types (default: model,test,unit_test)',
    },
    {
      name: '--unique-id-pattern',
      type: TYPE_STRING,
      description: 'Glob pattern for unique_id',
    },
    {
      name: '--min-execution-time',
      type: 'number',
      description: 'Minimum execution time in seconds',
    },
    {
      name: '--max-execution-time',
      type: 'number',
      description: 'Maximum execution time in seconds',
    },
    { name: '--fields', type: TYPE_STRING, description: DESC_FIELDS },
    { name: OPT_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_JSON },
    { name: OPT_NO_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_HUMAN },
    ...getArtifactRootCliSchemaOptions(),
  ];
}

function getQueryExecutionsSchema(): CommandSchema {
  return {
    command: 'query-executions',
    description: 'Filter and sort run_results executions (time and warehouse metrics)',
    arguments: [],
    options: getQueryExecutionsCommonOptions(),
    output_format: OUTPUT_JSON_OR_HUMAN,
    example:
      'dbt-tools query-executions --dbt-target ./target --sort execution_time_desc --limit 10 --json',
  };
}

function getRunSummarySchema(): CommandSchema {
  return {
    command: 'run-summary',
    description:
      'Run-level summary, status breakdown, bottlenecks, and adapter totals (no per-node list)',
    arguments: [],
    options: [
      { name: '--fields', type: TYPE_STRING, description: DESC_FIELDS },
      { name: OPT_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_JSON },
      { name: OPT_NO_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_HUMAN },
      ...getArtifactRootCliSchemaOptions(),
    ],
    output_format: OUTPUT_JSON_OR_HUMAN,
    example: 'dbt-tools run-summary --dbt-target ./target --json',
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
      name: '--format',
      type: 'enum',
      values: ['flat', 'tree'],
      default: 'tree',
      description: 'Output structure: flat list or nested tree',
    },
    {
      name: '--build-order',
      type: TYPE_BOOLEAN,
      description:
        'Output upstream dependencies in topological build order (only with --direction upstream)',
    },
    { name: OPT_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_JSON },
    { name: OPT_NO_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_HUMAN },
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
    output_format: OUTPUT_JSON_OR_HUMAN,
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
    options: [
      {
        name: OPT_JSON,
        type: TYPE_BOOLEAN,
        description: DESC_FORCE_JSON,
      },
    ],
    output_format: 'json',
    example: 'dbt-tools schema deps',
  };
}

/**
 * Get schema for a specific command
 */
export function getCommandSchema(command: string): CommandSchema | null {
  const schemas = getAllSchemas();
  const schema = getObjectProperty(schemas as Record<string, unknown>, command);
  return schema != null ? (schema as CommandSchema) : null;
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
      { name: OPT_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_JSON },
      { name: OPT_NO_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_HUMAN },
      ...getArtifactRootCliSchemaOptions(),
    ],
    output_format: OUTPUT_JSON_OR_HUMAN,
    example: 'dbt-tools inventory --dbt-target ./target --type model --tag finance',
  };
}

function getTimelineSchema(): CommandSchema {
  return {
    command: 'timeline',
    description:
      'Show per-node execution timeline from run_results.json (row-level; use query-executions for ranked filters)',
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
        name: '--format',
        type: 'enum',
        values: ['json', 'table', 'csv'],
        description: 'Output format (default: json in non-TTY, table in TTY)',
      },
      { name: OPT_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_JSON },
      { name: OPT_NO_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_HUMAN },
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
      { name: OPT_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_JSON },
      { name: OPT_NO_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_HUMAN },
      { name: OPT_TRACE, type: TYPE_BOOLEAN, description: DESC_TRACE },
      ...getArtifactRootCliSchemaOptions(),
    ],
    output_format: OUTPUT_JSON_OR_HUMAN,
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
      { name: OPT_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_JSON },
      { name: OPT_NO_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_HUMAN },
      { name: OPT_TRACE, type: TYPE_BOOLEAN, description: DESC_TRACE },
      ...getArtifactRootCliSchemaOptions(),
    ],
    output_format: OUTPUT_JSON_OR_HUMAN,
    example: 'dbt-tools explain --dbt-target ./target model.my_pkg.orders --json',
  };
}

function getDiagnoseRunSchema(): CommandSchema {
  return {
    command: 'diagnose run',
    description:
      'Intent: run-level diagnosis facade (primitive commands: runSummary, query-executions, timeline)',
    arguments: [],
    options: [
      {
        name: '--fields',
        type: TYPE_STRING,
        description: DESC_FIELDS,
      },
      { name: OPT_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_JSON },
      { name: OPT_NO_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_HUMAN },
      ...getArtifactRootCliSchemaOptions(),
    ],
    output_format: OUTPUT_JSON_OR_HUMAN,
    example: 'dbt-tools diagnose run --dbt-target ./target --json',
  };
}

function getDiagnoseNodeSchema(): CommandSchema {
  return {
    command: 'diagnose node',
    description:
      'Intent: resource-level diagnosis facade (primitive commands: runSummary, query-executions, deps, explain)',
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
      { name: OPT_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_JSON },
      { name: OPT_NO_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_HUMAN },
      ...getArtifactRootCliSchemaOptions(),
    ],
    output_format: OUTPUT_JSON_OR_HUMAN,
    example: 'dbt-tools diagnose node --dbt-target ./target model.my_pkg.orders --json',
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
      { name: OPT_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_JSON },
      { name: OPT_NO_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_HUMAN },
      ...getArtifactRootCliSchemaOptions(),
    ],
    output_format: OUTPUT_JSON_OR_HUMAN,
    example: 'dbt-tools export --dbt-target ./target --format json --focus model.p.m --json',
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
      { name: OPT_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_JSON },
      { name: OPT_NO_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_HUMAN },
      ...getArtifactRootCliSchemaOptions(),
    ],
    output_format: OUTPUT_JSON_OR_HUMAN,
    example: 'dbt-tools search --dbt-target ./target orders',
  };
}

function getStatusSchema(): CommandSchema {
  return {
    command: 'status',
    description: 'Report dbt artifact presence, modification times, and analysis readiness',
    arguments: [],
    options: [
      { name: OPT_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_JSON },
      { name: OPT_NO_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_HUMAN },
      ...getArtifactRootCliSchemaOptions(),
    ],
    output_format: OUTPUT_JSON_OR_HUMAN,
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
    'query-executions': getQueryExecutionsSchema(),
    'run-summary': getRunSummarySchema(),
    deps: getDepsSchema(),
    inventory: getInventorySchema(),
    timeline: getTimelineSchema(),
    search: getSearchSchema(),
    discover: getDiscoverSchema(),
    explain: getExplainSchema(),
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
        stability:
          (getObjectProperty(COMMAND_STABILITY, key) as StabilityLevel | undefined) ?? 'core',
      } satisfies CommandSchema,
    ]),
  ) as Record<string, CommandSchema>;
}
