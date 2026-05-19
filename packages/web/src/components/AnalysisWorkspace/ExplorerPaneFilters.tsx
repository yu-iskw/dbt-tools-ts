import { PILL_ACTIVE, PILL_BASE } from '@web/lib/analysis-workspace/constants';

import {
  EXPLORER_UI_COPY,
  executionStatusFilterButtonTitle,
  executionStatusPillLabel,
} from './explorer-pane-copy';
import { MaterializationKindPillRow } from './MaterializationKindPillRow';
import { formatResourceTypeLabel } from './shared';

import type { DashboardStatusFilter } from '@web/lib/analysis-workspace/types';
import type { MaterializationKind } from '@web/types';
import type { ReactElement } from 'react';

export const EXPLORER_FILTERS_STORAGE_KEY = 'dbt-tools.explorerFiltersExpanded';

export function getInitialFiltersExpanded(): boolean {
  try {
    const stored = window.localStorage.getItem(EXPLORER_FILTERS_STORAGE_KEY);
    if (stored !== null) return stored === 'true';
  } catch {
    // ignore localStorage failures
  }
  return false;
}

export function ExplorerPaneFilters({
  filtersExpanded,
  setFiltersExpandedPersisted,
  activeFilterCount,
  filterSummary,
  resourceQuery,
  setResourceQuery,
  status,
  setStatus,
  availableResourceTypes,
  activeResourceTypes,
  toggleResourceType,
  availableMaterializationKinds,
  activeMaterializationKinds,
  toggleMaterializationKind,
}: {
  filtersExpanded: boolean;
  setFiltersExpandedPersisted: (next: boolean) => void;
  activeFilterCount: number;
  filterSummary: string;
  resourceQuery: string;
  setResourceQuery: (value: string) => void;
  status: DashboardStatusFilter;
  setStatus: (value: DashboardStatusFilter) => void;
  availableResourceTypes: string[];
  activeResourceTypes: Set<string>;
  toggleResourceType: (value: string) => void;
  availableMaterializationKinds: MaterializationKind[];
  activeMaterializationKinds: Set<MaterializationKind>;
  toggleMaterializationKind: (value: MaterializationKind) => void;
}): ReactElement {
  return (
    <section className="explorer-filters" aria-label="Explorer filters">
      <button
        type="button"
        className="explorer-filters__toggle"
        aria-expanded={filtersExpanded}
        onClick={() => setFiltersExpandedPersisted(!filtersExpanded)}
      >
        <span className="explorer-filters__toggle-copy">
          <span className="explorer-filters__toggle-label">Filters</span>
          <span className="explorer-filters__toggle-summary">{filterSummary}</span>
        </span>
        <span className="explorer-filters__toggle-meta">
          {activeFilterCount > 0 && (
            <span className="explorer-filters__badge">{activeFilterCount}</span>
          )}
          <span
            className={`explorer-filters__chevron${filtersExpanded ? ' explorer-filters__chevron--expanded' : ''}`}
            aria-hidden="true"
          >
            ▾
          </span>
        </span>
      </button>

      {filtersExpanded && (
        <div className="explorer-filter-stack">
          <label className="workspace-search">
            <span>Search resources</span>
            <input
              value={resourceQuery}
              onChange={(event) => setResourceQuery(event.target.value)}
              placeholder="Filter tree by name, path, type, or id"
            />
          </label>

          <div className="explorer-filter-group">
            <span className="explorer-filter-group__label">
              {EXPLORER_UI_COPY.executionStatusSectionTitle}
            </span>
            <div className="explorer-status-filters">
              <div className="explorer-status-filters__block">
                <span
                  className="explorer-status-filters__sublabel"
                  id="explorer-status-run-outcome-label"
                >
                  {EXPLORER_UI_COPY.executionStatusRunOutcomeSubLabel}
                </span>
                <div
                  className="pill-row"
                  role="group"
                  aria-labelledby="explorer-status-run-outcome-label"
                >
                  {(
                    [
                      'all',
                      'positive',
                      'warning',
                      'danger',
                      'skipped',
                      'neutral',
                    ] as const satisfies readonly DashboardStatusFilter[]
                  ).map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={status === value ? PILL_ACTIVE : PILL_BASE}
                      title={executionStatusFilterButtonTitle(value)}
                      aria-label={`${executionStatusPillLabel(value)}. ${executionStatusFilterButtonTitle(value)}`}
                      onClick={() => setStatus(value)}
                    >
                      {executionStatusPillLabel(value)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="explorer-status-filters__block explorer-status-filters__block--problems">
                <span
                  className="explorer-status-filters__sublabel"
                  id="explorer-status-problems-label"
                >
                  {EXPLORER_UI_COPY.executionStatusProblemsSubLabel}
                </span>
                <div
                  className="pill-row"
                  role="group"
                  aria-labelledby="explorer-status-problems-label"
                >
                  <button
                    type="button"
                    className={status === 'issues' ? PILL_ACTIVE : PILL_BASE}
                    title={executionStatusFilterButtonTitle('issues')}
                    aria-label={`${executionStatusPillLabel('issues')}. ${executionStatusFilterButtonTitle('issues')}`}
                    onClick={() => setStatus('issues')}
                  >
                    {executionStatusPillLabel('issues')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {availableResourceTypes.length > 0 && (
            <div className="explorer-filter-group">
              <span className="explorer-filter-group__label">dbt resource type</span>
              <div className="pill-row">
                {availableResourceTypes.map((type) => {
                  const active = activeResourceTypes.size === 0 || activeResourceTypes.has(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      className={active ? PILL_ACTIVE : PILL_BASE}
                      onClick={() => toggleResourceType(type)}
                    >
                      {formatResourceTypeLabel(type)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {availableMaterializationKinds.length > 0 && (
            <div className="explorer-filter-group">
              <span className="explorer-filter-group__label">Materialization (manifest)</span>
              <MaterializationKindPillRow
                kinds={availableMaterializationKinds}
                activeKinds={activeMaterializationKinds}
                onToggleKind={toggleMaterializationKind}
                buttonTitle="Filter by normalized config.materialized / resource kind"
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
