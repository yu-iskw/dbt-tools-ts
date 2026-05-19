import { describe, expect, it } from 'vitest';
import {
  adapterMetricsHasData,
  buildAdapterTotals,
  coerceAdapterResponseInput,
  extractAdapterResponseFields,
  isAdapterResponseObject,
  normalizeAdapterResponse,
} from './metrics';

describe('normalizeAdapterResponse', () => {
  it('returns empty rawKeys for null and non-objects', () => {
    expect(normalizeAdapterResponse(null).rawKeys).toEqual([]);
    expect(normalizeAdapterResponse(undefined).rawKeys).toEqual([]);
    expect(normalizeAdapterResponse('x').rawKeys).toEqual([]);
    expect(normalizeAdapterResponse([]).rawKeys).toEqual([]);
  });

  it('normalizes BigQuery-shaped adapter_response', () => {
    const ar = {
      _message: 'CREATE VIEW (0 processed)',
      code: 'CREATE VIEW',
      bytes_processed: 0,
      bytes_billed: 0,
      location: 'asia-northeast1',
      project_id: 'your-project',
      job_id: '4825e532-3019-4417-bc75-64b304316b2f',
      slot_ms: 0,
    };
    const m = normalizeAdapterResponse(ar);
    expect(m.bytesProcessed).toBe(0);
    expect(m.bytesBilled).toBe(0);
    expect(m.slotMs).toBe(0);
    expect(m.adapterCode).toBe('CREATE VIEW');
    expect(m.adapterMessage).toBe('CREATE VIEW (0 processed)');
    expect(m.queryId).toBe('4825e532-3019-4417-bc75-64b304316b2f');
    expect(m.projectId).toBe('your-project');
    expect(m.location).toBe('asia-northeast1');
    expect(m.rawKeys.length).toBeGreaterThan(0);
    expect(adapterMetricsHasData(m)).toBe(true);
  });

  it('normalizes rows_affected from seed-style response', () => {
    const m = normalizeAdapterResponse({
      _message: 'INSERT 113',
      code: 'INSERT',
      rows_affected: 113,
    });
    expect(m.rowsAffected).toBe(113);
    expect(m.adapterCode).toBe('INSERT');
    expect(adapterMetricsHasData(m)).toBe(true);
  });

  it('prefers query_id over job_id when both exist', () => {
    const m = normalizeAdapterResponse({
      query_id: 'sf-1',
      job_id: 'bq-1',
    });
    expect(m.queryId).toBe('sf-1');
  });

  it('parses numeric strings', () => {
    const m = normalizeAdapterResponse({
      bytes_processed: '1024',
      slot_ms: '99',
    });
    expect(m.bytesProcessed).toBe(1024);
    expect(m.slotMs).toBe(99);
  });

  it('ignores non-finite numbers', () => {
    const m = normalizeAdapterResponse({
      bytes_processed: Number.NaN,
      slot_ms: Number.POSITIVE_INFINITY,
    });
    expect(m.bytesProcessed).toBeUndefined();
    expect(m.slotMs).toBeUndefined();
  });

  it('treats empty object as no normalized fields but lists rawKeys', () => {
    const m = normalizeAdapterResponse({});
    expect(m.rawKeys).toEqual([]);
    expect(adapterMetricsHasData(m)).toBe(false);
  });
});

describe('coerceAdapterResponseInput', () => {
  it('parses JSON object strings into plain objects', () => {
    const raw = JSON.stringify({ job_id: 'abc', bytes_processed: 9 });
    expect(coerceAdapterResponseInput(raw)).toEqual({
      job_id: 'abc',
      bytes_processed: 9,
    });
  });

  it('returns primitive strings that are not JSON objects unchanged', () => {
    expect(coerceAdapterResponseInput('not-json')).toBe('not-json');
  });

  it('treats empty trimmed string as null', () => {
    expect(coerceAdapterResponseInput('  ')).toBeNull();
  });
});

describe('extractAdapterResponseFields', () => {
  it('returns no fields for null and non-objects', () => {
    expect(extractAdapterResponseFields(null)).toEqual([]);
    expect(extractAdapterResponseFields('x')).toEqual([]);
    expect(extractAdapterResponseFields([])).toEqual([]);
    expect(isAdapterResponseObject(null)).toBe(false);
  });

  it('preserves arbitrary scalar keys from unknown warehouses', () => {
    const fields = extractAdapterResponseFields({
      custom_metric: 12,
      warehouse_name: 'duckdb',
      uses_cache: true,
    });
    expect(fields.map((field) => field.key)).toEqual([
      'custom_metric',
      'uses_cache',
      'warehouse_name',
    ]);
    expect(fields[0]).toMatchObject({
      key: 'custom_metric',
      kind: 'number',
      displayValue: '12',
      sortValue: 12,
      isScalar: true,
    });
  });

  it('flattens shallow objects and stringifies deep values', () => {
    const fields = extractAdapterResponseFields({
      stats: {
        rows: 4,
        meta: { phase: 'scan' },
      },
      batches: [1, 2, { ok: true }],
    });
    expect(fields.map((field) => field.key)).toEqual(['batches', 'stats.meta', 'stats.rows']);
    expect(fields[1]).toMatchObject({
      key: 'stats.meta',
      kind: 'object',
      displayValue: '{"phase":scan}',
      isScalar: false,
    });
    expect(fields[2]).toMatchObject({
      key: 'stats.rows',
      kind: 'number',
      sortValue: 4,
      isScalar: true,
    });
  });

  it('preserves empty objects as valid empty payloads', () => {
    expect(isAdapterResponseObject({})).toBe(true);
    expect(extractAdapterResponseFields({})).toEqual([]);
  });
});

describe('buildAdapterTotals', () => {
  it('returns undefined when no rows have data', () => {
    expect(buildAdapterTotals([undefined, { rawKeys: [] }])).toBeUndefined();
  });

  it('sums metrics across rows', () => {
    const a = normalizeAdapterResponse({ bytes_processed: 100, slot_ms: 10 });
    const b = normalizeAdapterResponse({
      bytes_processed: 50,
      rows_affected: 3,
    });
    const t = buildAdapterTotals([a, b]);
    expect(t?.nodesWithAdapterData).toBe(2);
    expect(t?.totalBytesProcessed).toBe(150);
    expect(t?.totalSlotMs).toBe(10);
    expect(t?.totalRowsAffected).toBe(3);
  });

  it('sums snowflake-style DML totals when present', () => {
    const t = buildAdapterTotals([
      { rawKeys: ['rows_inserted'], rowsInserted: 10, rowsUpdated: 2 },
      { rawKeys: ['rows_deleted'], rowsDeleted: 3, rowsDuplicated: 1 },
    ]);
    expect(t?.nodesWithAdapterData).toBe(2);
    expect(t?.totalRowsInserted).toBe(10);
    expect(t?.totalRowsUpdated).toBe(2);
    expect(t?.totalRowsDeleted).toBe(3);
    expect(t?.totalRowsDuplicated).toBe(1);
  });
});
