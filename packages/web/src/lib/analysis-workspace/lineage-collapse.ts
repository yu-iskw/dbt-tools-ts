import { compareText, edgeCrossingKey } from './lineage-grouping';
import { formatResourceTypeLabel } from './utils';

import type { GroupPlaceholder } from './lineage-group-layout';
import type { LineageGroupModel } from './lineage-grouping';
import type { LineageGraphNodeLayout } from './lineage-model';
import type { BoundaryCrossing, ResourceNode } from '@dbt-tools/core/browser';

/** Grouped graphs with more nodes than this start with most containers collapsed (ADR-0018). */
export const AUTO_COLLAPSE_NODE_THRESHOLD = 40;

const SUMMARY_ID_PREFIX = 'summary:';

type EdgeEnds = { from: string; to: string };
type ResourceFacts = Pick<ResourceNode, 'resourceType' | 'statusTone'>;

export interface SummaryNode {
  /** `summary:<groupId>`; used as an endpoint id in `displayEdges`. */
  id: string;
  groupId: string;
  label: string;
  levelLabel: string;
  memberIds: string[];
  memberCount: number;
  typeCounts: Array<{ resourceType: string; count: number }>;
  statusCounts: Array<{ tone: string; count: number }>;
  /** Edges with both endpoints inside this collapsed container. */
  internalEdgeCount: number;
}

export interface DisplayEdge {
  from: string;
  to: string;
  /** Number of real edges folded into this drawn edge. */
  count: number;
  /** Strongest crossing tier among the member edges. */
  crossing: BoundaryCrossing;
  memberEdges: EdgeEnds[];
}

export interface LineageCollapse {
  /** Real nodes that stay drawn (members of collapsed containers are absent). */
  nodeIds: string[];
  summaries: SummaryNode[];
  displayEdges: DisplayEdge[];
  /** Edges hidden inside collapsed containers. */
  internalEdgeCount: number;
  /** Edges folded into a bundle or hidden inside a container: every edge not drawn on its own. */
  bundledEdgeCount: number;
  /** Containers actually collapsed, after the selected container rule. */
  collapsedGroupIds: string[];
}

export function summaryNodeId(groupId: string): string {
  return `${SUMMARY_ID_PREFIX}${groupId}`;
}

export function isSummaryNodeId(id: string): boolean {
  return id.startsWith(SUMMARY_ID_PREFIX);
}

const TIER_RANK = new Map<BoundaryCrossing, number>([
  ['none', 0],
  ['inner', 1],
  ['outer', 2],
]);

function strongerTier(a: BoundaryCrossing, b: BoundaryCrossing): BoundaryCrossing {
  return (TIER_RANK.get(b) ?? 0) > (TIER_RANK.get(a) ?? 0) ? b : a;
}

/** Containers that can collapse: inner containers and the "Not in warehouse" lane. */
export function collapsibleGroupIds(groupModel: LineageGroupModel): string[] {
  return groupModel.groups.filter((group) => group.kind !== 'outer').map((group) => group.id);
}

/** Collapsible containers except the one holding the selected node, which is never collapsed. */
export function toggleableGroupIds(groupModel: LineageGroupModel, selectedId: string): Set<string> {
  const selectedGroupId = groupModel.groupIdByNodeId.get(selectedId);
  return new Set(collapsibleGroupIds(groupModel).filter((id) => id !== selectedGroupId));
}

/**
 * Starting state: small graphs stay expanded. Larger ones collapse every container except the
 * selected node's. Containers holding its direct neighbours collapse too: on a dense graph they
 * are what makes the selected node's fan of edges, and as bundles they read as one counted edge
 * per container.
 */
export function defaultCollapsedGroupIds({
  groupModel,
  selectedId,
}: {
  groupModel: LineageGroupModel;
  selectedId: string;
}): Set<string> {
  if (groupModel.groupIdByNodeId.size <= AUTO_COLLAPSE_NODE_THRESHOLD) return new Set();
  return toggleableGroupIds(groupModel, selectedId);
}

function tally<K extends string>(keys: readonly K[]): Array<[K, number]> {
  const counts = new Map<K, number>();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  return [...counts].sort(([ka, a], [kb, b]) => b - a || compareText(ka, kb));
}

function buildSummary(
  group: LineageGroupModel['groups'][number],
  memberIds: string[],
  resourceById: ReadonlyMap<string, ResourceFacts>,
): SummaryNode {
  const facts = memberIds.map((id) => resourceById.get(id));
  return {
    id: summaryNodeId(group.id),
    groupId: group.id,
    label: group.label,
    levelLabel: group.levelLabel,
    memberIds,
    memberCount: memberIds.length,
    typeCounts: tally(facts.map((fact) => fact?.resourceType ?? 'unknown')).map(
      ([resourceType, count]) => ({ resourceType, count }),
    ),
    statusCounts: tally(facts.map((fact) => fact?.statusTone ?? 'neutral')).map(
      ([tone, count]) => ({ tone, count }),
    ),
    internalEdgeCount: 0,
  };
}

/**
 * Collapses containers into summary nodes and bundles edges between display nodes.
 * Pure and deterministic. Conservation (ADR-0018): `sum(displayEdges.count) + internalEdgeCount`
 * always equals `edges.length`, and no edge changes direction.
 */
export function buildLineageCollapse({
  nodeIds,
  edges,
  groupModel,
  resourceById,
  collapsedGroupIds,
  selectedId,
}: {
  nodeIds: readonly string[];
  edges: readonly EdgeEnds[];
  groupModel: LineageGroupModel;
  resourceById: ReadonlyMap<string, ResourceFacts>;
  collapsedGroupIds: ReadonlySet<string>;
  selectedId: string;
}): LineageCollapse {
  const allowed = toggleableGroupIds(groupModel, selectedId);
  const membersByGroup = new Map<string, string[]>();
  const keptNodeIds: string[] = [];
  for (const id of nodeIds) {
    const groupId = groupModel.groupIdByNodeId.get(id);
    if (groupId !== undefined && allowed.has(groupId) && collapsedGroupIds.has(groupId)) {
      membersByGroup.set(groupId, [...(membersByGroup.get(groupId) ?? []), id]);
    } else {
      keptNodeIds.push(id);
    }
  }

  const summaries = groupModel.groups.flatMap((group) => {
    const memberIds = membersByGroup.get(group.id);
    return memberIds ? [buildSummary(group, memberIds, resourceById)] : [];
  });
  const summaryByGroup = new Map(summaries.map((summary) => [summary.groupId, summary]));
  const summaryById = new Map(summaries.map((summary) => [summary.id, summary]));
  const displayIdOf = (id: string): string => {
    const groupId = groupModel.groupIdByNodeId.get(id);
    return (groupId !== undefined && summaryByGroup.get(groupId)?.id) || id;
  };

  const bundles = new Map<string, DisplayEdge>();
  let internalEdgeCount = 0;
  for (const edge of edges) {
    const from = displayIdOf(edge.from);
    const to = displayIdOf(edge.to);
    const tier = groupModel.edgeCrossings.get(edgeCrossingKey(edge.from, edge.to)) ?? 'none';
    const internalTo = from === to ? summaryById.get(from) : undefined;
    if (internalTo) {
      internalTo.internalEdgeCount += 1;
      internalEdgeCount += 1;
      continue;
    }
    const key = edgeCrossingKey(from, to);
    const bundle = bundles.get(key);
    if (bundle) {
      bundle.count += 1;
      bundle.crossing = strongerTier(bundle.crossing, tier);
      bundle.memberEdges.push({ from: edge.from, to: edge.to });
    } else {
      bundles.set(key, {
        from,
        to,
        count: 1,
        crossing: tier,
        memberEdges: [{ from: edge.from, to: edge.to }],
      });
    }
  }

  const displayEdges = [...bundles.values()];
  const bundledThroughSummaries = displayEdges
    .filter((edge) => isSummaryNodeId(edge.from) || isSummaryNodeId(edge.to))
    .reduce((total, edge) => total + edge.count, 0);
  return {
    nodeIds: keptNodeIds,
    summaries,
    displayEdges,
    internalEdgeCount,
    bundledEdgeCount: bundledThroughSummaries + internalEdgeCount,
    collapsedGroupIds: summaries.map((summary) => summary.groupId),
  };
}

/**
 * One placeholder per summary node for the group layout: the median member column (a column some
 * member already uses) and the mean member y. The median keeps a container that spans several
 * rank columns near the middle of them, so fewer bundles run against the left-to-right flow.
 */
export function summaryPlaceholders(
  summaries: readonly SummaryNode[],
  nodeLayouts: ReadonlyMap<string, LineageGraphNodeLayout>,
): GroupPlaceholder[] {
  return summaries.flatMap((summary) => {
    const members = summary.memberIds.flatMap((id) => nodeLayouts.get(id) ?? []);
    if (members.length === 0) return [];
    const columns = members.map((layout) => layout.x).sort((a, b) => a - b);
    const x = columns.at(Math.floor((columns.length - 1) / 2)) ?? 0;
    const y = members.reduce((total, layout) => total + layout.y, 0) / members.length;
    return [{ id: summary.id, groupId: summary.groupId, x, y }];
  });
}

const TONE_WORDS = new Map([
  ['danger', 'failed'],
  ['neutral', 'not run'],
  ['positive', 'succeeded'],
  ['skipped', 'skipped'],
  ['warning', 'warning'],
]);

/** `Model ×12 · Source ×3`; types past `limit` fold into `+N more`. */
export function summaryTypeLine(summary: SummaryNode, limit = 2): string {
  const shown = summary.typeCounts
    .slice(0, limit)
    .map(({ resourceType, count }) => `${formatResourceTypeLabel(resourceType)} ×${count}`);
  const hidden = summary.typeCounts.length - limit;
  return (hidden > 0 ? [...shown, `+${hidden} more`] : shown).join(' · ');
}

/** Plain-text description for the summary node tooltip and accessible name. */
export function describeSummaryNode(summary: SummaryNode): string {
  const resources = `${summary.memberCount} ${summary.memberCount === 1 ? 'resource' : 'resources'}`;
  const statuses = summary.statusCounts
    .map(({ tone, count }) => `${count} ${TONE_WORDS.get(tone) ?? tone}`)
    .join(', ');
  const internal = `${summary.internalEdgeCount} internal ${summary.internalEdgeCount === 1 ? 'edge' : 'edges'}`;
  return `${summary.levelLabel}: ${summary.label} (collapsed)\n${resources}: ${summaryTypeLine(summary, 6)}\nRun status: ${statuses}\n${internal}`;
}
