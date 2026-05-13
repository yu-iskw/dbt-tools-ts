import { normalizeDbtResourceTypeKey } from '@dbt-tools/core/browser';
import type { MaterializationKind, NodeExecutionSemantics } from '@web/types';

/**
 * dbt resource types that are not models and do not use `config.materialized`
 * like models do ([resource type selection](https://docs.getdbt.com/reference/global-configs/resource-type)).
 * For these, `materialization: "unknown"` is expected noise — omit the badge.
 */
const RESOURCE_TYPES_WITHOUT_MODEL_MATERIALIZATION_BADGE = new Set([
  'analysis',
  'exposure',
  'macro',
  'metric',
  'saved_query',
  'semantic_model',
  'source',
]);

/**
 * Whether to show a materialization chip for this node. Hides meaningless
 * "Unknown" labels on sources, metrics, semantic models, etc.
 */
export function shouldShowMaterializationSemanticsBadge(
  semantics: NodeExecutionSemantics,
): boolean {
  if (semantics.materialization !== 'unknown') {
    return true;
  }
  const rt = normalizeDbtResourceTypeKey(semantics.resourceType);
  return !RESOURCE_TYPES_WITHOUT_MODEL_MATERIALIZATION_BADGE.has(rt);
}

/** Stable ordering for filters and health aggregates. */
export const MATERIALIZATION_KIND_ORDER: MaterializationKind[] = [
  'table',
  'view',
  'incremental',
  'ephemeral',
  'materialized_view',
  'seed',
  'snapshot',
  'operation',
  'test',
  'unknown',
];

const SHORT_LABEL: Record<MaterializationKind, string> = {
  table: 'Table',
  view: 'View',
  incremental: 'Incr.',
  ephemeral: 'Eph.',
  materialized_view: 'Mat. view',
  seed: 'Seed',
  snapshot: 'Snap.',
  operation: 'Op.',
  test: 'Test',
  unknown: 'Unknown',
};

/** One-line semantics for tooltips (adapter-safe). */
const KIND_SUMMARY: Record<MaterializationKind, string> = {
  table:
    'Configured as a table: dbt typically creates or replaces a persisted warehouse relation on full runs; adapter-dependent.',
  view: 'Configured as a view: dbt typically maintains a view object; runtime reflects metadata refresh and adapter behavior.',
  incremental:
    'Configured as incremental: persisted relation updated incrementally when the model runs incrementally; strategy and full refresh are adapter- and invocation-dependent.',
  ephemeral:
    'Ephemeral model: compiled into downstream SQL and does not create its own warehouse relation.',
  materialized_view:
    'Materialized view: adapter-specific persisted object; behavior and refresh semantics vary by warehouse.',
  seed: 'Seed: loads static data into a table (typically replace or merge per dbt configuration).',
  snapshot: 'Snapshot: dbt tracks slowly changing dimensions into a persisted snapshot table.',
  operation: 'Operation / hook-style step: not a standard persisted model relation.',
  test: 'Test: validates other resources; does not materialize a primary warehouse table like a model.',
  unknown:
    'Materialization not recognized from manifest metadata; treat persistence and warehouse effects as adapter-dependent.',
};

export function materializationKindShortLabel(kind: MaterializationKind): string {
  return SHORT_LABEL[kind] ?? kind;
}

/** Rich tooltip: summary + optional incremental hints + raw custom materialization. */
export function buildMaterializationTooltipText(semantics: NodeExecutionSemantics): string {
  const lines: string[] = [KIND_SUMMARY[semantics.materialization]];
  if (semantics.rawMaterialization) {
    lines.push(`Manifest materialized: ${semantics.rawMaterialization}`);
  }
  if (semantics.relationName) {
    lines.push(`Relation name (manifest): ${semantics.relationName}`);
  }
  if (semantics.incrementalStrategy) {
    lines.push(`Incremental strategy: ${semantics.incrementalStrategy}`);
  }
  if (semantics.uniqueKey != null) {
    const uk = Array.isArray(semantics.uniqueKey)
      ? semantics.uniqueKey.join(', ')
      : semantics.uniqueKey;
    lines.push(`Unique key: ${uk}`);
  }
  if (semantics.onSchemaChange) {
    lines.push(`On schema change: ${semantics.onSchemaChange}`);
  }
  if (semantics.fullRefreshCapable != null) {
    lines.push(`Full refresh configured: ${semantics.fullRefreshCapable}`);
  }
  lines.push(`Source: ${semantics.materializationSource} metadata.`);
  return lines.join('\n');
}

export function collectMaterializationKindsFromSemantics(
  semanticsList: Array<NodeExecutionSemantics | undefined | null>,
): MaterializationKind[] {
  const present = new Set<MaterializationKind>();
  for (const s of semanticsList) {
    if (s?.materialization) present.add(s.materialization);
  }
  return MATERIALIZATION_KIND_ORDER.filter((k) => present.has(k));
}
