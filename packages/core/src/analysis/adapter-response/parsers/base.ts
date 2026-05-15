/**
 * Base adapter response field extraction utilities.
 *
 * Provides common field extraction logic for generic/base fields that may
 * appear in any adapter response. Typed adapters can use these to ensure
 * no regression in metadata capture while adding adapter-specific extraction.
 */

import type { AdapterResponseMetrics } from '../../adapter-response-metrics';
import { extractBaseFields, isPlainObject } from '../../adapter-response-metrics';

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
