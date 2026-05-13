/**
 * Adapter response parser dispatch system.
 *
 * Selects the best parser for a given adapter_response using a hybrid approach:
 * 1. Exact adapter type match (if adapterType is known and registered)
 * 2. Heuristic match (if parser has canParse() and it returns true)
 * 3. Generic fallback (always available)
 *
 * This ensures resilience: if adapter_type is missing, wrong, or empty,
 * we still parse correctly via heuristics or fallback.
 */

import type { AdapterResponseParser, AdapterResponseParserRegistry } from './types';
import { genericAdapterResponseParser } from './generic';
import { athenaAdapterResponseParser } from './parsers/athena';
import { bigqueryAdapterResponseParser } from './parsers/bigquery';
import { postgresAdapterResponseParser } from './parsers/postgres';
import { redshiftAdapterResponseParser } from './parsers/redshift';
import { snowflakeAdapterResponseParser } from './parsers/snowflake';
import { sparkAdapterResponseParser } from './parsers/spark';

/**
 * Registry of adapter-specific parsers keyed by adapter type.
 */
const parsersByAdapterType = new Map<string, AdapterResponseParser>([
  ['athena', athenaAdapterResponseParser],
  ['bigquery', bigqueryAdapterResponseParser],
  ['postgres', postgresAdapterResponseParser],
  ['redshift', redshiftAdapterResponseParser],
  ['snowflake', snowflakeAdapterResponseParser],
  ['spark', sparkAdapterResponseParser],
]);

/**
 * Parsers that provide heuristic matching via canParse().
 * Ordered by specificity: most distinctive adapters first.
 */
const heuristicParsers: AdapterResponseParser[] = [
  bigqueryAdapterResponseParser,
  snowflakeAdapterResponseParser,
  athenaAdapterResponseParser,
];

/**
 * Implementation of the parser registry.
 */
class AdapterResponseParserRegistryImpl implements AdapterResponseParserRegistry {
  selectParser(
    adapterType: string | null | undefined,
    adapterResponse: unknown,
  ): AdapterResponseParser {
    // 1. Try exact adapter type match (if compatible)
    if (adapterType && typeof adapterType === 'string') {
      const normalizedType = adapterType.toLowerCase().trim();
      const exactParser = parsersByAdapterType.get(normalizedType);
      if (exactParser) {
        // If the parser has a canParse method, verify compatibility
        // before using it. If incompatible, fall through to heuristics.
        if (!exactParser.canParse || exactParser.canParse(adapterResponse)) {
          return exactParser;
        }
      }
    }

    // 2. Try heuristic matching (canParse)
    for (const parser of heuristicParsers) {
      if (parser.canParse && parser.canParse(adapterResponse)) {
        return parser;
      }
    }

    // 3. Fall back to generic parser
    return genericAdapterResponseParser;
  }
}

/**
 * Singleton instance of the parser registry.
 */
export const adapterResponseParserRegistry = new AdapterResponseParserRegistryImpl();
