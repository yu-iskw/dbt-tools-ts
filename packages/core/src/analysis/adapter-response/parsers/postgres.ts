/**
 * Postgres adapter response parser.
 *
 * Postgres uses the base AdapterResponse contract:
 * - _message: from cursor.statusmessage
 * - rows_affected: from cursor.rowcount
 * - code: status message with numeric tokens removed
 * - May also include other generic fields like query_id.
 */

import type { AdapterResponseMetrics } from '../../adapter-response-metrics';
import type { AdapterResponseParser } from '../types';
import { mergeWithBaseFields } from './base';

export const postgresAdapterResponseParser: AdapterResponseParser = {
  name: 'postgres',

  parse(input: unknown): AdapterResponseMetrics {
    return mergeWithBaseFields(input, {});
  },

  // Postgres has no distinctive heuristic keys beyond base fields
  // Let exact type match handle it
};
