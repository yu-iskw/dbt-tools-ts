/**
 * Normalized dbt execution / materialization semantics for analysis UI.
 * Provenance is manifest-only today (run_results do not carry materialization).
 */

export type MaterializationKind =
  | 'table'
  | 'view'
  | 'incremental'
  | 'ephemeral'
  | 'materialized_view'
  | 'seed'
  | 'snapshot'
  | 'operation'
  | 'test'
  | 'unknown';

export type MaterializationProvenance = 'manifest' | 'run_result' | 'derived' | 'unknown';

export interface NodeExecutionSemantics {
  resourceType: string;
  materialization: MaterializationKind;
  persisted: boolean;
  createsRelation: boolean;
  compiledIntoParent: boolean;
  relationName?: string;
  adapterType?: string;
  incrementalStrategy?: string;
  uniqueKey?: string | string[];
  onSchemaChange?: string;
  fullRefreshCapable?: boolean;
  materializationSource: MaterializationProvenance;
  /** Original `config.materialized` when it did not map to a known kind. */
  rawMaterialization?: string;
}

const MODEL_MATERIALIZATION_ALIASES: Record<string, MaterializationKind> = {
  table: 'table',
  view: 'view',
  incremental: 'incremental',
  ephemeral: 'ephemeral',
  materialized_view: 'materialized_view',
  materializedview: 'materialized_view',
};

/** Normalized key for dbt `resource_type` strings (trim, lower, empty → `unknown`). */
export function normalizeDbtResourceTypeKey(resourceType: string): string {
  return resourceType.trim().toLowerCase() || 'unknown';
}

function normalizeMaterializedToken(raw: string | undefined | null): string | null {
  if (raw == null || typeof raw !== 'string') return null;
  const t = raw.trim().toLowerCase();
  return t === '' ? null : t.replace(/[\s-]+/g, '_');
}

/**
 * Map dbt `resource_type` and optional `config.materialized` to a display kind.
 */
export function normalizeMaterializationKind(
  resourceType: string,
  materializedRaw: string | undefined | null,
): { kind: MaterializationKind; raw?: string } {
  const rt = normalizeDbtResourceTypeKey(resourceType);
  const token = normalizeMaterializedToken(materializedRaw);

  if (rt === 'seed') return { kind: 'seed' };
  if (rt === 'snapshot') return { kind: 'snapshot' };
  if (rt === 'test' || rt === 'unit_test') return { kind: 'test' };
  if (rt === 'operation') return { kind: 'operation' };

  if (rt === 'model' || rt === '') {
    if (token == null) return { kind: 'unknown' };
    const mapped = MODEL_MATERIALIZATION_ALIASES[token];
    if (mapped != null) return { kind: mapped };
    return { kind: 'unknown', raw: materializedRaw!.trim() };
  }

  /* semantic_model, metric, exposure, source, etc.: not model materializations */
  if (token != null) {
    const mapped = MODEL_MATERIALIZATION_ALIASES[token];
    if (mapped != null) return { kind: mapped, raw: undefined };
    return { kind: 'unknown', raw: materializedRaw!.trim() };
  }
  return { kind: 'unknown' };
}

export function deriveSemanticsFlags(
  kind: MaterializationKind,
  resourceType: string,
): Pick<NodeExecutionSemantics, 'persisted' | 'createsRelation' | 'compiledIntoParent'> {
  const rt = normalizeDbtResourceTypeKey(resourceType);

  if (rt === 'source') {
    return {
      persisted: true,
      createsRelation: false,
      compiledIntoParent: false,
    };
  }

  switch (kind) {
    case 'ephemeral':
      return {
        persisted: false,
        createsRelation: false,
        compiledIntoParent: true,
      };
    case 'table':
    case 'view':
    case 'incremental':
    case 'materialized_view':
      return {
        persisted: true,
        createsRelation: true,
        compiledIntoParent: false,
      };
    case 'seed':
    case 'snapshot':
      return {
        persisted: true,
        createsRelation: true,
        compiledIntoParent: false,
      };
    case 'test':
    case 'operation':
      return {
        persisted: false,
        createsRelation: false,
        compiledIntoParent: false,
      };
    default:
      return {
        persisted: false,
        createsRelation: false,
        compiledIntoParent: false,
      };
  }
}

function readConfig(
  manifestEntry: Record<string, unknown> | undefined | null,
): Record<string, unknown> | undefined {
  if (manifestEntry == null) return undefined;
  const c = manifestEntry.config;
  return c != null && typeof c === 'object' ? (c as Record<string, unknown>) : undefined;
}

function provenanceFromEntry(
  manifestEntry: Record<string, unknown> | undefined | null,
  hadMaterializedConfig: boolean,
  hadIncrementalHints: boolean,
): MaterializationProvenance {
  if (manifestEntry == null) return 'derived';
  if (hadMaterializedConfig || hadIncrementalHints) return 'manifest';
  if (typeof manifestEntry.relation_name === 'string' && manifestEntry.relation_name.length > 0) {
    return 'manifest';
  }
  return 'derived';
}

export type BuildNodeExecutionSemanticsInput = {
  resourceType: string;
  /** Graph / manifest `materialized` string when already extracted */
  materialized?: string | null;
  manifestEntry?: Record<string, unknown> | null;
  /** Project adapter type (manifest metadata or caller-derived) */
  adapterType?: string | null;
};

function parseUniqueKey(config: Record<string, unknown> | undefined): {
  uniqueKey: string | string[] | undefined;
  hasUniqueKeyField: boolean;
} {
  const uk = config?.unique_key;
  if (uk == null) return { uniqueKey: undefined, hasUniqueKeyField: false };
  if (typeof uk === 'string') return { uniqueKey: uk, hasUniqueKeyField: true };
  if (Array.isArray(uk) && uk.every((x) => typeof x === 'string')) {
    return { uniqueKey: uk as string[], hasUniqueKeyField: true };
  }
  return { uniqueKey: undefined, hasUniqueKeyField: true };
}

function incrementalHintsFromConfig(
  config: Record<string, unknown> | undefined,
  hasUniqueKeyField: boolean,
): {
  incrementalStrategy?: string;
  onSchemaChange?: string;
  fullRefreshCapable?: boolean;
  hasAnyIncrementalHint: boolean;
} {
  if (config == null) {
    return { hasAnyIncrementalHint: hasUniqueKeyField };
  }
  const incrementalStrategy =
    typeof config.incremental_strategy === 'string' ? config.incremental_strategy : undefined;
  const onSchemaChange =
    typeof config.on_schema_change === 'string' ? config.on_schema_change : undefined;
  const fullRefreshCapable =
    typeof config.full_refresh === 'boolean' ? config.full_refresh : undefined;
  const hasAnyIncrementalHint =
    incrementalStrategy != null ||
    onSchemaChange != null ||
    fullRefreshCapable != null ||
    hasUniqueKeyField;
  return {
    incrementalStrategy,
    onSchemaChange,
    fullRefreshCapable,
    hasAnyIncrementalHint,
  };
}

export function buildNodeExecutionSemantics(
  input: BuildNodeExecutionSemanticsInput,
): NodeExecutionSemantics {
  const nonEmptyString = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim() !== '' ? value : undefined;

  const buildOptionalSemanticsFields = (
    relationName: string | undefined,
    adapterType: string | null | undefined,
    uniqueKey: string | string[] | undefined,
    rawMaterialization: string | undefined,
    inc: ReturnType<typeof incrementalHintsFromConfig>,
  ): Partial<
    Pick<
      NodeExecutionSemantics,
      | 'relationName'
      | 'adapterType'
      | 'incrementalStrategy'
      | 'uniqueKey'
      | 'onSchemaChange'
      | 'fullRefreshCapable'
      | 'rawMaterialization'
    >
  > => ({
    ...(relationName != null ? { relationName } : {}),
    ...(nonEmptyString(adapterType) != null ? { adapterType: nonEmptyString(adapterType) } : {}),
    ...(inc.incrementalStrategy != null ? { incrementalStrategy: inc.incrementalStrategy } : {}),
    ...(uniqueKey != null ? { uniqueKey } : {}),
    ...(inc.onSchemaChange != null ? { onSchemaChange: inc.onSchemaChange } : {}),
    ...(inc.fullRefreshCapable != null ? { fullRefreshCapable: inc.fullRefreshCapable } : {}),
    ...(nonEmptyString(rawMaterialization) != null
      ? { rawMaterialization: nonEmptyString(rawMaterialization) }
      : {}),
  });

  const { resourceType, adapterType } = input;
  const entry = input.manifestEntry ?? null;
  const config = readConfig(entry);

  const configMaterialized = typeof config?.materialized === 'string' ? config.materialized : null;
  const graphMaterialized =
    typeof input.materialized === 'string' && input.materialized.trim() !== ''
      ? input.materialized
      : null;
  const materializedEffective = graphMaterialized ?? configMaterialized;

  const { kind, raw } = normalizeMaterializationKind(resourceType, materializedEffective);

  const { uniqueKey, hasUniqueKeyField } = parseUniqueKey(config);
  const inc = incrementalHintsFromConfig(config, hasUniqueKeyField);

  const relationName = nonEmptyString(entry?.relation_name);

  const hadMaterializedConfig =
    configMaterialized != null && String(configMaterialized).trim() !== '';
  const hadGraphMaterialized = graphMaterialized != null && graphMaterialized.trim() !== '';

  const flags = deriveSemanticsFlags(kind, resourceType);

  return {
    resourceType,
    materialization: kind,
    ...flags,
    ...buildOptionalSemanticsFields(relationName, adapterType, uniqueKey, raw, inc),
    materializationSource: provenanceFromEntry(
      entry,
      hadMaterializedConfig || hadGraphMaterialized,
      inc.hasAnyIncrementalHint,
    ),
  };
}
