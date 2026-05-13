import type { DirectedGraph } from 'graphology';
import type { ManifestGraph } from '../analysis/manifest-graph';
import type { GraphEdgeAttributes, GraphNodeAttributes } from '../types';
import { applyDiscoveryNodeFilters, parseDiscoveryQueryTokens } from './query-parse';
import type {
  DiscoverConfidence,
  DiscoverDisambiguationEntry,
  DiscoverMatch,
  DiscoverNextAction,
  DiscoverOptions,
  DiscoverOutput,
  DiscoverReason,
  DiscoverRelatedEntry,
} from './types';
import { DISCOVER_SCHEMA_VERSION } from './types';

const DEFAULT_LIMIT = 50;

/** Levenshtein distance; caller should bound string lengths for performance. */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prevDiag = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j]!;
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      dp[j] = Math.min(dp[j]! + 1, dp[j - 1]! + 1, prevDiag + cost);
      prevDiag = temp;
    }
  }
  return dp[n]!;
}

function pushReason(reasons: DiscoverReason[], code: DiscoverReason): void {
  if (!reasons.includes(code)) reasons.push(code);
}

function scoreNameAndId(
  term: string,
  lName: string,
  lId: string,
  reasons: DiscoverReason[],
): number {
  let best = 0;
  if (lName === term || lId === term) {
    if (lName === term) pushReason(reasons, 'exact_name_match');
    if (lId === term) pushReason(reasons, 'exact_unique_id_match');
    best = Math.max(best, 100);
  }
  if (lName.includes(term) || lId.includes(term)) {
    if (lName.includes(term) && lName !== term) {
      pushReason(reasons, 'substring_name_match');
    }
    if (lId.includes(term) && lId !== term) {
      pushReason(reasons, 'substring_unique_id_match');
    }
    best = Math.max(best, 60);
  }
  return best;
}

function scorePaths(term: string, lPath: string, lOfp: string, reasons: DiscoverReason[]): number {
  let best = 0;
  if (lPath.includes(term) || lOfp.includes(term)) {
    if (lPath.includes(term)) pushReason(reasons, 'path_match');
    if (lOfp.includes(term)) pushReason(reasons, 'original_file_path_match');
    best = Math.max(best, 30);
  }
  return best;
}

function scoreDescriptionTagsPackage(
  term: string,
  lDesc: string,
  lTags: string[],
  lPkg: string,
  reasons: DiscoverReason[],
): number {
  let best = 0;
  if (lDesc.includes(term)) {
    pushReason(reasons, 'description_match');
    best = Math.max(best, 35);
  }
  if (lTags.some((t) => t === term || t.includes(term))) {
    pushReason(reasons, 'tag_match');
    best = Math.max(best, 40);
  }
  if (lPkg === term || lPkg.includes(term)) {
    pushReason(reasons, 'package_match');
    best = Math.max(best, lPkg === term ? 50 : 25);
  }
  return best;
}

function applyAliasAndFuzzyName(
  graph: ManifestGraph,
  rawTerm: string,
  term: string,
  attrs: GraphNodeAttributes,
  lName: string,
  reasons: DiscoverReason[],
  priorBest: number,
): number {
  let best = priorBest;
  const resolved = graph.tryResolveRelationName(rawTerm);
  if (resolved === attrs.unique_id) {
    pushReason(reasons, 'alias_match');
    best = Math.max(best, 90);
  }
  if (term.length >= 4 && lName.length <= 64 && lName.length > 0 && best < 60) {
    const d = levenshteinDistance(lName, term);
    if (d <= 2 && d < lName.length) {
      pushReason(reasons, 'fuzzy_name_match');
      best = Math.max(best, 45 - d * 5);
    }
  }
  return best;
}

function scoreTermAgainstNode(
  graph: ManifestGraph,
  attrs: GraphNodeAttributes,
  rawTerm: string,
  reasons: DiscoverReason[],
): number {
  const term = rawTerm.toLowerCase();
  if (!term) return 0;

  const lName = (attrs.name || '').toLowerCase();
  const lId = (attrs.unique_id || '').toLowerCase();
  const lPkg = (attrs.package_name || '').toLowerCase();
  const lPath = ((attrs.path as string | undefined) || '').toLowerCase();
  const lOfp = ((attrs.original_file_path as string | undefined) || '').toLowerCase();
  const lDesc = ((attrs.description as string | undefined) || '').toLowerCase();
  const lTags = ((attrs.tags as string[] | undefined) || []).map((t) => t.toLowerCase());

  let best = scoreNameAndId(term, lName, lId, reasons);
  best = Math.max(best, scorePaths(term, lPath, lOfp, reasons));
  best = Math.max(best, scoreDescriptionTagsPackage(term, lDesc, lTags, lPkg, reasons));
  return applyAliasAndFuzzyName(graph, rawTerm, term, attrs, lName, reasons, best);
}

function neighborCount(
  g: DirectedGraph<GraphNodeAttributes, GraphEdgeAttributes>,
  nodeId: string,
  direction: 'in' | 'out',
): number {
  return direction === 'in'
    ? g.inboundNeighbors(nodeId).length
    : g.outboundNeighbors(nodeId).length;
}

function defaultNextActions(resourceType: string): DiscoverNextAction[] {
  if (resourceType === 'test' || resourceType === 'unit_test') {
    return ['explain', 'diagnose', 'deps'];
  }
  return ['explain', 'impact', 'diagnose'];
}

function buildPrimitiveCommands(uniqueId: string): string[] {
  const q = JSON.stringify(uniqueId);
  return [
    `dbt-tools explain ${q}`,
    `dbt-tools impact ${q}`,
    `dbt-tools deps ${q} --direction downstream`,
    `dbt-tools search ${q}`,
  ];
}

function buildRelated(
  g: DirectedGraph<GraphNodeAttributes, GraphEdgeAttributes>,
  nodeId: string,
  attrs: GraphNodeAttributes,
): DiscoverRelatedEntry[] {
  const related: DiscoverRelatedEntry[] = [];
  const seen = new Set<string>();

  const push = (uid: string, relation: DiscoverRelatedEntry['relation']) => {
    if (uid === nodeId || seen.has(uid)) return;
    if (!g.hasNode(uid)) return;
    const a = g.getNodeAttributes(uid) as GraphNodeAttributes;
    if (a.resource_type === 'field') return;
    seen.add(uid);
    related.push({ unique_id: uid, relation });
  };

  for (const up of g.inboundNeighbors(nodeId)) {
    push(up, 'upstream');
    if (related.length >= 6) break;
  }

  for (const down of g.outboundNeighbors(nodeId)) {
    const a = g.getNodeAttributes(down) as GraphNodeAttributes;
    const rt = a.resource_type || '';
    if (rt === 'test' || rt === 'unit_test') {
      push(down, 'test');
    } else {
      push(down, 'downstream');
    }
    if (related.length >= 10) break;
  }

  const parentId = attrs.parent_id as string | undefined;
  if (parentId && g.hasNode(parentId)) {
    push(parentId, 'parent');
  }

  return related.slice(0, 12);
}

function buildDisambiguation(
  selfId: string,
  selfRaw: number,
  selfName: string,
  candidates: Array<{
    unique_id: string;
    raw: number;
    attrs: GraphNodeAttributes;
  }>,
  epsilonRatio: number,
): DiscoverDisambiguationEntry[] {
  const out: DiscoverDisambiguationEntry[] = [];
  const lname = selfName.toLowerCase();
  for (const c of candidates) {
    if (c.unique_id === selfId) continue;
    if (c.attrs.name.toLowerCase() !== lname) continue;
    if (selfRaw > 0 && Math.abs(c.raw - selfRaw) / selfRaw > epsilonRatio) {
      continue;
    }
    out.push({
      unique_id: c.unique_id,
      display_name: c.attrs.name,
      resource_type: c.attrs.resource_type,
      package_name: c.attrs.package_name,
      reason: 'same_display_name_different_package_or_path',
    });
    if (out.length >= 8) break;
  }
  return out;
}

function confidenceFromScore(normalized: number): DiscoverConfidence {
  if (normalized >= 0.85) return 'high';
  if (normalized >= 0.5) return 'medium';
  return 'low';
}

/**
 * Rank manifest nodes for an ambiguous query with explainable reasons.
 */
export function discoverResources(
  graph: ManifestGraph,
  query: string,
  options: DiscoverOptions = {},
): DiscoverOutput {
  const trimmed = query.trim();
  const parsed = parseDiscoveryQueryTokens(trimmed);
  const effectiveType = options.type ?? parsed.type;
  const effectivePackage = options.package ?? parsed.package;
  const effectiveTag = options.tag ?? parsed.tag;
  const pathFilter = options.path ?? parsed.path;

  const hasStructuredFilter = Boolean(
    effectiveType || effectivePackage || effectiveTag || pathFilter,
  );

  if (!trimmed && !hasStructuredFilter) {
    return {
      discover_schema_version: DISCOVER_SCHEMA_VERSION,
      query: trimmed,
      matches: [],
    };
  }

  const g = graph.getGraph();
  const limit = Math.min(Math.max(1, options.limit ?? DEFAULT_LIMIT), 200);

  type Row = {
    unique_id: string;
    attrs: GraphNodeAttributes;
    raw: number;
    reasons: DiscoverReason[];
  };

  const rows: Row[] = [];

  g.forEachNode((nodeId, attrs) => {
    if (
      !applyDiscoveryNodeFilters(attrs, effectiveType, effectivePackage, effectiveTag, pathFilter)
    ) {
      return;
    }

    const reasons: DiscoverReason[] = [];
    let raw = 0;

    if (parsed.terms.length === 0) {
      if (!hasStructuredFilter) {
        return;
      }
      raw = 5;
    } else {
      for (const term of parsed.terms) {
        const t = scoreTermAgainstNode(graph, attrs, term, reasons);
        if (t === 0) return;
        raw += t;
      }
    }

    const upN = neighborCount(g, nodeId, 'in');
    const downN = neighborCount(g, nodeId, 'out');
    if (downN >= 8) {
      pushReason(reasons, 'high_downstream_fanout');
      raw += Math.min(20, Math.log1p(downN) * 4);
    }
    if (upN >= 8) {
      pushReason(reasons, 'high_upstream_fanout');
      raw += Math.min(15, Math.log1p(upN) * 3);
    }

    rows.push({ unique_id: nodeId, attrs, raw, reasons });
  });

  if (rows.length === 0) {
    return {
      discover_schema_version: DISCOVER_SCHEMA_VERSION,
      query: trimmed,
      matches: [],
    };
  }

  let maxRaw = rows.reduce((m, r) => Math.max(m, r.raw), 0);
  if (maxRaw <= 0) maxRaw = 1;

  rows.sort((a, b) => {
    if (b.raw !== a.raw) return b.raw - a.raw;
    return a.unique_id.localeCompare(b.unique_id);
  });

  const topSlice = rows.slice(0, limit);
  const matches: DiscoverMatch[] = topSlice.map((row) => {
    const normalized = Math.min(1, row.raw / maxRaw);
    const disambiguation = buildDisambiguation(row.unique_id, row.raw, row.attrs.name, rows, 0.12);

    return {
      resource_type: row.attrs.resource_type,
      unique_id: row.unique_id,
      display_name: row.attrs.name,
      score: Math.round(normalized * 1000) / 1000,
      confidence: confidenceFromScore(normalized),
      reasons: row.reasons,
      disambiguation,
      related: buildRelated(g, row.unique_id, row.attrs),
      next_actions: defaultNextActions(row.attrs.resource_type),
      primitive_commands: buildPrimitiveCommands(row.unique_id),
    };
  });

  return {
    discover_schema_version: DISCOVER_SCHEMA_VERSION,
    query: trimmed,
    matches,
  };
}
