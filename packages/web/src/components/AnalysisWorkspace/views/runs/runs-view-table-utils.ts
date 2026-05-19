import {
  getRunsAdapterField,
  type RunsAdapterColumn,
} from '@web/lib/analysis-workspace/runs-adapter-columns';

import type { ExecutionRow } from '@web/types';

export function getRunsTableTemplate(adapterColumns: RunsAdapterColumn[]): string {
  const baseColumns = [
    'minmax(280px, 2.5fr)',
    'minmax(108px, 0.85fr)',
    'minmax(92px, 0.7fr)',
    'minmax(132px, 0.95fr)',
    'minmax(96px, 0.72fr)',
  ];
  const adapterColumnTemplate = adapterColumns.map((column) =>
    column.align === 'end' ? 'minmax(120px, 0.95fr)' : 'minmax(148px, 1.1fr)',
  );
  return [...baseColumns, ...adapterColumnTemplate, 'minmax(160px, 1fr)'].join(' ');
}

export function getAdapterCellValue(row: ExecutionRow, column: RunsAdapterColumn): string {
  return getRunsAdapterField(row, column.key)?.displayValue ?? '—';
}
