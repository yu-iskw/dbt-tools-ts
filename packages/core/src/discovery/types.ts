/**
 * Normalized discovery output for CLI, web, and agents.
 */

export const DISCOVER_SCHEMA_VERSION = 1;

export type DiscoverConfidence = 'high' | 'medium' | 'low';

/** Machine-stable reason codes for ranking and explainability. */
export type DiscoverReason =
  | 'exact_name_match'
  | 'exact_unique_id_match'
  | 'substring_name_match'
  | 'substring_unique_id_match'
  | 'path_match'
  | 'original_file_path_match'
  | 'tag_match'
  | 'description_match'
  | 'package_match'
  | 'fuzzy_name_match'
  | 'alias_match'
  | 'high_downstream_fanout'
  | 'high_upstream_fanout';

export type DiscoverRelatedRelation = 'test' | 'upstream' | 'downstream' | 'parent';

export interface DiscoverRelatedEntry {
  unique_id: string;
  relation: DiscoverRelatedRelation;
}

export interface DiscoverDisambiguationEntry {
  unique_id: string;
  display_name: string;
  resource_type: string;
  package_name: string;
  reason: string;
}

export type DiscoverNextAction = 'explain' | 'impact' | 'diagnose' | 'deps' | 'inventory';

export interface DiscoverMatch {
  resource_type: string;
  unique_id: string;
  display_name: string;
  score: number;
  confidence: DiscoverConfidence;
  reasons: DiscoverReason[];
  disambiguation: DiscoverDisambiguationEntry[];
  related: DiscoverRelatedEntry[];
  next_actions: DiscoverNextAction[];
  /** Exact CLI invocations that reproduce follow-up primitives. */
  primitive_commands?: string[];
}

/** Optional envelope for `--trace` / agent debugging (CLI may attach). */
export interface InvestigationTranscript {
  intent?: string;
  input: string;
  steps: Array<{ op: string; status: 'ok' | 'error'; detail?: string }>;
}

export interface DiscoverOutput {
  discover_schema_version: number;
  query: string;
  matches: DiscoverMatch[];
  /** Deep link when `DBT_TOOLS_WEB_BASE_URL` is set (CLI / agents). */
  web_url?: string;
  /** Same as `web_url` for discover (review in web UI). */
  review_url?: string;
  investigation_transcript?: InvestigationTranscript;
}

export interface DiscoverOptions {
  /** Max matches returned (default 50). */
  limit?: number;
  /** Structured filters (CLI flags); inline `type:` tokens in query override when absent. */
  type?: string;
  package?: string;
  tag?: string;
  path?: string;
}
