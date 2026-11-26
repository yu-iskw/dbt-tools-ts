/**
 * Normalized warehouse container location for a resource (e.g. BigQuery project > dataset).
 * Hierarchy labels are adapter-specific; the physical relation name is never parsed because
 * its quoting differs per adapter. Core-owned so CLI, MCP and web can share boundary logic.
 */

export interface WarehouseLocationLevel {
  kind: string;
  label: string;
  name: string;
}

export interface WarehouseLocation {
  levels: WarehouseLocationLevel[];
  relation: string | null;
}

export type BoundaryCrossing = 'inner' | 'none' | 'outer';

type LocationField = 'database' | 'schema';

interface LevelSpec {
  kind: string;
  label: string;
  field: LocationField;
}

const OUTER_INNER_LEVELS: LevelSpec[] = [
  { kind: 'database', label: 'Database', field: 'database' },
  { kind: 'schema', label: 'Schema', field: 'schema' },
];

const LEVELS_BY_ADAPTER = new Map<string, LevelSpec[]>([
  [
    'bigquery',
    [
      { kind: 'project', label: 'Project', field: 'database' },
      { kind: 'dataset', label: 'Dataset', field: 'schema' },
    ],
  ],
  [
    'snowflake',
    [
      { kind: 'database', label: 'Database', field: 'database' },
      { kind: 'schema', label: 'Schema', field: 'schema' },
    ],
  ],
  [
    'duckdb',
    [
      { kind: 'catalog', label: 'Catalog', field: 'database' },
      { kind: 'schema', label: 'Schema', field: 'schema' },
    ],
  ],
  [
    'databricks',
    [
      { kind: 'catalog', label: 'Catalog', field: 'database' },
      { kind: 'schema', label: 'Schema', field: 'schema' },
    ],
  ],
  [
    'redshift',
    [
      { kind: 'database', label: 'Database', field: 'database' },
      { kind: 'schema', label: 'Schema', field: 'schema' },
    ],
  ],
  [
    'postgres',
    [
      { kind: 'database', label: 'Database', field: 'database' },
      { kind: 'schema', label: 'Schema', field: 'schema' },
    ],
  ],
  [
    'trino',
    [
      { kind: 'catalog', label: 'Catalog', field: 'database' },
      { kind: 'schema', label: 'Schema', field: 'schema' },
    ],
  ],
  [
    'athena',
    [
      { kind: 'catalog', label: 'Data catalog', field: 'database' },
      { kind: 'database', label: 'Glue database', field: 'schema' },
    ],
  ],
  // Spark has no database level; the schema is the only container.
  ['spark', [{ kind: 'schema', label: 'Schema', field: 'schema' }]],
]);

/** dbt resource types that never occupy a warehouse relation. */
const NON_RELATION_RESOURCE_TYPES = new Set([
  'exposure',
  'macro',
  'metric',
  'semantic_model',
  'test',
  'unit_test',
]);

function nonEmpty(value: string | null | undefined): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function readLocationField(
  input: { database?: string | null; schema?: string | null },
  field: LocationField,
): string | null {
  return nonEmpty(field === 'database' ? input.database : input.schema);
}

function levelsForAdapter(adapterType: string | null | undefined): LevelSpec[] {
  const key = (adapterType ?? '').trim().toLowerCase();
  return LEVELS_BY_ADAPTER.get(key) ?? OUTER_INNER_LEVELS;
}

export interface WarehouseLocationInput {
  adapterType: string | null | undefined;
  resourceType: string;
  database?: string | null;
  schema?: string | null;
  alias?: string | null;
  name: string;
  createsRelation?: boolean;
}

export function buildWarehouseLocation(input: WarehouseLocationInput): WarehouseLocation | null {
  if (NON_RELATION_RESOURCE_TYPES.has(input.resourceType)) return null;
  if (input.createsRelation === false) return null;

  const levels: WarehouseLocationLevel[] = [];
  for (const spec of levelsForAdapter(input.adapterType)) {
    const name = readLocationField(input, spec.field);
    if (name == null) return null;
    levels.push({ kind: spec.kind, label: spec.label, name });
  }

  return {
    levels,
    relation: nonEmpty(input.alias) ?? nonEmpty(input.name),
  };
}

function levelNamesDiffer(
  a: WarehouseLocationLevel | undefined,
  b: WarehouseLocationLevel | undefined,
): boolean {
  if (a == null || b == null) return a !== b;
  return a.name.toLowerCase() !== b.name.toLowerCase();
}

function innermostLevel(levels: WarehouseLocationLevel[]): WarehouseLocationLevel | undefined {
  const [inner] = levels.slice(-1);
  return inner;
}

/**
 * Compare two locations. The first level is the outer container (project, database,
 * catalog) and the last level is the inner container (dataset, schema). Locations with a
 * single level (spark) compare that level as inner.
 */
export function getBoundaryCrossing(
  a: WarehouseLocation | null | undefined,
  b: WarehouseLocation | null | undefined,
): BoundaryCrossing {
  if (a == null || b == null) return 'none';
  if (a.levels.length !== b.levels.length) return 'outer';
  if (a.levels.length > 1 && levelNamesDiffer(a.levels[0], b.levels[0])) return 'outer';
  return levelNamesDiffer(innermostLevel(a.levels), innermostLevel(b.levels)) ? 'inner' : 'none';
}
