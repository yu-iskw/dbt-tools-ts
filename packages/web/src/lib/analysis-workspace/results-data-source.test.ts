import { describe, expect, it } from 'vitest';

import {
  createRunsResultsIndex,
  filterRunsResultsIndex,
  queryRunsResultsIndex,
} from './results-data-source';

import type { ExecutionRow } from '@web/types';

function makeExecution(
  overrides: Partial<ExecutionRow> & Pick<ExecutionRow, 'uniqueId'>,
): ExecutionRow {
  const { uniqueId, ...rest } = overrides;
  return {
    name: uniqueId,
    resourceType: 'model',
    packageName: 'jaffle_shop',
    path: `models/${uniqueId}.sql`,
    status: 'Success',
    statusTone: 'positive',
    executionTime: 1,
    threadId: 'Thread-1',
    start: null,
    end: null,
    ...rest,
    uniqueId,
  };
}

describe('createRunsResultsIndex', () => {
  it('partitions rows into model and test tabs', () => {
    const index = createRunsResultsIndex([
      makeExecution({ uniqueId: 'orders', resourceType: 'model' }),
      makeExecution({ uniqueId: 'not_null_orders', resourceType: 'test' }),
    ]);

    expect(index.entries).toHaveLength(2);
    expect(index.summary.facets.models).toBe(1);
    expect(index.summary.facets.tests).toBe(1);
    expect(index.summary.status.all).toBe(2);
  });

  it('counts issues facet as danger plus warning rows', () => {
    const index = createRunsResultsIndex([
      makeExecution({ uniqueId: 'a', statusTone: 'positive' }),
      makeExecution({ uniqueId: 'b', statusTone: 'danger' }),
      makeExecution({ uniqueId: 'c', statusTone: 'warning' }),
    ]);
    expect(index.summary.facets.issues).toBe(2);
  });
});

describe('filterRunsResultsIndex', () => {
  it('filters against the full corpus by status and query', () => {
    const index = createRunsResultsIndex([
      makeExecution({ uniqueId: 'orders', resourceType: 'model' }),
      makeExecution({
        uniqueId: 'customers',
        resourceType: 'model',
        statusTone: 'danger',
        status: 'Error',
      }),
      makeExecution({ uniqueId: 'not_null_orders', resourceType: 'test' }),
    ]);

    const matches = filterRunsResultsIndex(index, {
      kind: 'models',
      status: 'danger',
      query: 'cust',
      resourceTypes: [],
      materializationKinds: [],
      threadIds: [],
      durationBand: 'all',
    });

    expect(matches).toHaveLength(1);
    expect(matches[0]?.row.uniqueId).toBe('customers');
  });

  it('filters by materializationKinds when set', () => {
    const viewSemantics = {
      resourceType: 'model',
      materialization: 'view' as const,
      persisted: true,
      createsRelation: true,
      compiledIntoParent: false,
      materializationSource: 'manifest' as const,
    };
    const tableSemantics = {
      ...viewSemantics,
      materialization: 'table' as const,
    };
    const index = createRunsResultsIndex([
      makeExecution({
        uniqueId: 'a',
        semantics: viewSemantics,
      }),
      makeExecution({
        uniqueId: 'b',
        semantics: tableSemantics,
      }),
    ]);

    const matches = filterRunsResultsIndex(index, {
      kind: 'all',
      status: 'all',
      query: '',
      resourceTypes: [],
      materializationKinds: ['view'],
      threadIds: [],
      durationBand: 'all',
    });

    expect(matches.map((m) => m.row.uniqueId)).toEqual(['a']);
  });

  it('issues status matches danger and warning rows', () => {
    const index = createRunsResultsIndex([
      makeExecution({ uniqueId: 'ok', statusTone: 'positive' }),
      makeExecution({
        uniqueId: 'bad',
        statusTone: 'danger',
        status: 'error',
      }),
      makeExecution({
        uniqueId: 'warned',
        statusTone: 'warning',
        status: 'warn',
      }),
    ]);

    const matches = filterRunsResultsIndex(index, {
      kind: 'all',
      status: 'issues',
      query: '',
      resourceTypes: [],
      materializationKinds: [],
      threadIds: [],
      durationBand: 'all',
    });

    expect(matches.map((m) => m.row.uniqueId).sort()).toEqual(['bad', 'warned']);
  });
});

describe('queryRunsResultsIndex', () => {
  it('returns only the requested initial reveal slice', () => {
    const index = createRunsResultsIndex(
      Array.from({ length: 140 }, (_, idx) =>
        makeExecution({ uniqueId: `model_${idx}`, resourceType: 'model' }),
      ),
    );

    const result = queryRunsResultsIndex(index, {
      kind: 'models',
      status: 'all',
      query: '',
      resourceTypes: [],
      materializationKinds: [],
      threadIds: [],
      durationBand: 'all',
      sortBy: 'attention',
      sortDirection: 'desc',
      limit: 100,
    });

    expect(result.summary.status.all).toBe(140);
    expect(result.totalMatches).toBe(140);
    expect(result.rows).toHaveLength(100);
    expect(result.rows[0]?.uniqueId).toBe('model_0');
    expect(result.rows[99]?.uniqueId).toBe('model_99');
  });

  it('sorts adapter-backed numeric columns descending with missing values last', () => {
    const index = createRunsResultsIndex([
      makeExecution({
        uniqueId: 'model_a',
        adapterMetrics: { rawKeys: ['bytes_processed'], bytesProcessed: 20 },
      }),
      makeExecution({
        uniqueId: 'model_b',
        adapterMetrics: { rawKeys: ['bytes_processed'], bytesProcessed: 200 },
      }),
      makeExecution({
        uniqueId: 'model_c',
        adapterMetrics: undefined,
      }),
    ]);

    const result = queryRunsResultsIndex(index, {
      kind: 'all',
      status: 'all',
      query: '',
      resourceTypes: [],
      materializationKinds: [],
      threadIds: [],
      durationBand: 'all',
      sortBy: 'adapter:bytesProcessed',
      sortDirection: 'desc',
      limit: 20,
    });

    expect(result.rows.map((row) => row.uniqueId)).toEqual(['model_b', 'model_a', 'model_c']);
  });

  it('sorts adapter-backed text columns ascending with missing values last', () => {
    const index = createRunsResultsIndex([
      makeExecution({
        uniqueId: 'model_a',
        adapterMetrics: { rawKeys: ['query_id'], queryId: 'job-20' },
      }),
      makeExecution({
        uniqueId: 'model_b',
        adapterMetrics: { rawKeys: ['query_id'], queryId: 'job-3' },
      }),
      makeExecution({
        uniqueId: 'model_c',
        adapterMetrics: undefined,
      }),
    ]);

    const result = queryRunsResultsIndex(index, {
      kind: 'all',
      status: 'all',
      query: '',
      resourceTypes: [],
      materializationKinds: [],
      threadIds: [],
      durationBand: 'all',
      sortBy: 'adapter:queryId',
      sortDirection: 'asc',
      limit: 20,
    });

    expect(result.rows.map((row) => row.uniqueId)).toEqual(['model_b', 'model_a', 'model_c']);
  });

  it('indexes adapter field keys and values in search text', () => {
    const index = createRunsResultsIndex([
      makeExecution({
        uniqueId: 'duck_model',
        adapterResponseFields: [
          {
            key: 'profiling.stage',
            label: 'profiling.stage',
            kind: 'string',
            displayValue: 'scan',
            isScalar: true,
            sortValue: 'scan',
          },
        ],
      }),
    ]);

    const matches = filterRunsResultsIndex(index, {
      kind: 'all',
      status: 'all',
      query: 'profiling.stage scan',
      resourceTypes: [],
      materializationKinds: [],
      threadIds: [],
      durationBand: 'all',
    });

    expect(matches).toHaveLength(1);
    expect(matches[0]?.row.uniqueId).toBe('duck_model');
  });
});
