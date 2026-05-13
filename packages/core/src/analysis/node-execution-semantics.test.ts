import { describe, expect, it } from 'vitest';
import {
  buildNodeExecutionSemantics,
  deriveSemanticsFlags,
  normalizeDbtResourceTypeKey,
  normalizeMaterializationKind,
} from './node-execution-semantics';

describe('normalizeDbtResourceTypeKey', () => {
  it('trims, lowercases, and maps empty to unknown', () => {
    expect(normalizeDbtResourceTypeKey('  MODEL ')).toBe('model');
    expect(normalizeDbtResourceTypeKey('')).toBe('unknown');
    expect(normalizeDbtResourceTypeKey('   ')).toBe('unknown');
  });
});

describe('normalizeMaterializationKind', () => {
  it('maps known model materializations', () => {
    expect(normalizeMaterializationKind('model', 'table')).toEqual({
      kind: 'table',
    });
    expect(normalizeMaterializationKind('model', 'incremental')).toEqual({
      kind: 'incremental',
    });
    expect(normalizeMaterializationKind('model', 'ephemeral')).toEqual({
      kind: 'ephemeral',
    });
  });

  it('normalizes materialized_view token variants', () => {
    expect(normalizeMaterializationKind('model', 'materialized_view')).toEqual({
      kind: 'materialized_view',
    });
    expect(normalizeMaterializationKind('model', 'MATERIALIZED VIEW')).toEqual({
      kind: 'materialized_view',
    });
  });

  it('returns unknown with raw for custom adapter materializations', () => {
    expect(normalizeMaterializationKind('model', 'iceberg_table')).toEqual({
      kind: 'unknown',
      raw: 'iceberg_table',
    });
  });

  it('derives kinds from resource_type when not a model', () => {
    expect(normalizeMaterializationKind('seed', null)).toEqual({
      kind: 'seed',
    });
    expect(normalizeMaterializationKind('unit_test', null)).toEqual({
      kind: 'test',
    });
  });
});

describe('deriveSemanticsFlags', () => {
  it('marks ephemeral as compiled-into-parent without relation', () => {
    expect(deriveSemanticsFlags('ephemeral', 'model')).toEqual({
      persisted: false,
      createsRelation: false,
      compiledIntoParent: true,
    });
  });

  it('marks incremental as persisted relation for models', () => {
    expect(deriveSemanticsFlags('incremental', 'model')).toEqual({
      persisted: true,
      createsRelation: true,
      compiledIntoParent: false,
    });
  });

  it('treats sources as references not created by dbt run', () => {
    expect(deriveSemanticsFlags('unknown', 'source')).toEqual({
      persisted: true,
      createsRelation: false,
      compiledIntoParent: false,
    });
  });
});

describe('buildNodeExecutionSemantics', () => {
  it('reads incremental hints from manifest node config', () => {
    const sem = buildNodeExecutionSemantics({
      resourceType: 'model',
      materialized: 'incremental',
      manifestEntry: {
        resource_type: 'model',
        config: {
          materialized: 'incremental',
          incremental_strategy: 'merge',
          unique_key: 'id',
          on_schema_change: 'append_new_columns',
          full_refresh: false,
        },
      },
      adapterType: 'snowflake',
    });
    expect(sem.materialization).toBe('incremental');
    expect(sem.incrementalStrategy).toBe('merge');
    expect(sem.uniqueKey).toBe('id');
    expect(sem.onSchemaChange).toBe('append_new_columns');
    expect(sem.fullRefreshCapable).toBe(false);
    expect(sem.adapterType).toBe('snowflake');
    expect(sem.materializationSource).toBe('manifest');
  });

  it('uses derived provenance when only resource type is known', () => {
    const sem = buildNodeExecutionSemantics({
      resourceType: 'snapshot',
      manifestEntry: null,
    });
    expect(sem.materialization).toBe('snapshot');
    expect(sem.materializationSource).toBe('derived');
  });
});
