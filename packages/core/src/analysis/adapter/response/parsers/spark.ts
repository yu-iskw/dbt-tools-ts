/**
 * Spark adapter response parser.
 *
 * Spark returns a minimal response:
 * - _message: typically "OK"
 * - May also include generic fields like code, rows_affected, query_id, etc.
 */

import { mergeWithBaseFields } from './base';

import type { AdapterResponseMetrics } from '../../metrics';
import type { AdapterResponseParser } from '../types';

export const sparkAdapterResponseParser: AdapterResponseParser = {
  name: 'spark',

  parse(input: unknown): AdapterResponseMetrics {
    return mergeWithBaseFields(input, {});
  },

  // Spark has no distinctive heuristic keys
  // Let exact type match handle it
};
