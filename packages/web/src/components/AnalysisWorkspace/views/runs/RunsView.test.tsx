// @vitest-environment jsdom

import { act } from 'react';

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { AnalysisState, ExecutionRow } from '@web/types';
import type { RunsViewState } from '@web/lib/analysis-workspace/types';
import { useRunsResultsSource } from '@web/hooks/useRunsResultsSource';
import { RunsView } from './RunsView';

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: vi.fn(),
}));
vi.mock('@web/hooks/useRunsResultsSource');

const mockUseVirtualizer = vi.mocked(useVirtualizer);
const mockUseRunsResultsSource = vi.mocked(useRunsResultsSource);

function makeRow(over: Partial<ExecutionRow> = {}): ExecutionRow {
  return {
    uniqueId: 'model.pkg.foo',
    name: 'foo',
    resourceType: 'model',
    packageName: 'pkg',
    path: 'models/foo.sql',
    status: 'success',
    statusTone: 'positive',
    executionTime: 0.3,
    threadId: 'main',
    start: null,
    end: null,
    ...over,
  };
}

function makeField(
  key: string,
  value: string,
  kind: 'number' | 'string' | 'object' = 'string',
  sortValue?: string | number,
) {
  return {
    key,
    label: key,
    kind,
    displayValue: value,
    isScalar: kind !== 'object',
    ...(sortValue !== undefined ? { sortValue } : {}),
  } as const;
}

function mockRunsSource(rows: ExecutionRow[]) {
  mockUseRunsResultsSource.mockReturnValue({
    rows,
    totalMatches: rows.length,
    totalVisible: rows.length,
    summary: {
      status: {
        all: rows.length,
        positive: rows.length,
        warning: 0,
        danger: 0,
      },
      facets: {
        all: rows.length,
        models: rows.length,
        tests: 0,
        seeds: 0,
        snapshots: 0,
        operations: 0,
        healthy: rows.length,
        warnings: 0,
        errors: 0,
        issues: 0,
      },
      resourceTypes: {},
      threadIds: {},
    },
    hasMore: false,
    isIndexing: false,
    isLoading: false,
    error: null,
    loadMore: vi.fn(),
  });
}

function baseRunsViewState(over: Partial<RunsViewState> = {}): RunsViewState {
  return {
    kind: 'all',
    status: 'all',
    query: '',
    resourceTypes: new Set(),
    materializationKinds: new Set(),
    threadIds: new Set(),
    durationBand: 'all',
    sortBy: 'attention',
    sortDirection: 'desc',
    groupBy: 'none',
    selectedExecutionId: null,
    showAdapterMetrics: true,
    ...over,
  };
}

function makeAnalysis(executions: ExecutionRow[]): AnalysisState {
  return {
    executions,
    resources: [],
  } as unknown as AnalysisState;
}

describe('RunsView', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseVirtualizer.mockReturnValue({
      getVirtualItems: () => [{ index: 0, start: 44, key: 0 }],
      getTotalSize: () => 76,
      options: { scrollMargin: 44 },
    } as ReturnType<typeof useVirtualizer>);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders capped adapter columns from raw adapter_response fields', () => {
    const row = makeRow({
      name: 'a_very_long_model_name_that_should_not_overlap_adjacent_cells',
      adapterMetrics: {
        rawKeys: ['bytes_processed', 'query_id'],
        bytesProcessed: 123,
        queryId: 'job-1',
      },
      adapterResponseFields: [
        makeField('bytes_processed', '123', 'number', 123),
        makeField('job_id', 'job-1', 'string', 'job-1'),
      ],
    });
    mockRunsSource([row]);

    act(() => {
      root.render(
        <RunsView
          analysis={makeAnalysis([row])}
          runsViewState={baseRunsViewState()}
          onRunsViewStateChange={vi.fn()}
          onInvestigationSelectionChange={vi.fn()}
          onNavigateTo={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain('Bytes processed');
    expect(container.textContent).toContain('Query ID');
    expect(container.textContent).toContain('123');
    expect(container.textContent).toContain('job-1');
    expect(container.querySelector('.results-table__cell--item strong')?.textContent).toContain(
      'a_very_long_model_name',
    );
  });

  it('caps visible columns and moves overflow into the inspector', () => {
    const row = makeRow({
      uniqueId: 'model.pkg.cap',
      adapterMetrics: {
        rawKeys: [
          'query_id',
          'code',
          '_message',
          'bytes_processed',
          'bytes_billed',
          'slot_ms',
          'rows_affected',
        ],
        queryId: 'job-1',
        adapterCode: 'OK',
        adapterMessage: 'finished',
        bytesProcessed: 1,
        bytesBilled: 2,
        slotMs: 3,
        rowsAffected: 4,
      },
      adapterResponseFields: [
        makeField('a', '1', 'number', 1),
        makeField('b', '2', 'number', 2),
        makeField('c', '3', 'number', 3),
        makeField('d', '4', 'number', 4),
        makeField('e', '5', 'number', 5),
        makeField('f', '6', 'number', 6),
        makeField('g', '7', 'number', 7),
      ],
    });
    mockRunsSource([row]);

    act(() => {
      root.render(
        <RunsView
          analysis={makeAnalysis([row])}
          runsViewState={baseRunsViewState({
            selectedExecutionId: row.uniqueId,
          })}
          onRunsViewStateChange={vi.fn()}
          onInvestigationSelectionChange={vi.fn()}
          onNavigateTo={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain('Showing 6 of 7 adapter metrics');
    expect(container.textContent).toContain('More adapter metrics');
    expect(container.textContent).toContain('g: 7');
  });

  it('resets invalid adapter sort when the sort column is not visible', () => {
    const row = makeRow({
      adapterResponseFields: [makeField('visible', '1', 'number', 1)],
    });
    mockRunsSource([row]);
    const onRunsViewStateChange = vi.fn();

    act(() => {
      root.render(
        <RunsView
          analysis={makeAnalysis([row])}
          runsViewState={baseRunsViewState({
            sortBy: 'adapter:hidden',
          })}
          onRunsViewStateChange={onRunsViewStateChange}
          onInvestigationSelectionChange={vi.fn()}
          onNavigateTo={vi.fn()}
        />,
      );
    });

    expect(onRunsViewStateChange).toHaveBeenCalledWith(expect.any(Function));
    const updater = onRunsViewStateChange.mock.calls[0]?.[0] as (
      current: RunsViewState,
    ) => RunsViewState;
    expect(updater(baseRunsViewState({ sortBy: 'adapter:hidden' })).sortBy).toBe('attention');
  });

  it('hides warehouse columns when the adapter toggle is off', () => {
    const row = makeRow({
      adapterResponseFields: [makeField('job_id', 'job-1', 'string', 'job-1')],
    });
    mockRunsSource([row]);

    act(() => {
      root.render(
        <RunsView
          analysis={makeAnalysis([row])}
          runsViewState={baseRunsViewState({ showAdapterMetrics: false })}
          onRunsViewStateChange={vi.fn()}
          onInvestigationSelectionChange={vi.fn()}
          onNavigateTo={vi.fn()}
        />,
      );
    });

    expect(container.textContent).not.toContain('job_id');
  });

  it('renders the selected run heading and quick-jump actions', () => {
    const row = makeRow({
      uniqueId: 'model.pkg.orders',
      name: 'orders',
      adapterResponseFields: [makeField('job_id', 'job-1', 'string', 'job-1')],
    });
    const onNavigateTo = vi.fn();
    mockRunsSource([row]);

    act(() => {
      root.render(
        <RunsView
          analysis={makeAnalysis([row])}
          runsViewState={baseRunsViewState({
            selectedExecutionId: row.uniqueId,
          })}
          onRunsViewStateChange={vi.fn()}
          onInvestigationSelectionChange={vi.fn()}
          onNavigateTo={onNavigateTo}
        />,
      );
    });

    expect(container.textContent).toContain('Selected run item');
    expect(container.textContent).toContain('Open in Timeline');
    expect(container.textContent).toContain('Open in Inventory');
    expect(container.textContent).toContain('Open in Lineage');
  });

  it('wires the Open in Lineage action to inventory lineage navigation', () => {
    const row = makeRow({
      uniqueId: 'model.pkg.orders',
      name: 'orders',
      adapterResponseFields: [makeField('job_id', 'job-1', 'string', 'job-1')],
    });
    const onNavigateTo = vi.fn();
    mockRunsSource([row]);

    act(() => {
      root.render(
        <RunsView
          analysis={makeAnalysis([row])}
          runsViewState={baseRunsViewState({
            selectedExecutionId: row.uniqueId,
          })}
          onRunsViewStateChange={vi.fn()}
          onInvestigationSelectionChange={vi.fn()}
          onNavigateTo={onNavigateTo}
        />,
      );
    });

    const lineageButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Open in Lineage',
    );
    expect(lineageButton).toBeTruthy();

    act(() => {
      lineageButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    expect(onNavigateTo).toHaveBeenCalledWith('inventory', {
      resourceId: row.uniqueId,
      assetTab: 'lineage',
      rootResourceId: row.uniqueId,
    });
  });
});
