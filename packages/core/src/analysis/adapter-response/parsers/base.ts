/**
 * Base adapter response field extraction utilities.
 *
 * Provides common field extraction logic for generic/base fields that may
 * appear in any adapter response. Typed adapters can use these to ensure
 * no regression in metadata capture while adding adapter-specific extraction.
 */

import type { AdapterResponseMetrics } from '../../adapter-response-metrics';
import {
  readFiniteNumber,
  readNonEmptyString,
  isPlainObject,
} from '../../adapter-response-metrics';

/**
 * Extracts generic/base fields from adapter response input.
 * These fields are common across adapters and should be preserved
 * even when using typed adapter parsers.
 *
 * @param input - Raw adapter response object
 * @returns Partial AdapterResponseMetrics with extracted generic fields
 */
export function extractBaseFields(input: unknown): Partial<AdapterResponseMetrics> {
  if (!isPlainObject(input)) {
    return {};
  }

  // Base fields present in all adapters
  const bytesProcessed = readFiniteNumber(input, 'bytes_processed');
  const bytesBilled = readFiniteNumber(input, 'bytes_billed');
  const slotMs = readFiniteNumber(input, 'slot_ms');
  const rowsAffected = readFiniteNumber(input, 'rows_affected');

  const adapterCode = readNonEmptyString(input, 'code');
  const adapterMessage = readNonEmptyString(input, '_message');

  // Query/job ID: prefer query_id but fall back to job_id (BigQuery pattern)
  const queryId = readNonEmptyString(input, 'query_id') ?? readNonEmptyString(input, 'job_id');

  const projectId = readNonEmptyString(input, 'project_id');
  const location = readNonEmptyString(input, 'location');

  return {
    ...(bytesProcessed !== undefined ? { bytesProcessed } : {}),
    ...(bytesBilled !== undefined ? { bytesBilled } : {}),
    ...(slotMs !== undefined ? { slotMs } : {}),
    ...(rowsAffected !== undefined ? { rowsAffected } : {}),
    ...(adapterCode !== undefined ? { adapterCode } : {}),
    ...(adapterMessage !== undefined ? { adapterMessage } : {}),
    ...(queryId !== undefined ? { queryId } : {}),
    ...(projectId !== undefined ? { projectId } : {}),
    ...(location !== undefined ? { location } : {}),
  };
}

/**
 * Merge base fields, adapter-specific fields, and raw keys into a canonical
 * adapter metrics object. Typed parsers should use this instead of rebuilding
 * the base normalization contract independently.
 */
export function mergeWithBaseFields(
  input: unknown,
  extraFields: Partial<AdapterResponseMetrics>,
): AdapterResponseMetrics {
  if (!isPlainObject(input)) {
    return { rawKeys: [] };
  }

  const rawKeys = Object.keys(input).filter((k) => typeof k === 'string');
  return {
    ...extractBaseFields(input),
    ...extraFields,
    rawKeys,
  };
}
