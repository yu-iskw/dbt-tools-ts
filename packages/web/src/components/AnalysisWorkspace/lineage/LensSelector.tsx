import { PILL_ACTIVE, PILL_BASE } from '@web/lib/analysis-workspace/constants';

import type { LensMode } from '@web/lib/analysis-workspace/types';
import type { ReactElement } from 'react';

export function LensSelector({
  lensMode,
  setLensMode,
}: {
  lensMode: LensMode;
  setLensMode: (mode: LensMode) => void;
}): ReactElement {
  const modes: Array<{ value: LensMode; label: string }> = [
    { value: 'type', label: 'Type' },
    { value: 'status', label: 'Status' },
    { value: 'coverage', label: 'Coverage' },
  ];
  return (
    <div className="lens-selector">
      <span className="lens-selector__label">Lens</span>
      {modes.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          className={lensMode === value ? PILL_ACTIVE : PILL_BASE}
          onClick={() => setLensMode(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
