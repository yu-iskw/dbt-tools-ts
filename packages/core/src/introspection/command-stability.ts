export type StabilityLevel = 'core' | 'evolving' | 'experimental';

/**
 * Machine-readable stability for each `dbt-tools schema` entry (intent vs primitive).
 */
export const COMMAND_STABILITY: Record<string, StabilityLevel> = {
  summary: 'core',
  graph: 'core',
  'query-executions': 'core',
  'run-summary': 'core',
  'run-report': 'core',
  failures: 'core',
  impact: 'evolving',
  deps: 'core',
  inventory: 'core',
  timeline: 'core',
  search: 'core',
  discover: 'evolving',
  explain: 'evolving',
  'diagnose run': 'experimental',
  'diagnose node': 'experimental',
  export: 'evolving',
  status: 'core',
  freshness: 'core',
  schema: 'core',
};
