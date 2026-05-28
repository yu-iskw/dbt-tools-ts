import {
  QUERY_EXECUTIONS_MAX_UNIQUE_IDS,
  QueryExecutionsValidationError,
  resolveWarehouseSearchPlan,
} from '@dbt-tools/core';
import { describe, it, expect } from 'vitest';

import { buildQueryExecutionsRequest } from './query-executions-action';

describe('buildQueryExecutionsRequest', () => {
  it('defaults globMode to strict for CLI when omitted', () => {
    const request = buildQueryExecutionsRequest({});
    expect(request.globMode).toBe('strict');
  });

  it('passes substring globMode when explicitly set', () => {
    const request = buildQueryExecutionsRequest({ globMode: 'substring' });
    expect(request.globMode).toBe('substring');
  });

  it('rejects invalid globMode', () => {
    expect(() => buildQueryExecutionsRequest({ globMode: 'invalid' as 'strict' })).toThrow(
      QueryExecutionsValidationError,
    );
  });

  it('rejects too many uniqueIds via core plan validation', () => {
    const ids = Array.from(
      { length: QUERY_EXECUTIONS_MAX_UNIQUE_IDS + 1 },
      (_, i) => `model.p.m_${i}`,
    );
    const request = buildQueryExecutionsRequest({ uniqueIds: ids.join(',') });
    expect(() => resolveWarehouseSearchPlan(request, {})).toThrow(QueryExecutionsValidationError);
  });

  it('maps bigquery --query-id to warehouse block', () => {
    const request = buildQueryExecutionsRequest({
      warehouse: 'bigquery',
      queryId: 'job-abc',
    });
    expect(request.bigquery?.queryId).toBe('job-abc');
  });

  it('puts sort only on warehouse block when warehouse subcommand is used', () => {
    const request = buildQueryExecutionsRequest({
      warehouse: 'bigquery',
      sort: 'slot_ms_desc',
    });
    expect(request.sort).toBeUndefined();
    expect(request.bigquery?.sort).toBe('slot_ms_desc');
  });
});
