export type StabilityLevel = 'core' | 'evolving' | 'experimental';

/**
 * Machine-readable stability for each `dbt-tools schema` entry (intent vs primitive).
 */
export const COMMAND_STABILITY: Record<string, StabilityLevel> = {
  summary: 'core',
  graph: 'core',
  'query-executions': 'core',
  'query-executions bigquery': 'core',
  'query-executions snowflake': 'core',
  'query-executions athena': 'core',
  'query-executions postgres': 'core',
  'query-executions redshift': 'core',
  'query-executions spark': 'core',
  'run-summary': 'core',
  failures: 'core',
  'run-report': 'core',
  deps: 'core',
  inventory: 'core',
  timeline: 'core',
  search: 'core',
  discover: 'evolving',
  explain: 'evolving',
  impact: 'evolving',
  diagnose: 'experimental',
  'diagnose run': 'experimental',
  'diagnose node': 'experimental',
  export: 'evolving',
  status: 'core',
  freshness: 'core',
  schema: 'core',
};
