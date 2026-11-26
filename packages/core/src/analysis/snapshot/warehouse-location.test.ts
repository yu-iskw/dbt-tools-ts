import { describe, expect, it } from 'vitest';

import { buildWarehouseLocation, getBoundaryCrossing } from './warehouse-location';

import type { WarehouseLocation } from './warehouse-location';

const base = {
  resourceType: 'model',
  database: 'outer_db',
  schema: 'inner_schema',
  alias: 'orders',
  name: 'orders',
};

type LevelRow = [kind: string, label: string, name: string];

function toLevels(rows: LevelRow[]) {
  return rows.map(([kind, label, name]) => ({ kind, label, name }));
}

type BuildInput = Parameters<typeof buildWarehouseLocation>[0];

function buildOf(overrides: Partial<BuildInput> = {}): WarehouseLocation | null {
  return buildWarehouseLocation({ ...base, adapterType: 'duckdb', ...overrides });
}

function locationOf(overrides: Partial<BuildInput> = {}): WarehouseLocation {
  const location = buildOf(overrides);
  if (location == null) throw new Error('expected a warehouse location');
  return location;
}

describe('buildWarehouseLocation', () => {
  it.each<[string, LevelRow[]]>([
    [
      'bigquery',
      [
        ['project', 'Project', 'outer_db'],
        ['dataset', 'Dataset', 'inner_schema'],
      ],
    ],
    [
      'snowflake',
      [
        ['database', 'Database', 'outer_db'],
        ['schema', 'Schema', 'inner_schema'],
      ],
    ],
    [
      'duckdb',
      [
        ['catalog', 'Catalog', 'outer_db'],
        ['schema', 'Schema', 'inner_schema'],
      ],
    ],
    [
      'databricks',
      [
        ['catalog', 'Catalog', 'outer_db'],
        ['schema', 'Schema', 'inner_schema'],
      ],
    ],
    [
      'redshift',
      [
        ['database', 'Database', 'outer_db'],
        ['schema', 'Schema', 'inner_schema'],
      ],
    ],
    [
      'postgres',
      [
        ['database', 'Database', 'outer_db'],
        ['schema', 'Schema', 'inner_schema'],
      ],
    ],
    [
      'trino',
      [
        ['catalog', 'Catalog', 'outer_db'],
        ['schema', 'Schema', 'inner_schema'],
      ],
    ],
    [
      'athena',
      [
        ['catalog', 'Data catalog', 'outer_db'],
        ['database', 'Glue database', 'inner_schema'],
      ],
    ],
    ['spark', [['schema', 'Schema', 'inner_schema']]],
    [
      'unknown-warehouse',
      [
        ['database', 'Database', 'outer_db'],
        ['schema', 'Schema', 'inner_schema'],
      ],
    ],
  ])('uses the level table for %s', (adapterType, rows) => {
    const location = locationOf({ adapterType });
    expect(location.levels).toEqual(toLevels(rows));
    expect(location.relation).toBe('orders');
  });

  it('treats a missing adapter type as the generic fallback', () => {
    expect(locationOf({ adapterType: null }).levels).toEqual(
      toLevels([
        ['database', 'Database', 'outer_db'],
        ['schema', 'Schema', 'inner_schema'],
      ]),
    );
    expect(locationOf({ adapterType: undefined }).levels[0]?.label).toBe('Database');
  });

  it('matches adapter types case-insensitively', () => {
    expect(locationOf({ adapterType: 'BigQuery' }).levels[0]?.kind).toBe('project');
  });

  it('needs only schema for spark and ignores database', () => {
    const location = locationOf({ adapterType: 'spark', database: null });
    expect(location.levels).toHaveLength(1);
    expect(location.levels[0]?.name).toBe('inner_schema');
  });

  it('returns null when the schema is missing', () => {
    expect(buildOf({ adapterType: 'bigquery', schema: null })).toBeNull();
    expect(buildOf({ adapterType: 'spark', schema: '  ' })).toBeNull();
  });

  it('returns null when the database is missing for multi-level adapters', () => {
    expect(buildOf({ adapterType: 'snowflake', database: undefined })).toBeNull();
    expect(buildOf({ adapterType: 'snowflake', database: '' })).toBeNull();
  });

  it('uses alias as the relation and falls back to name', () => {
    expect(locationOf({ alias: 'physical_orders' }).relation).toBe('physical_orders');
    expect(locationOf({ alias: null, name: 'orders_model' }).relation).toBe('orders_model');
  });

  it('returns null for ephemeral models (createsRelation false)', () => {
    expect(buildOf({ createsRelation: false })).toBeNull();
  });

  it('keeps a location when createsRelation is unknown or true', () => {
    expect(locationOf({ createsRelation: true })).not.toBeNull();
    expect(locationOf({ createsRelation: undefined })).not.toBeNull();
  });

  it.each([
    'exposure',
    'metric',
    'semantic_model',
    'macro',
    'unit_test',
    'test',
  ])('returns null for %s resources', (resourceType) => {
    expect(buildOf({ resourceType })).toBeNull();
  });

  it('places sources at their database, schema and identifier', () => {
    const location = locationOf({
      resourceType: 'source',
      adapterType: 'bigquery',
      alias: 'raw_customers',
      name: 'customers',
      createsRelation: true,
    });
    expect(location.levels.map((level) => level.name)).toEqual(['outer_db', 'inner_schema']);
    expect(location.relation).toBe('raw_customers');
  });
});

describe('getBoundaryCrossing', () => {
  const at = (adapterType: string, database: string, schema: string) =>
    locationOf({ adapterType, database, schema });

  it('returns none when either side has no location', () => {
    const location = at('bigquery', 'p1', 'd1');
    expect(getBoundaryCrossing(null, location)).toBe('none');
    expect(getBoundaryCrossing(location, undefined)).toBe('none');
    expect(getBoundaryCrossing(null, null)).toBe('none');
  });

  it('returns none for identical locations', () => {
    expect(getBoundaryCrossing(at('bigquery', 'p1', 'd1'), at('bigquery', 'p1', 'd1'))).toBe(
      'none',
    );
  });

  it('returns inner when only the inner level differs', () => {
    expect(getBoundaryCrossing(at('bigquery', 'p1', 'd1'), at('bigquery', 'p1', 'd2'))).toBe(
      'inner',
    );
  });

  it('returns outer when the outer level differs', () => {
    expect(getBoundaryCrossing(at('bigquery', 'p1', 'd1'), at('bigquery', 'p2', 'd1'))).toBe(
      'outer',
    );
  });

  it('returns outer when both levels differ', () => {
    expect(getBoundaryCrossing(at('bigquery', 'p1', 'd1'), at('bigquery', 'p2', 'd2'))).toBe(
      'outer',
    );
  });

  it('compares names case-insensitively', () => {
    expect(getBoundaryCrossing(at('snowflake', 'DB', 'MARTS'), at('snowflake', 'db', 'marts'))).toBe(
      'none',
    );
  });

  it('returns outer when the number of levels differs', () => {
    expect(getBoundaryCrossing(at('spark', 'x', 'd1'), at('bigquery', 'p1', 'd1'))).toBe('outer');
  });

  it('compares a single spark schema level as inner', () => {
    expect(getBoundaryCrossing(at('spark', 'x', 'd1'), at('spark', 'x', 'd1'))).toBe('none');
    expect(getBoundaryCrossing(at('spark', 'x', 'd1'), at('spark', 'x', 'd2'))).toBe('inner');
  });
});
