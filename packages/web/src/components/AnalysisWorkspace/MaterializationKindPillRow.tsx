import { PILL_ACTIVE, PILL_BASE } from '@web/lib/analysis-workspace/constants';
import { materializationKindShortLabel } from '@web/lib/analysis-workspace/materialization-semantics-ui';

import type { MaterializationKind } from '@web/types';
import type { ReactElement } from 'react';

export function MaterializationKindPillRow({
  kinds,
  activeKinds,
  onToggleKind,
  buttonTitle,
}: {
  kinds: readonly MaterializationKind[];
  activeKinds: ReadonlySet<MaterializationKind>;
  onToggleKind: (kind: MaterializationKind) => void;
  buttonTitle: string;
}): ReactElement {
  return (
    <div className="pill-row">
      {kinds.map((kind) => {
        const active = activeKinds.size === 0 || activeKinds.has(kind);
        return (
          <button
            key={kind}
            type="button"
            className={active ? PILL_ACTIVE : PILL_BASE}
            title={buttonTitle}
            onClick={() => onToggleKind(kind)}
          >
            {materializationKindShortLabel(kind)}
          </button>
        );
      })}
    </div>
  );
}
