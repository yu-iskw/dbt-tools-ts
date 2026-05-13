/**
 * Adapter-aware response normalization for dbt run_results.
 *
 * This module provides context-aware parsing of adapter_response objects,
 * supporting all first-party dbt adapters (athena, bigquery, postgres,
 * redshift, snowflake, spark) while preserving a safe generic fallback.
 */

export type { AdapterResponseContext, AdapterResponseParser } from './types';

import type { AdapterResponseContext } from './types';
import type { AdapterResponseMetrics } from '../adapter-response-metrics';
import { coerceAdapterResponseInput, isAdapterResponseObject } from '../adapter-response-metrics';
import { adapterResponseParserRegistry } from './dispatch';

/**
 * Normalize adapter_response with optional adapter type context.
 *
 * Uses the provided adapterType (from manifest.metadata.adapter_type) as a
 * dispatch hint, but falls back to heuristic and generic parsing if the
 * type is missing, wrong, or unrecognized.
 *
 * @param adapterResponse - Raw adapter_response from run_results (may be stringified)
 * @param context - Optional context including adapter type hint
 * @returns Normalized metrics with canonical field names and raw keys
 */
export function normalizeAdapterResponseWithContext(
  adapterResponse: unknown,
  context?: AdapterResponseContext,
): AdapterResponseMetrics {
  const coerced = coerceAdapterResponseInput(adapterResponse);
  const adapterType = context?.adapterType;
  const parser = adapterResponseParserRegistry.selectParser(adapterType, coerced);
  return parser.parse(coerced);
}

// Re-export commonly-used utilities
export { isAdapterResponseObject, coerceAdapterResponseInput };
