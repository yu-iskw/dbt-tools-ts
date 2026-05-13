/**
 * Core types for the adapter-response parsing system.
 */

import type { AdapterResponseMetrics } from '../adapter-response-metrics';

/**
 * Context passed to adapter response parsers.
 * Includes adapter type hint and other metadata that may help dispatch.
 */
export interface AdapterResponseContext {
  /** Adapter type from manifest metadata (hint, not authoritative). */
  adapterType?: string | null;
  /** Reserved for future extensions (warehouse name, dbt version, etc.). */
  [key: string]: unknown;
}

/**
 * A parser that normalizes an adapter_response object.
 */
export interface AdapterResponseParser {
  /** Unique identifier for this parser. */
  name: string;

  /**
   * Parse adapter_response into normalized metrics.
   * Should return { rawKeys: [] } for empty/invalid input.
   * Must not throw.
   */
  parse(input: unknown): AdapterResponseMetrics;

  /**
   * Optional: return true if this parser can likely handle this adapter_response.
   * Used for heuristic dispatch when adapter type is not known.
   * If not provided, parser is only used for exact adapter type match.
   */
  canParse?(input: unknown): boolean;
}

/**
 * Registry that maps adapter types to their parsers.
 */
export interface AdapterResponseParserRegistry {
  /**
   * Get the best parser for the given adapter type and response.
   * Returns a parser by:
   * 1. Exact adapter type match (if adapterType is known and registered)
   * 2. Heuristic match (if parser has canParse() and it returns true)
   * 3. Generic fallback (always available)
   */
  selectParser(
    adapterType: string | null | undefined,
    adapterResponse: unknown,
  ): AdapterResponseParser;
}
