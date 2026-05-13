import type { NodeExecutionSemantics } from '@web/types';
import {
  buildMaterializationTooltipText,
  materializationKindShortLabel,
  shouldShowMaterializationSemanticsBadge,
} from '@web/lib/analysis-workspace/materializationSemanticsUi';

/**
 * Compact materialization chip; distinct from status tones and resource-type pills
 * (squared border). Prefer `title` + visible text — not color alone.
 */
export function MaterializationSemanticsBadge({
  semantics,
  variant = 'default',
}: {
  semantics: NodeExecutionSemantics;
  /** `compact` trims padding for dense tables / explorer rows. */
  variant?: 'default' | 'compact';
}) {
  if (!shouldShowMaterializationSemanticsBadge(semantics)) {
    return null;
  }

  const label =
    semantics.materialization === 'unknown' && semantics.rawMaterialization
      ? semantics.rawMaterialization.length > 14
        ? `${semantics.rawMaterialization.slice(0, 12)}…`
        : semantics.rawMaterialization
      : materializationKindShortLabel(semantics.materialization);

  const title = buildMaterializationTooltipText(semantics);
  const className =
    variant === 'compact'
      ? 'materialization-semantics-badge materialization-semantics-badge--compact'
      : 'materialization-semantics-badge';

  return (
    <span className={className} title={title} aria-label={title}>
      {label}
    </span>
  );
}
