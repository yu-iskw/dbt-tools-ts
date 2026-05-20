/**
 * Tests for adapter-aware response normalization.
 * Covers all six first-party adapters, dispatch logic, and fallback behavior.
 */

import { describe, it, expect } from 'vitest';

import { isAdapterResponseObject, coerceAdapterResponseInput } from '../metrics';

import { adapterResponseParserRegistry } from './dispatch';

import { normalizeAdapterResponseWithContext } from './index';

describe('Adapter Response Parsers', () => {
  describe('Generic / Fallback behavior', () => {
    it('returns empty metrics for non-object input', () => {
      const result = normalizeAdapterResponseWithContext(null);
      expect(result.rawKeys).toEqual([]);
      expect(result.adapterMessage).toBeUndefined();
    });

    it('parses stringified JSON object', () => {
      const result = normalizeAdapterResponseWithContext(
        JSON.stringify({ _message: 'test', code: 'OK' }),
      );
      expect(result.adapterMessage).toBe('test');
      expect(result.adapterCode).toBe('OK');
    });

    it('treats empty object as no normalized fields but lists rawKeys', () => {
      const result = normalizeAdapterResponseWithContext({});
      expect(result.rawKeys).toEqual([]);
      expect(result.adapterMessage).toBeUndefined();
      expect(result.adapterCode).toBeUndefined();
    });

    it('parses numeric strings in base fields', () => {
      const result = normalizeAdapterResponseWithContext({
        bytes_processed: '1024',
        slot_ms: '99',
        rows_affected: '50',
      });
      expect(result.bytesProcessed).toBe(1024);
      expect(result.slotMs).toBe(99);
      expect(result.rowsAffected).toBe(50);
    });

    it('ignores non-finite numbers', () => {
      const result = normalizeAdapterResponseWithContext({
        bytes_processed: Number.NaN,
        slot_ms: Number.POSITIVE_INFINITY,
      });
      expect(result.bytesProcessed).toBeUndefined();
      expect(result.slotMs).toBeUndefined();
    });
  });

  describe('BigQuery adapter', () => {
    it('parses BigQuery response with all fields', () => {
      const result = normalizeAdapterResponseWithContext(
        {
          _message: 'CREATE VIEW (0 processed)',
          code: 'CREATE VIEW',
          bytes_processed: 0,
          bytes_billed: 0,
          location: 'asia-northeast1',
          project_id: 'my-project',
          job_id: '4825e532-3019-4417-bc75-64b304316b2f',
          slot_ms: 0,
        },
        { adapterType: 'bigquery' },
      );
      expect(result.bytesProcessed).toBe(0);
      expect(result.bytesBilled).toBe(0);
      expect(result.slotMs).toBe(0);
      expect(result.adapterCode).toBe('CREATE VIEW');
      expect(result.adapterMessage).toBe('CREATE VIEW (0 processed)');
      expect(result.queryId).toBe('4825e532-3019-4417-bc75-64b304316b2f');
      expect(result.projectId).toBe('my-project');
      expect(result.location).toBe('asia-northeast1');
      expect(result.rawKeys.length).toBeGreaterThan(0);
    });

    it('maps job_id to queryId when query_id is absent', () => {
      const result = normalizeAdapterResponseWithContext(
        { job_id: 'bq-job-123', bytes_processed: 5000 },
        { adapterType: 'bigquery' },
      );
      expect(result.queryId).toBe('bq-job-123');
      expect(result.bytesProcessed).toBe(5000);
    });

    it('prefers query_id over job_id when both present', () => {
      const result = normalizeAdapterResponseWithContext(
        { query_id: 'query-123', job_id: 'job-456' },
        { adapterType: 'bigquery' },
      );
      expect(result.queryId).toBe('query-123');
    });

    it('detects BigQuery via heuristic when type not provided', () => {
      const result = normalizeAdapterResponseWithContext({
        bytes_processed: 5000,
        bytes_billed: 2500,
        slot_ms: 100,
        location: 'us-west1',
      });
      expect(result.bytesProcessed).toBe(5000);
      expect(result.bytesBilled).toBe(2500);
      expect(result.slotMs).toBe(100);
      expect(result.location).toBe('us-west1');
    });
  });

  describe('Snowflake adapter', () => {
    it('parses Snowflake response with base fields', () => {
      const result = normalizeAdapterResponseWithContext(
        {
          _message: 'INSERT',
          code: 'INSERT',
          rows_affected: 100,
          query_id: '01ab5e0e-0000-52c2-0000-00000000001c',
        },
        { adapterType: 'snowflake' },
      );
      expect(result.adapterMessage).toBe('INSERT');
      expect(result.adapterCode).toBe('INSERT');
      expect(result.rowsAffected).toBe(100);
      expect(result.queryId).toBe('01ab5e0e-0000-52c2-0000-00000000001c');
    });

    it('parses Snowflake DML stats', () => {
      const result = normalizeAdapterResponseWithContext(
        {
          _message: 'INSERT',
          rows_affected: 50,
          rows_inserted: 50,
          rows_deleted: 0,
          rows_updated: 0,
          rows_duplicates: 0,
        },
        { adapterType: 'snowflake' },
      );
      expect(result.rowsAffected).toBe(50);
      expect(result.rowsInserted).toBe(50);
      expect(result.rowsDeleted).toBe(0);
      expect(result.rowsUpdated).toBe(0);
      expect(result.rowsDuplicated).toBe(0);
    });

    it('detects Snowflake via heuristic when DML stats present', () => {
      const result = normalizeAdapterResponseWithContext({
        rows_inserted: 100,
        rows_deleted: 10,
        rows_updated: 5,
      });
      expect(result.rowsInserted).toBe(100);
      expect(result.rowsDeleted).toBe(10);
      expect(result.rowsUpdated).toBe(5);
    });
  });

  describe('Athena adapter', () => {
    it('parses Athena response with data_scanned_in_bytes', () => {
      const result = normalizeAdapterResponseWithContext(
        {
          _message: 'OK',
          code: 'OK',
          rows_affected: 42,
          data_scanned_in_bytes: 512000,
        },
        { adapterType: 'athena' },
      );
      expect(result.adapterMessage).toBe('OK');
      expect(result.adapterCode).toBe('OK');
      expect(result.rowsAffected).toBe(42);
      // data_scanned_in_bytes maps to canonical bytesProcessed
      expect(result.bytesProcessed).toBe(512000);
    });

    it('detects Athena via heuristic when data_scanned_in_bytes present', () => {
      const result = normalizeAdapterResponseWithContext({
        data_scanned_in_bytes: 1024000,
        rows_affected: 10,
      });
      expect(result.bytesProcessed).toBe(1024000);
    });
  });

  describe('Postgres adapter', () => {
    it('parses Postgres response with base fields only', () => {
      const result = normalizeAdapterResponseWithContext(
        {
          _message: 'INSERT 100',
          code: 'INSERT',
          rows_affected: 100,
        },
        { adapterType: 'postgres' },
      );
      expect(result.adapterMessage).toBe('INSERT 100');
      expect(result.adapterCode).toBe('INSERT');
      expect(result.rowsAffected).toBe(100);
      // No special postgres-specific fields
      expect(result.bytesProcessed).toBeUndefined();
      expect(result.slotMs).toBeUndefined();
    });
  });

  describe('Redshift adapter', () => {
    it('parses Redshift response with minimal fields', () => {
      const result = normalizeAdapterResponseWithContext(
        {
          _message: 'SUCCESS',
          rows_affected: 5,
        },
        { adapterType: 'redshift' },
      );
      expect(result.adapterMessage).toBe('SUCCESS');
      expect(result.rowsAffected).toBe(5);
      expect(result.adapterCode).toBeUndefined();
    });

    it('preserves generic fields like query_id in Redshift response', () => {
      const result = normalizeAdapterResponseWithContext(
        {
          _message: 'INSERT',
          code: 'INSERT',
          rows_affected: 10,
          query_id: 'redshift-query-123',
        },
        { adapterType: 'redshift' },
      );
      // Should preserve all generic fields, not just adapter-specific ones
      expect(result.adapterMessage).toBe('INSERT');
      expect(result.adapterCode).toBe('INSERT');
      expect(result.rowsAffected).toBe(10);
      expect(result.queryId).toBe('redshift-query-123');
    });
  });

  describe('Spark adapter', () => {
    it('parses Spark response with minimal fields', () => {
      const result = normalizeAdapterResponseWithContext(
        {
          _message: 'OK',
        },
        { adapterType: 'spark' },
      );
      expect(result.adapterMessage).toBe('OK');
      expect(result.rowsAffected).toBeUndefined();
    });
  });

  describe('Dispatch correctness', () => {
    it('selects correct parser with exact adapter type match', () => {
      const response = { bytes_processed: 100, location: 'us-east1' };
      const parser = adapterResponseParserRegistry.selectParser('bigquery', response);
      expect(parser.name).toBe('bigquery');
    });

    it('uses heuristic when adapter type is missing', () => {
      const bigqueryResponse = {
        bytes_processed: 1000,
        bytes_billed: 500,
      };
      const parser = adapterResponseParserRegistry.selectParser(null, bigqueryResponse);
      expect(parser.name).toBe('bigquery');

      const snowflakeResponse = { rows_inserted: 50, rows_deleted: 10 };
      const parser2 = adapterResponseParserRegistry.selectParser(undefined, snowflakeResponse);
      expect(parser2.name).toBe('snowflake');
    });

    it('falls back to generic parser when type unknown and no heuristic match', () => {
      const response = { custom_field: 'value', _message: 'test' };
      const parser = adapterResponseParserRegistry.selectParser('unknown_adapter', response);
      expect(parser.name).toBe('generic');
    });

    it('falls back to generic for empty object even with adapter type', () => {
      const parser = adapterResponseParserRegistry.selectParser('bigquery', {});
      // BigQuery parser's canParse() returns false for empty object.
      // No heuristics match either, so falls back to generic.
      expect(parser.name).toBe('generic');
      const result = parser.parse({});
      expect(result.rawKeys.length).toBe(0);
    });

    it('when adapter type is explicitly wrong and incompatible, falls back to heuristics', () => {
      const snowflakePayload = {
        rows_inserted: 100,
        rows_deleted: 5,
        query_id: 'sf-1',
      };
      // Pass wrong adapter type explicitly
      const result = normalizeAdapterResponseWithContext(snowflakePayload, {
        adapterType: 'bigquery', // Wrong adapter type!
      });
      // BigQuery parser's canParse() returns false because payload lacks BigQuery fields
      // (bytes_processed, bytes_billed, slot_ms, job_id, location).
      // Falls back to heuristics, which detects Snowflake via rows_inserted/rows_deleted.
      expect(result.queryId).toBe('sf-1');
      // Snowflake-specific fields ARE parsed because Snowflake parser is used (heuristic)
      expect(result.rowsInserted).toBe(100);
      expect(result.rowsDeleted).toBe(5);
    });

    it('when adapter type is missing, heuristic detects Snowflake fields correctly', () => {
      const snowflakePayload = {
        rows_inserted: 100,
        rows_deleted: 5,
        query_id: 'sf-1',
      };
      // Pass no adapter type, let heuristic detect
      const result = normalizeAdapterResponseWithContext(snowflakePayload, {
        adapterType: undefined, // No hint
      });
      // Heuristic should detect Snowflake via rows_inserted, rows_deleted, etc.
      expect(result.rowsInserted).toBe(100);
      expect(result.rowsDeleted).toBe(5);
      expect(result.queryId).toBe('sf-1');
    });

    it('handles normalized type names (case-insensitive)', () => {
      const response = { job_id: 'bq-123', bytes_processed: 1000 };
      const result1 = normalizeAdapterResponseWithContext(response, {
        adapterType: 'BIGQUERY',
      });
      const result2 = normalizeAdapterResponseWithContext(response, {
        adapterType: 'BigQuery',
      });
      expect(result1.queryId).toBe('bq-123');
      expect(result2.queryId).toBe('bq-123');
    });
  });

  describe('Utilities', () => {
    it('coerceAdapterResponseInput handles stringified objects', () => {
      const coerced = coerceAdapterResponseInput(JSON.stringify({ _message: 'test' }));
      expect(coerced).toEqual({ _message: 'test' });
    });

    it('coerceAdapterResponseInput leaves non-JSON strings unchanged', () => {
      expect(coerceAdapterResponseInput('plain string')).toBe('plain string');
    });

    it('isAdapterResponseObject works correctly', () => {
      expect(isAdapterResponseObject({})).toBe(true);
      expect(isAdapterResponseObject({ key: 'value' })).toBe(true);
      expect(isAdapterResponseObject(null)).toBe(false);
      expect(isAdapterResponseObject([])).toBe(false);
      expect(isAdapterResponseObject('string')).toBe(false);
    });
  });

  describe('Backward compatibility', () => {
    it('existing code without adapter type still works', () => {
      // Without context, should still parse base fields
      const result = normalizeAdapterResponseWithContext({
        _message: 'CREATE VIEW',
        code: 'CREATE VIEW',
        bytes_processed: 100,
        rows_affected: 0,
      });
      expect(result.adapterMessage).toBe('CREATE VIEW');
      expect(result.adapterCode).toBe('CREATE VIEW');
      expect(result.bytesProcessed).toBe(100);
      expect(result.rowsAffected).toBe(0);
    });

    it('BigQuery without adapter type still parses via heuristic', () => {
      const result = normalizeAdapterResponseWithContext({
        bytes_processed: 1000,
        bytes_billed: 500,
        slot_ms: 50,
        job_id: 'job-456',
        location: 'us-west1',
      });
      expect(result.bytesProcessed).toBe(1000);
      expect(result.bytesBilled).toBe(500);
      expect(result.slotMs).toBe(50);
      expect(result.queryId).toBe('job-456');
      expect(result.location).toBe('us-west1');
    });
  });
});
