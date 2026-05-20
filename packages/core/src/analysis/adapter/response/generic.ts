/**
 * Generic adapter response parser.
 * Falls back to existing best-effort normalization when adapter type is unknown or unavailable.
 * This is the safety net that ensures backward compatibility.
 */

import { mergeWithBaseFields } from './parsers/base';

import type { AdapterResponseMetrics } from '../metrics';
import type { AdapterResponseParser } from './types';

/**
 * Generic fallback parser: normalizes keys common across all adapters.
 * Inspects actual keys present in adapter_response and normalizes them
 * to the canonical AdapterResponseMetrics shape.
 */
export const genericAdapterResponseParser: AdapterResponseParser = {
  name: 'generic',

  parse(input: unknown): AdapterResponseMetrics {
    return mergeWithBaseFields(input, {});
  },

  // Generic parser has no heuristic; rely on exact type match or other parsers
};
