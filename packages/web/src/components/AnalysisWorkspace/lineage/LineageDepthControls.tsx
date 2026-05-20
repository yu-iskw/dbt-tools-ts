import { PILL_ACTIVE, PILL_BASE } from '@web/lib/analysis-workspace/constants';
import { clampDepth } from '@web/lib/analysis-workspace/lineage-model';

import type { ReactElement, Dispatch, SetStateAction } from 'react';

export function DepthStepper({
  label,
  value,
  setValue,
  disabled = false,
}: {
  label: string;
  value: number;
  setValue: Dispatch<SetStateAction<number>>;
  disabled?: boolean;
}): ReactElement {
  return (
    <div className={`lineage-stepper${disabled ? ' lineage-stepper--disabled' : ''}`}>
      <span className="lineage-stepper__label">{label}</span>
      <div className="lineage-stepper__controls">
        <button
          type="button"
          className="lineage-stepper__button"
          disabled={disabled || value <= 1}
          onClick={() => setValue((current) => clampDepth(current - 1))}
        >
          −
        </button>
        <span className="lineage-stepper__value">{value}</span>
        <button
          type="button"
          className="lineage-stepper__button"
          disabled={disabled || value >= 3}
          onClick={() => setValue((current) => clampDepth(current + 1))}
        >
          +
        </button>
      </div>
    </div>
  );
}

function getSharedDepthValue(
  upstreamDepth: number,
  downstreamDepth: number,
  allDepsMode: boolean,
): '1' | '2' | '3' | 'all' | 'custom' {
  if (allDepsMode) return 'all';
  if (upstreamDepth === downstreamDepth && upstreamDepth >= 1 && upstreamDepth <= 3) {
    return String(upstreamDepth) as '1' | '2' | '3';
  }
  return 'custom';
}

export function SharedDepthSelector({
  upstreamDepth,
  downstreamDepth,
  allDepsMode,
  setUpstreamDepth,
  setDownstreamDepth,
  setAllDepsMode,
}: {
  upstreamDepth: number;
  downstreamDepth: number;
  allDepsMode: boolean;
  setUpstreamDepth: Dispatch<SetStateAction<number>>;
  setDownstreamDepth: Dispatch<SetStateAction<number>>;
  setAllDepsMode: Dispatch<SetStateAction<boolean>>;
}): ReactElement {
  const sharedDepth = getSharedDepthValue(upstreamDepth, downstreamDepth, allDepsMode);

  const setDepth = (value: '1' | '2' | '3' | 'all') => {
    if (value === 'all') {
      setAllDepsMode(true);
      return;
    }
    const numeric = Number(value);
    setAllDepsMode(false);
    setUpstreamDepth(numeric);
    setDownstreamDepth(numeric);
  };

  return (
    <div className="shared-depth-selector">
      <span className="shared-depth-selector__label">Depth</span>
      {(['1', '2', '3', 'all'] as const).map((value) => (
        <button
          key={value}
          type="button"
          className={sharedDepth === value ? PILL_ACTIVE : PILL_BASE}
          onClick={() => setDepth(value)}
        >
          {value === 'all' ? 'All' : value}
        </button>
      ))}
      {sharedDepth === 'custom' && <span className="shared-depth-selector__state">Custom</span>}
    </div>
  );
}
