// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RunBrief } from './RunBrief';

import type { AnalysisState, ExecutionRow } from '@web/types';

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

function makeRow(
  uniqueId: string,
  name: string,
  startSec: number,
  endSec: number,
  overrides: Partial<ExecutionRow> = {},
): ExecutionRow {
  return {
    uniqueId,
    name,
    resourceType: 'model',
    packageName: 'shop',
    path: null,
    status: 'success',
    statusTone: 'positive',
    executionTime: endSec - startSec,
    threadId: 't1',
    start: startSec * 1000,
    end: endSec * 1000,
    ...overrides,
  };
}

const failed = (uniqueId: string, name: string, endSec: number) =>
  makeRow(uniqueId, name, endSec - 5, endSec, { statusTone: 'danger', threadId: 't2' });

const RUN_WITH_FAILURES: ExecutionRow[] = [
  makeRow('model.shop.stg_orders', 'stg_orders', 0, 10),
  makeRow('model.shop.orders', 'orders', 10, 100),
  failed('model.shop.f1', 'dim_a', 20),
  failed('model.shop.f2', 'dim_b', 30),
  failed('model.shop.f3', 'dim_c', 40),
];

function renderBrief(executions: ExecutionRow[]) {
  const onNavigateTo = vi.fn();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <RunBrief
        analysis={{ executions, adapterTotals: undefined } as unknown as AnalysisState}
        onNavigateTo={onNavigateTo}
      />,
    );
  });
  return { container, onNavigateTo };
}

const buttonNamed = (container: HTMLElement, label: string) =>
  Array.from(container.querySelectorAll('button')).find((b) => b.textContent === label);

beforeEach(() => {
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
  document.body.replaceChildren();
});

describe('RunBrief', () => {
  it('renders the run as one sentence group per line, in a labelled list', () => {
    const { container } = renderBrief(RUN_WITH_FAILURES);
    const list = container.querySelector('ul[aria-label="Run brief"]');
    expect(list).not.toBeNull();
    expect(Array.from(list!.querySelectorAll('li')).map((li) => li.textContent)).toEqual([
      'The run took 1m 40s wall-clock. Node time adds up to 1m 55s across 2 threads.',
      'orders set the pace. It started at 10s, ran 1m 30s (90% of the run) and ended the run.',
      '3 failures. First to fail: dim_a.',
    ]);
  });

  it('renders only phrases that link to evidence as buttons', () => {
    const { container } = renderBrief(RUN_WITH_FAILURES);
    expect(Array.from(container.querySelectorAll('button')).map((b) => b.textContent)).toEqual([
      'orders',
      '3 failures',
      'dim_a',
    ]);
  });

  it('opens Runs filtered to failing when the failures phrase is clicked', () => {
    const { container, onNavigateTo } = renderBrief(RUN_WITH_FAILURES);
    act(() => buttonNamed(container, '3 failures')!.click());
    expect(onNavigateTo).toHaveBeenCalledWith('runs', { runsStatus: 'danger' });
  });

  it('opens Runs filtered to warnings when the warnings phrase is clicked', () => {
    const { container, onNavigateTo } = renderBrief([
      makeRow('model.shop.a', 'a', 0, 10, { statusTone: 'warning' }),
    ]);
    act(() => buttonNamed(container, '1 warning')!.click());
    expect(onNavigateTo).toHaveBeenCalledWith('runs', { runsStatus: 'warning' });
  });

  it('opens Timeline on the node when a node name is clicked', () => {
    const { container, onNavigateTo } = renderBrief(RUN_WITH_FAILURES);
    act(() => buttonNamed(container, 'orders')!.click());
    expect(onNavigateTo).toHaveBeenCalledWith('timeline', {
      resourceId: 'model.shop.orders',
      executionId: 'model.shop.orders',
    });
  });

  it('renders nothing for an empty run', () => {
    const { container } = renderBrief([]);
    expect(container.innerHTML).toBe('');
  });
});
