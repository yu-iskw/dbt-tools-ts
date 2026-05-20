import {
  MATERIALIZATION_KIND_ORDER,
  materializationKindShortLabel,
} from '@web/lib/analysis-workspace/materialization-semantics-ui';
import { useMemo, type ReactElement } from 'react';

import type { ExecutionRow, MaterializationKind } from '@web/types';

/**
 * Distribution of normalized materializations among **model** executions in scope.
 */
export function HealthMaterializationCard({
  executions,
}: {
  executions: ExecutionRow[];
}): ReactElement {
  const { rows, total } = useMemo(() => {
    const models = executions.filter((e) => e.resourceType === 'model');
    const counts = new Map<MaterializationKind, number>();
    for (const row of models) {
      const k = (row.semantics?.materialization ?? 'unknown') as MaterializationKind;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const r = MATERIALIZATION_KIND_ORDER.filter((k) => (counts.get(k) ?? 0) > 0).map((kind) => ({
      kind,
      count: counts.get(kind) ?? 0,
      share: models.length > 0 ? ((counts.get(kind) ?? 0) / models.length) * 100 : 0,
    }));
    return { rows: r, total: models.length };
  }, [executions]);

  if (total === 0) {
    return (
      <div className="health-mat-card">
        <div className="overview-module__header">
          <h3>Model materializations</h3>
          <p>No model executions in this health slice.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="health-mat-card">
      <div className="overview-module__header">
        <h3>Model materializations</h3>
        <p>
          Manifest-derived materialization kinds for executed models ({total.toLocaleString()}{' '}
          rows). Warehouse effects are adapter-dependent.
        </p>
      </div>
      <ul className="health-mat-card__list" aria-label="Materialization counts">
        {rows.map(({ kind, count, share }) => (
          <li key={kind} className="health-mat-card__row">
            <span className="health-mat-card__label">{materializationKindShortLabel(kind)}</span>
            <span className="health-mat-card__bar-wrap" aria-hidden>
              <span className="health-mat-card__bar" style={{ width: `${Math.max(share, 2)}%` }} />
            </span>
            <span className="health-mat-card__count">
              {count} ({share.toFixed(share >= 10 ? 0 : 1)}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
