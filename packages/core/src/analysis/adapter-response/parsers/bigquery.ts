/**
 * BigQuery adapter response parser.
 *
 * BigQueryAdapterResponse extends AdapterResponse with:
 * - bytes_processed: data scanned in bytes
 * - bytes_billed: billable data in bytes
 * - slot_ms: slot-milliseconds consumed
 * - project_id: GCP project ID
 * - location: dataset location
 * - job_id: BigQuery job ID (maps to canonical queryId)
 *
 * Also preserves generic fields via base field extraction.
 */

import type { AdapterResponseMetrics } from '../../adapter-response-metrics';
import type { AdapterResponseParser } from '../types';
import {
  readFiniteNumber,
  readNonEmptyString,
  isPlainObject,
} from '../../adapter-response-metrics';
import { mergeWithBaseFields } from './base';

export const bigqueryAdapterResponseParser: AdapterResponseParser = {
  name: 'bigquery',

  parse(input: unknown): AdapterResponseMetrics {
    if (!isPlainObject(input)) {
      return { rawKeys: [] };
    }

    // BigQuery-specific fields (override base if both present)
    const bytesProcessed = readFiniteNumber(input, 'bytes_processed');
    const bytesBilled = readFiniteNumber(input, 'bytes_billed');
    const slotMs = readFiniteNumber(input, 'slot_ms');
    const projectId = readNonEmptyString(input, 'project_id');
    const location = readNonEmptyString(input, 'location');

    // BigQuery uses job_id as primary identifier; map to canonical queryId
    // but also check for query_id as fallback
    const queryId = readNonEmptyString(input, 'query_id') ?? readNonEmptyString(input, 'job_id');

    return mergeWithBaseFields(input, {
      ...(bytesProcessed !== undefined ? { bytesProcessed } : {}),
      ...(bytesBilled !== undefined ? { bytesBilled } : {}),
      ...(slotMs !== undefined ? { slotMs } : {}),
      ...(queryId !== undefined ? { queryId } : {}),
      ...(projectId !== undefined ? { projectId } : {}),
      ...(location !== undefined ? { location } : {}),
    });
  },

  canParse(input: unknown): boolean {
    // BigQuery typically has bytes_processed, bytes_billed, or job_id
    if (!isPlainObject(input)) return false;
    return (
      'bytes_processed' in input ||
      'bytes_billed' in input ||
      'slot_ms' in input ||
      'job_id' in input ||
      'location' in input
    );
  },
};
