import type { ReactElement } from 'react';

export function OverviewScopeBadge({ label }: { label: string }): ReactElement {
  return <span className="overview-scope-badge">{label}</span>;
}
