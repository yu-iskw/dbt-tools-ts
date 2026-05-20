import { type ReactNode, type ReactElement } from 'react';

import { formatResourceTypeLabel } from '@web/lib/analysis-workspace/utils';

import type { AssetExplorerMode } from '@web/lib/analysis-workspace/types';

export { formatResourceTypeLabel };

export function SectionCard({
  title,
  subtitle,
  headerRight,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  headerRight?: ReactNode;
  children: ReactNode;
}): ReactElement {
  return (
    <section className="workspace-card">
      <div className="workspace-card__header">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {headerRight}
      </div>
      {children}
    </section>
  );
}

export function ResourceTypeBadge({ resourceType }: { resourceType: string }): ReactElement {
  return (
    <span className="resource-type-badge">
      <ResourceTypeIcon resourceType={resourceType} />
      {formatResourceTypeLabel(resourceType)}
    </span>
  );
}

export function ResourceTypeIcon({ resourceType }: { resourceType: string }): ReactElement {
  switch (resourceType) {
    case 'model':
      return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor">
          <path d="m8 2.2 4.8 2.7L8 7.6 3.2 4.9 8 2.2Z" />
          <path d="m3.2 5 4.8 2.6L12.8 5M3.2 8l4.8 2.7 4.8-2.7M3.2 11l4.8 2.8 4.8-2.8" />
        </svg>
      );
    case 'source':
      return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor">
          <ellipse cx="8" cy="4" rx="4.6" ry="1.8" />
          <path d="M3.4 4v5.3C3.4 10.7 5.5 12 8 12s4.6-1.3 4.6-2.7V4" />
          <path d="M3.4 6.7C3.4 8 5.5 9.3 8 9.3s4.6-1.3 4.6-2.6" />
        </svg>
      );
    case 'test':
    case 'unit_test':
      return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor">
          <path d="M8 2.2 12.6 4v3.8c0 2.6-1.7 5-4.6 5.8-2.9-.8-4.6-3.2-4.6-5.8V4L8 2.2Z" />
          <path d="m5.6 7.9 1.5 1.5 3.3-3.3" />
        </svg>
      );
    case 'metric':
      return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor">
          <path d="M2.5 11.8h11" />
          <path d="M4.2 10.8V8.1M8 10.8V5.2m3.8 5.6V3.6" />
        </svg>
      );
    case 'semantic_model':
      return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor">
          <rect x="2.4" y="3" width="4.2" height="4.2" rx="1" />
          <rect x="9.4" y="3" width="4.2" height="4.2" rx="1" />
          <rect x="5.9" y="9" width="4.2" height="4.2" rx="1" />
          <path d="M6.6 5.1h2.8M8 7.2V9" />
        </svg>
      );
    case 'macro':
      return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor">
          <path d="M5.2 3.3H3.4v9.4h1.8M10.8 3.3h1.8v9.4h-1.8" />
          <path d="m9.6 5.1-3.2 5.8" />
        </svg>
      );
    case 'operation':
    case 'sql_operation':
      return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor">
          <path d="M9.8 2.9a3.2 3.2 0 1 1-1.1 6.2L4 13.8 2.2 12l4.7-4.7a3.2 3.2 0 0 1 2.9-4.4Z" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor">
          <path d="M4.3 2.8h5l2.4 2.4v7.9H4.3z" />
          <path d="M9.3 2.8v2.4h2.4" />
          <path d="M5.8 8h4.4M5.8 10.2h4.4" />
        </svg>
      );
  }
}

export function ExplorerBranchIcon({
  mode,
  depth,
}: {
  mode: AssetExplorerMode;
  depth: number;
}): ReactElement {
  if (mode === 'database' && depth === 0) {
    return (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor">
        <ellipse cx="8" cy="4" rx="4.6" ry="1.8" />
        <path d="M3.4 4v4.6C3.4 10 5.5 11.2 8 11.2s4.6-1.2 4.6-2.6V4" />
        <path d="M3.4 6.4C3.4 7.8 5.5 9 8 9s4.6-1.2 4.6-2.6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor">
      <path d="M2.5 4.3h4.1l1.2 1.5H13a.9.9 0 0 1 .9.9v5a.9.9 0 0 1-.9.9H3a.9.9 0 0 1-.9-.9V5.2a.9.9 0 0 1 .4-.9Z" />
    </svg>
  );
}

export function WorkspaceScaffold({
  title,
  description,
  toolbar,
  leadingPane,
  children,
  inspector,
  className = '',
  suppressHeader = false,
}: {
  title: string;
  description: string;
  toolbar?: ReactNode;
  leadingPane?: ReactNode;
  children: ReactNode;
  inspector?: ReactNode;
  className?: string;
  suppressHeader?: boolean;
}): ReactElement {
  return (
    <div className={`workspace-view workspace-scaffold ${className}`.trim()}>
      {!suppressHeader ? (
        <div className="lens-header">
          <div className="lens-header__title">
            <p className="eyebrow">Workspace lens</p>
            <h2>{title}</h2>
            <p className="lens-header__desc">{description}</p>
          </div>
        </div>
      ) : null}
      {toolbar ? <div className="workspace-scaffold__toolbar">{toolbar}</div> : null}
      <div
        className={`workspace-scaffold__body${leadingPane ? ' workspace-scaffold__body--with-leading' : ''}${inspector ? ' workspace-scaffold__body--with-inspector' : ''}`}
      >
        {leadingPane ? <aside className="workspace-scaffold__leading">{leadingPane}</aside> : null}
        <div className="workspace-scaffold__main">{children}</div>
        {inspector ? <aside className="workspace-scaffold__inspector">{inspector}</aside> : null}
      </div>
    </div>
  );
}

export function QuickJumpActions({
  actions,
}: {
  actions: { label: string; onClick: () => void; disabled?: boolean }[];
}): ReactElement {
  return (
    <div className="entity-inspector__actions">
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          className="workspace-pill"
          onClick={action.onClick}
          disabled={action.disabled}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

export function EntityInspector({
  eyebrow,
  title,
  typeLabel,
  status,
  stats,
  sections,
  actions,
  emptyMessage,
}: {
  eyebrow?: string;
  title: string | null;
  typeLabel?: string | null;
  status?: ReactNode;
  stats?: { label: string; value: ReactNode }[];
  sections?: { label: string; value: ReactNode }[];
  actions?: { label: string; onClick: () => void; disabled?: boolean }[];
  emptyMessage?: string;
}): ReactElement {
  if (!title) {
    return (
      <aside className="entity-inspector entity-inspector--empty">
        <p className="entity-inspector__placeholder">
          {emptyMessage ?? 'Select an item to inspect'}
        </p>
      </aside>
    );
  }

  return (
    <aside className="entity-inspector">
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <div className="entity-inspector__header">
        {typeLabel ? <span className="entity-inspector__type-badge">{typeLabel}</span> : null}
        {status}
      </div>
      <div className="entity-inspector__name">
        <strong>{title}</strong>
      </div>
      {stats && stats.length > 0 ? (
        <dl className="entity-inspector__stats">
          {stats.map((stat) => (
            <div key={stat.label} className="entity-inspector__stat">
              <dt>{stat.label}</dt>
              <dd>{stat.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {sections?.map((section) => (
        <div key={section.label} className="entity-inspector__section">
          <p className="entity-inspector__section-label">{section.label}</p>
          <div className="entity-inspector__mono">{section.value}</div>
        </div>
      ))}
      {actions && actions.length > 0 ? <QuickJumpActions actions={actions} /> : null}
    </aside>
  );
}
