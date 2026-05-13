import type { AdapterMetricDescriptor } from '@dbt-tools/core/browser';
import {
  formatAdapterMetricValue,
  getAdapterMetricValue,
  getPresentAdapterMetricDescriptors,
} from '@dbt-tools/core/browser';
import type { ExecutionRow } from '@web/types';
import type { RunsAdapterColumnId, RunsSortBy } from './types';

export const MAX_VISIBLE_RUNS_ADAPTER_COLUMNS = 6;

export interface RunsAdapterColumn {
  id: RunsAdapterColumnId;
  key: string;
  label: string;
  kind: AdapterMetricDescriptor['kind'];
  align: 'start' | 'end';
  isScalar: true;
  presenceCount: number;
}

export interface RunsAdapterColumnLayout {
  visibleColumns: RunsAdapterColumn[];
  overflowColumns: RunsAdapterColumn[];
  allColumns: RunsAdapterColumn[];
}

function getFieldPriority(field: Pick<RunsAdapterColumn, 'kind'>): number {
  return field.kind === 'number' ? 0 : 1;
}

export function getRunsAdapterColumnId(key: string): RunsAdapterColumnId {
  return `adapter:${key}`;
}

export function getRunsAdapterColumnKey(id: RunsAdapterColumnId): string {
  return id.slice('adapter:'.length);
}

export function isRunsAdapterSortBy(sortBy: RunsSortBy): sortBy is RunsAdapterColumnId {
  return sortBy.startsWith('adapter:');
}

export function getRunsAdapterField(
  row: ExecutionRow,
  key: string,
): { displayValue: string; sortValue?: number | string; isScalar: true } | undefined {
  const descriptors = getPresentAdapterMetricDescriptors([row.adapterMetrics]);
  const descriptor = descriptors.find((item) => item.key === key);
  const value = descriptor ? getAdapterMetricValue(row.adapterMetrics, descriptor.key) : undefined;
  if (descriptor == null || value === undefined) {
    return undefined;
  }
  return {
    displayValue: formatAdapterMetricValue(descriptor, value),
    sortValue: typeof value === 'number' || typeof value === 'string' ? value : undefined,
    isScalar: true,
  };
}

export function getRunsAdapterColumnLayout(rows: ExecutionRow[]): RunsAdapterColumnLayout {
  const descriptors = getPresentAdapterMetricDescriptors(rows.map((row) => row.adapterMetrics));

  const allColumns = descriptors
    .map(
      (descriptor): RunsAdapterColumn => ({
        id: getRunsAdapterColumnId(descriptor.key),
        key: descriptor.key,
        label: descriptor.shortLabel,
        kind: descriptor.kind,
        align: descriptor.kind === 'number' ? 'end' : 'start',
        isScalar: true,
        presenceCount: rows.filter(
          (row) => getAdapterMetricValue(row.adapterMetrics, descriptor.key) !== undefined,
        ).length,
      }),
    )
    .sort((left, right) => {
      const leftPriority = getFieldPriority(left);
      const rightPriority = getFieldPriority(right);
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }
      if (left.presenceCount !== right.presenceCount) {
        return right.presenceCount - left.presenceCount;
      }
      return left.key.localeCompare(right.key);
    });

  return {
    allColumns,
    visibleColumns: allColumns.slice(0, MAX_VISIBLE_RUNS_ADAPTER_COLUMNS),
    overflowColumns: allColumns.slice(MAX_VISIBLE_RUNS_ADAPTER_COLUMNS),
  };
}
