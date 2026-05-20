import { TEST_RESOURCE_TYPES } from '@web/lib/analysis-workspace/constants';

import { EXPLORER_UI_COPY } from './explorer-pane-copy';
import { formatResourceTypeLabel } from './shared';

import type { AssetExplorerMode } from '@web/lib/analysis-workspace/types';
import type { ResourceNode } from '@web/types';
import type { ReactElement } from 'react';

export function ExplorerModeIcon({ mode }: { mode: AssetExplorerMode }): ReactElement | null {
  if (mode === 'project') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3.5 7.5h6l1.8 2h8.7v7.8a1.2 1.2 0 0 1-1.2 1.2H4.7a1.2 1.2 0 0 1-1.2-1.2V8.7a1.2 1.2 0 0 1 1.2-1.2Z" />
      </svg>
    );
  }
  if (mode === 'database') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <ellipse cx="12" cy="6.2" rx="6.5" ry="2.7" />
        <path d="M5.5 6.2v5.6c0 1.5 2.9 2.7 6.5 2.7s6.5-1.2 6.5-2.7V6.2" />
        <path d="M5.5 11.8v5.8c0 1.5 2.9 2.7 6.5 2.7s6.5-1.2 6.5-2.7v-5.8" />
      </svg>
    );
  }

  return null;
}

export function ResourceTypeSummaryBar({
  resources,
}: {
  resources: ResourceNode[];
}): ReactElement | null {
  const relevant = resources.filter(
    (r) => !TEST_RESOURCE_TYPES.has(r.resourceType) && r.statusTone !== 'neutral',
  );
  if (relevant.length === 0) return null;

  const byType = new Map<string, { pass: number; fail: number }>();
  for (const r of relevant) {
    const entry = byType.get(r.resourceType) ?? { pass: 0, fail: 0 };
    if (r.statusTone === 'positive') entry.pass++;
    else if (r.statusTone === 'danger' || r.statusTone === 'warning') entry.fail++;
    byType.set(r.resourceType, entry);
  }

  const types = Array.from(byType.entries()).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div
      className="resource-type-summary"
      aria-label={EXPLORER_UI_COPY.resourceTypeSummaryAriaLabel}
      title={EXPLORER_UI_COPY.resourceTypeSummaryTitle}
    >
      {types.map(([type, { pass, fail }]) => {
        const typeLabel = formatResourceTypeLabel(type);
        return (
          <span
            key={type}
            className="resource-type-summary__item"
            title={EXPLORER_UI_COPY.resourceTypeSummaryItemTitle(typeLabel)}
          >
            <span className="resource-type-summary__type">{typeLabel}</span>
            {pass > 0 && <span className="resource-type-summary__pass">✓{pass}</span>}
            {fail > 0 && <span className="resource-type-summary__fail">✗{fail}</span>}
          </span>
        );
      })}
    </div>
  );
}
