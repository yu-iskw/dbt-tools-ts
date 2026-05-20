import { useVirtualizer } from '@tanstack/react-virtual';
import { nextRunsSort, runsColumnHeaderSortUi } from '@web/lib/analysis-workspace/runs-sort';
import { badgeClassName, formatSeconds } from '@web/lib/analysis-workspace/utils';
import {
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
} from 'react';

import { MaterializationSemanticsBadge } from '../../MaterializationSemanticsBadge';

import { getAdapterCellValue, getRunsTableTemplate } from './runs-view-table-utils';

import type { RunsResultsSourceState } from '@web/hooks/use-runs-results-source';
import type { RunsAdapterColumn } from '@web/lib/analysis-workspace/runs-adapter-columns';
import type {
  InvestigationSelectionState,
  RunsSortBy,
  RunsViewState,
} from '@web/lib/analysis-workspace/types';
import type { AnalysisState } from '@web/types';

type RunsResultsState = RunsResultsSourceState;

const RESULTS_TABLE_CELL_ALIGN_END = 'results-table__cell--align-end';

function RunsSortColumnHeader({
  sortKey,
  label,
  alignEnd,
  cellClassName,
  runsViewState,
  onRunsViewStateChange,
}: {
  sortKey: RunsSortBy;
  label: string;
  alignEnd?: boolean;
  cellClassName?: string;
  runsViewState: RunsViewState;
  onRunsViewStateChange: Dispatch<SetStateAction<RunsViewState>>;
}) {
  const sortUi = runsColumnHeaderSortUi(runsViewState.sortBy, sortKey, runsViewState.sortDirection);
  return (
    <div
      className={`results-table__cell${cellClassName ? ` ${cellClassName}` : ''}${alignEnd ? ` ${RESULTS_TABLE_CELL_ALIGN_END}` : ''}`}
      role="columnheader"
      aria-sort={sortUi.ariaSort}
    >
      <button
        type="button"
        className={`results-table__sort-button${alignEnd ? ' results-table__sort-button--align-end' : ''}`}
        onClick={() =>
          onRunsViewStateChange((current) => ({
            ...current,
            ...nextRunsSort(sortKey, current),
          }))
        }
      >
        {label}
        <span className="results-table__sort-indicator" aria-hidden="true">
          {sortUi.indicator}
        </span>
      </button>
    </div>
  );
}

export function RunsResultsTable({
  analysis,
  runsResults,
  runsViewState,
  adapterColumns,
  onRunsViewStateChange,
  onInvestigationSelectionChange,
}: {
  analysis: AnalysisState;
  runsResults: RunsResultsState;
  runsViewState: RunsViewState;
  adapterColumns: RunsAdapterColumn[];
  onRunsViewStateChange: Dispatch<SetStateAction<RunsViewState>>;
  onInvestigationSelectionChange: Dispatch<SetStateAction<InvestigationSelectionState>>;
}): ReactElement {
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [listScrollMargin, setListScrollMargin] = useState(44);

  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      setListScrollMargin(Math.max(1, Math.ceil(el.getBoundingClientRect().height)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [adapterColumns.length]);

  // eslint-disable-next-line react-hooks/incompatible-library -- @tanstack/react-virtual useVirtualizer
  const virtualizer = useVirtualizer({
    count: runsResults.rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 76,
    overscan: 10,
    scrollMargin: listScrollMargin,
  });

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;
    const maybeLoadMore = () => {
      const remaining =
        scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight;
      if (
        remaining < 220 &&
        runsResults.hasMore &&
        !runsResults.isLoading &&
        !runsResults.isIndexing
      ) {
        runsResults.loadMore();
      }
    };
    scrollElement.addEventListener('scroll', maybeLoadMore);
    maybeLoadMore();
    return () => scrollElement.removeEventListener('scroll', maybeLoadMore);
  }, [runsResults]);

  const tableStyle = {
    '--results-table-columns': getRunsTableTemplate(adapterColumns),
  } as CSSProperties;

  const scrollHeight = Math.min(560, Math.max(120, runsResults.rows.length * 76));

  const scrollMargin = virtualizer.options.scrollMargin;

  return (
    <div className="results-table" style={tableStyle}>
      <div
        ref={scrollRef}
        className="results-table__scroll"
        style={{
          height: scrollHeight,
          overflowY: 'auto',
          position: 'relative',
        }}
      >
        <div
          ref={headerRef}
          className="results-table__header results-table__header--sticky"
          role="row"
        >
          <RunsSortColumnHeader
            sortKey="name"
            label="Item"
            cellClassName="results-table__cell--item"
            runsViewState={runsViewState}
            onRunsViewStateChange={onRunsViewStateChange}
          />
          <RunsSortColumnHeader
            sortKey="resourceType"
            label="Type"
            runsViewState={runsViewState}
            onRunsViewStateChange={onRunsViewStateChange}
          />
          <RunsSortColumnHeader
            sortKey="materialization"
            label="Materialization"
            runsViewState={runsViewState}
            onRunsViewStateChange={onRunsViewStateChange}
          />
          <RunsSortColumnHeader
            sortKey="status"
            label="Status"
            runsViewState={runsViewState}
            onRunsViewStateChange={onRunsViewStateChange}
          />
          <RunsSortColumnHeader
            sortKey="duration"
            label="Duration"
            alignEnd
            runsViewState={runsViewState}
            onRunsViewStateChange={onRunsViewStateChange}
          />
          {adapterColumns.map((column) => {
            const alignEnd = column.align === 'end';
            if (!column.isScalar) {
              return (
                <div
                  key={column.id}
                  className={`results-table__cell${alignEnd ? ` ${RESULTS_TABLE_CELL_ALIGN_END}` : ''}`}
                  role="columnheader"
                  title={column.label}
                >
                  {column.label}
                </div>
              );
            }
            return (
              <RunsSortColumnHeader
                key={column.id}
                sortKey={column.id}
                label={column.label}
                alignEnd={alignEnd}
                runsViewState={runsViewState}
                onRunsViewStateChange={onRunsViewStateChange}
              />
            );
          })}
          <RunsSortColumnHeader
            sortKey="thread"
            label="Thread"
            runsViewState={runsViewState}
            onRunsViewStateChange={onRunsViewStateChange}
          />
        </div>
        <div className="results-table__body">
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = runsResults.rows[virtualRow.index];
              if (!row) return null;
              const isActive = row.uniqueId === runsViewState.selectedExecutionId;
              return (
                <button
                  key={row.uniqueId}
                  type="button"
                  className={`results-table__row${isActive ? ' results-table__row--active' : ''}`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start - scrollMargin}px)`,
                  }}
                  onClick={() => {
                    const nextResource =
                      analysis.resources.find((resource) => resource.uniqueId === row.uniqueId) ??
                      null;
                    onRunsViewStateChange((current) => ({
                      ...current,
                      selectedExecutionId: row.uniqueId,
                    }));
                    onInvestigationSelectionChange((current) => ({
                      ...current,
                      selectedExecutionId: row.uniqueId,
                      selectedResourceId: nextResource?.uniqueId ?? row.uniqueId,
                      sourceLens: 'runs',
                    }));
                  }}
                >
                  <div
                    className="results-table__cell results-table__cell--item"
                    data-label="Item"
                    title={row.name}
                  >
                    <strong>{row.name}</strong>
                  </div>
                  <div className="results-table__cell" data-label="Type" title={row.resourceType}>
                    {row.resourceType}
                  </div>
                  <div className="results-table__cell" data-label="Materialization">
                    {row.semantics ? (
                      <MaterializationSemanticsBadge semantics={row.semantics} variant="compact" />
                    ) : (
                      '—'
                    )}
                  </div>
                  <div className="results-table__cell" data-label="Status">
                    <span className={badgeClassName(row.statusTone)}>{row.status}</span>
                  </div>
                  <div
                    className={`results-table__cell ${RESULTS_TABLE_CELL_ALIGN_END}`}
                    data-label="Duration"
                  >
                    {formatSeconds(row.executionTime)}
                  </div>
                  {adapterColumns.map((column) => {
                    const value = getAdapterCellValue(row, column);
                    return (
                      <div
                        key={column.id}
                        className={`results-table__cell${column.align === 'end' ? ` ${RESULTS_TABLE_CELL_ALIGN_END}` : ''}`}
                        data-label={column.label}
                        title={value}
                      >
                        {value}
                      </div>
                    );
                  })}
                  <div
                    className="results-table__cell"
                    data-label="Thread"
                    title={row.threadId ?? 'n/a'}
                  >
                    {row.threadId ?? 'n/a'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
