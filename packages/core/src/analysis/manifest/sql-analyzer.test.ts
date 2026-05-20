import { describe, it, expect } from 'vitest';

import { SQLAnalyzer, sqlDialectFromDbtAdapterType } from './sql-analyzer';

describe('SQLAnalyzer', () => {
  const analyzer = new SQLAnalyzer();

  it('should analyze simple passthrough lineage', () => {
    const sql = 'SELECT id, name FROM users';
    const result = analyzer.analyze(sql);

    expect(result).toEqual({
      id: [{ sourceTable: 'users', sourceColumn: 'id' }],
      name: [{ sourceTable: 'users', sourceColumn: 'name' }],
    });
  });

  it('should analyze aliased columns', () => {
    const sql = 'SELECT user_id as id, user_name as name FROM users';
    const result = analyzer.analyze(sql);

    expect(result).toEqual({
      id: [{ sourceTable: 'users', sourceColumn: 'user_id' }],
      name: [{ sourceTable: 'users', sourceColumn: 'user_name' }],
    });
  });

  it('should analyze table aliases and joins', () => {
    const sql = `
      SELECT 
        u.id as user_id, 
        o.id as order_id,
        u.name
      FROM users u
      JOIN orders o ON u.id = o.user_id
    `;
    const result = analyzer.analyze(sql);

    expect(result).toEqual({
      user_id: [{ sourceTable: 'users', sourceColumn: 'id' }],
      order_id: [{ sourceTable: 'orders', sourceColumn: 'id' }],
      name: [{ sourceTable: 'users', sourceColumn: 'name' }],
    });
  });

  it('should analyze expressions and multiple dependencies', () => {
    const sql = "SELECT first_name || ' ' || last_name as full_name FROM users";
    const result = analyzer.analyze(sql, 'postgresql');

    expect(result).toEqual({
      full_name: [
        { sourceTable: 'users', sourceColumn: 'first_name' },
        { sourceTable: 'users', sourceColumn: 'last_name' },
      ],
    });
  });

  it('should resolve CTEs', () => {
    const sql = `
      WITH base AS (
        SELECT id, val FROM source_table
      )
      SELECT id, val * 2 as doubled_val FROM base
    `;
    const result = analyzer.analyze(sql);

    expect(result).toEqual({
      id: [{ sourceTable: 'source_table', sourceColumn: 'id' }],
      doubled_val: [{ sourceTable: 'source_table', sourceColumn: 'val' }],
    });
  });

  it('should handle nested CTEs', () => {
    const sql = `
      WITH cte1 AS (
        SELECT a, b FROM t1
      ),
      cte2 AS (
        SELECT a as x, b as y FROM cte1
      )
      SELECT x, y FROM cte2
    `;
    const result = analyzer.analyze(sql);

    expect(result).toEqual({
      x: [{ sourceTable: 't1', sourceColumn: 'a' }],
      y: [{ sourceTable: 't1', sourceColumn: 'b' }],
    });
  });

  it('should handle CASE statements', () => {
    const sql = `
      SELECT 
        CASE 
          WHEN status = 'active' THEN 1 
          ELSE 0 
        END as is_active 
      FROM users
    `;
    const result = analyzer.analyze(sql);

    expect(result).toEqual({
      is_active: [{ sourceTable: 'users', sourceColumn: 'status' }],
    });
  });

  it('should handle SELECT *', () => {
    const sql = 'SELECT * FROM users';
    const result = analyzer.analyze(sql);

    // For now, we return it as a special column '*'
    expect(result).toEqual({
      '*': [{ sourceTable: 'users', sourceColumn: '*' }],
    });
  });

  it('should gracefully handle parse errors', () => {
    const sql = 'NOT A REAL SQL STATEMENT';
    const result = analyzer.analyze(sql);

    expect(result).toEqual({});
  });
});

describe('sqlDialectFromDbtAdapterType', () => {
  it('maps known dbt adapter_type values to node-sql-parser database names', () => {
    expect(sqlDialectFromDbtAdapterType('snowflake')).toBe('snowflake');
    expect(sqlDialectFromDbtAdapterType('bigquery')).toBe('bigquery');
    expect(sqlDialectFromDbtAdapterType('postgres')).toBe('postgresql');
    expect(sqlDialectFromDbtAdapterType('postgresql')).toBe('postgresql');
    expect(sqlDialectFromDbtAdapterType('redshift')).toBe('redshift');
    expect(sqlDialectFromDbtAdapterType('sqlite')).toBe('sqlite');
  });

  it('falls back to mysql for unknown or missing adapters', () => {
    expect(sqlDialectFromDbtAdapterType(undefined)).toBe('mysql');
    expect(sqlDialectFromDbtAdapterType(null)).toBe('mysql');
    expect(sqlDialectFromDbtAdapterType('unknown_warehouse')).toBe('mysql');
  });

  it('maps databricks-like adapters to postgresql for parsing', () => {
    expect(sqlDialectFromDbtAdapterType('databricks')).toBe('postgresql');
    expect(sqlDialectFromDbtAdapterType('trino')).toBe('postgresql');
  });
});
