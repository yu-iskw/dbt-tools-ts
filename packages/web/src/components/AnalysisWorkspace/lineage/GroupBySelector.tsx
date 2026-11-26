import { PILL_ACTIVE, PILL_BASE } from '@web/lib/analysis-workspace/constants';

import type { LineageGroupBy } from '@web/lib/analysis-workspace/types';
import type { ReactElement } from 'react';

export function GroupBySelector({
  groupBy,
  setGroupBy,
}: {
  groupBy: LineageGroupBy;
  setGroupBy: (mode: LineageGroupBy) => void;
}): ReactElement {
  const modes: Array<{ value: LineageGroupBy; label: string }> = [
    { value: 'none', label: 'None' },
    { value: 'warehouse', label: 'Warehouse' },
  ];
  return (
    <div className="lens-selector group-by-selector" role="group" aria-label="Group by">
      <span className="lens-selector__label">Group by</span>
      {modes.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          className={groupBy === value ? PILL_ACTIVE : PILL_BASE}
          aria-pressed={groupBy === value}
          onClick={() => setGroupBy(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
