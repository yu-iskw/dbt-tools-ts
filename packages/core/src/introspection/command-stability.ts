export type StabilityLevel = 'core' | 'evolving' | 'experimental';

/**
 * Machine-readable stability for each `dbt-tools schema` entry (intent vs primitive).
 */
export const COMMAND_STABILITY: Record<string, StabilityLevel> = {
  summary: 'core',
  graph: 'core',
  'run-report': 'core',
  deps: 'core',
  inventory: 'core',
  failures: 'evolving',
  timeline: 'core',
  search: 'core',
  discover: 'evolving',
  explain: 'evolving',
  impact: 'evolving',
  'diagnose run': 'experimental',
  'diagnose node': 'experimental',
  export: 'evolving',
  status: 'core',
  freshness: 'core',
  schema: 'core',
};
