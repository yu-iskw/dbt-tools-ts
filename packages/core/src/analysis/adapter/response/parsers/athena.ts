/**
 * Athena adapter response parser.
 *
 * AthenaAdapterResponse extends AdapterResponse with:
 * - data_scanned_in_bytes: amount of data scanned (maps to canonical bytesProcessed)
 * - Generic fields via base field extraction
 */

import { readFiniteNumber, isPlainObject } from '../../metrics';

import { mergeWithBaseFields } from './base';

import type { AdapterResponseMetrics } from '../../metrics';
import type { AdapterResponseParser } from '../types';

export const athenaAdapterResponseParser: AdapterResponseParser = {
  name: 'athena',

  parse(input: unknown): AdapterResponseMetrics {
    if (!isPlainObject(input)) {
      return { rawKeys: [] };
    }

    // Athena-specific: data_scanned_in_bytes maps to canonical bytesProcessed
    const bytesProcessed = readFiniteNumber(input, 'data_scanned_in_bytes');

    return mergeWithBaseFields(input, {
      ...(bytesProcessed !== undefined ? { bytesProcessed } : {}),
    });
  },

  canParse(input: unknown): boolean {
    // Athena typically has data_scanned_in_bytes
    if (!isPlainObject(input)) return false;
    return 'data_scanned_in_bytes' in input;
  },
};
