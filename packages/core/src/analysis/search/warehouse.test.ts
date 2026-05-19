import { describe, it, expect } from 'vitest';

import {
  resolveWarehouseSearchPlan,
  QueryExecutionsValidationError,
  WAREHOUSE_EXECUTION_PROFILES,
} from './warehouse';

describe('search/warehouse', () => {
  it('rejects multiple warehouse blocks', () => {
    expect(() =>
      resolveWarehouseSearchPlan(
        { bigquery: { minSlotMs: 1 }, snowflake: { minRowsInserted: 1 } },
        { warehouseType: 'bigquery' },
      ),
    ).toThrow(QueryExecutionsValidationError);
  });

  it('rejects warehouse block mismatching run warehouse', () => {
    expect(() =>
      resolveWarehouseSearchPlan(
        { snowflake: { sort: 'rows_inserted_desc' } },
        { warehouseType: 'bigquery' },
      ),
    ).toThrow(/Run warehouse is bigquery/);
  });

  it('merges bigquery sort and min filters into nested block', () => {
    const plan = resolveWarehouseSearchPlan(
      { bigquery: { sort: 'slot_ms_desc', minSlotMs: 100 } },
      { warehouseType: 'bigquery' },
    );
    expect(plan.effectiveSort).toBe('slot_ms_desc');
    expect(plan.activeWarehouseBlock).toEqual({
      adapter: 'bigquery',
      criteria: { sort: 'slot_ms_desc', minSlotMs: 100 },
    });
    expect(plan.profile).toEqual(WAREHOUSE_EXECUTION_PROFILES.bigquery);
  });

  it('defaults sort to execution_time_desc without warehouse block', () => {
    const plan = resolveWarehouseSearchPlan({}, { warehouseType: 'snowflake' });
    expect(plan.effectiveSort).toBe('execution_time_desc');
    expect(plan.activeWarehouseBlock).toBeNull();
  });

  it('rejects adapter sort without warehouse block', () => {
    expect(() =>
      resolveWarehouseSearchPlan({ sort: 'slot_ms_desc' }, { warehouseType: 'bigquery' }),
    ).toThrow(QueryExecutionsValidationError);
  });
});
