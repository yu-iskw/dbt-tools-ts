/**
 * Redshift adapter response parser.
 *
 * Redshift returns a minimal base-like response:
 * - _message: typically "SUCCESS"
 * - rows_affected: from cursor.rowcount
 * - May also include generic fields like query_id, code, etc.
 */

import type { AdapterResponseMetrics } from '../../metrics';
import type { AdapterResponseParser } from '../types';
import { mergeWithBaseFields } from './base';

export const redshiftAdapterResponseParser: AdapterResponseParser = {
  name: 'redshift',

  parse(input: unknown): AdapterResponseMetrics {
    return mergeWithBaseFields(input, {});
  },

  // Redshift has no distinctive heuristic keys
  // Let exact type match handle it
};
