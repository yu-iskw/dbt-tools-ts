import type { ManifestGraph } from '../analysis/manifest-graph';
import { discoverResources } from '../discovery/rank';
import type { DiscoverOutput } from '../discovery/types';
import type { DiscoverReason } from '../discovery/types';

export interface ResolvedIntentTarget {
  unique_id: string;
  why_it_matched: DiscoverReason[];
  /** Populated when resolution used discovery (for provenance / agents). */
  discover: DiscoverOutput | null;
}

/**
 * Resolve a CLI intent target: accept a full `unique_id`, or discover the best
 * match from a short name / fuzzy query. Throws when nothing matches or the
 * top candidates are too close in score (ambiguous).
 */
export function resolveIntentTarget(graph: ManifestGraph, input: string): ResolvedIntentTarget {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Target resource argument is required.');
  }

  const g = graph.getGraph();
  if (g.hasNode(trimmed)) {
    return {
      unique_id: trimmed,
      why_it_matched: ['exact_unique_id_match'],
      discover: null,
    };
  }

  const discover = discoverResources(graph, trimmed, { limit: 15 });
  if (discover.matches.length === 0) {
    throw new Error(`No resource matched "${trimmed}". Try: dbt-tools discover "${trimmed}"`);
  }

  const [first, second] = discover.matches;
  if (
    second != null &&
    Math.abs(first.score - second.score) < 0.05 &&
    first.display_name === second.display_name &&
    first.resource_type === second.resource_type
  ) {
    const ids = discover.matches
      .slice(0, 5)
      .map((m) => m.unique_id)
      .join(', ');
    throw new Error(
      `Ambiguous target "${trimmed}". Top candidates: ${ids}. Pass a full unique_id (see discover output).`,
    );
  }

  return {
    unique_id: first.unique_id,
    why_it_matched: [...first.reasons],
    discover,
  };
}
