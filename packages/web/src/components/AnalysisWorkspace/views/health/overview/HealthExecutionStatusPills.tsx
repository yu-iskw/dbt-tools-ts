import type { Dispatch, SetStateAction } from 'react';
import { PILL_ACTIVE, PILL_BASE } from '@web/lib/analysis-workspace/constants';
import type { DashboardStatusFilter, OverviewFilterState } from '@web/lib/analysis-workspace/types';

const STATUS_OPTIONS: { value: DashboardStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'positive', label: 'Healthy' },
  { value: 'warning', label: 'Warnings' },
  { value: 'danger', label: 'Errors' },
];

/** Status triage pills for the Health execution slice (All / Healthy / Warnings / Errors). */
export function HealthExecutionStatusPills({
  filters,
  setFilters,
}: {
  filters: OverviewFilterState;
  setFilters: Dispatch<SetStateAction<OverviewFilterState>>;
}) {
  return (
    <div
      className="health-exec-status-pills pill-row"
      role="group"
      aria-label="Filter executions by status"
    >
      {STATUS_OPTIONS.map((filter) => (
        <button
          key={filter.value}
          type="button"
          className={filters.status === filter.value ? PILL_ACTIVE : PILL_BASE}
          onClick={() =>
            setFilters((current) => ({
              ...current,
              status: filter.value,
            }))
          }
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}
