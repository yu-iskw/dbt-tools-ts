// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HealthPostureBlock } from './HealthPostureBlock';

import type { OverviewDerivedState } from '@web/lib/analysis-workspace/overview-state';
import type { AnalysisState, ExecutionRow } from '@web/types';

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

const failingRow = {
  uniqueId: 'model.shop.orders',
  name: 'orders',
  resourceType: 'model',
  packageName: 'shop',
  path: null,
  status: 'error',
  statusTone: 'danger',
  executionTime: 40,
  threadId: 't1',
  start: 0,
  end: 40_000,
} satisfies ExecutionRow;

function renderBlock(
  counts: { failingNodes: number; warningNodes: number },
  options: { filtered?: boolean; executions?: ExecutionRow[] } = {},
) {
  const { filtered = false, executions = [] } = options;
  const onNavigateTo = vi.fn();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <HealthPostureBlock
        analysis={
          {
            summary: { total_nodes: 4, total_execution_time: 100 },
            graphSummary: { totalNodes: 4, totalEdges: 3 },
            invocationId: null,
            executions,
            resources: [],
          } as unknown as AnalysisState
        }
        projectName="shop"
        analysisSource="preload"
        derived={
          {
            ...counts,
            failedModels: counts.failingNodes,
            filteredExecutionTime: 7,
            filteredExecutions: [],
          } as unknown as OverviewDerivedState
        }
        filtered={filtered}
        workspaceSignals={[]}
        onNavigateTo={onNavigateTo}
      />,
    );
  });
  return { container, onNavigateTo };
}

const buttonNamed = (container: HTMLElement, label: string) =>
  Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes(label));

beforeEach(() => {
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
  document.body.replaceChildren();
});

describe('HealthPostureBlock', () => {
  it('opens Runs filtered to failing when the Failing count is clicked', () => {
    const { container, onNavigateTo } = renderBlock({ failingNodes: 3, warningNodes: 2 });
    act(() => buttonNamed(container, 'Failing')!.click());
    expect(onNavigateTo).toHaveBeenCalledWith('runs', { runsStatus: 'danger' });
  });

  it('opens Runs filtered to warnings when the Warnings count is clicked', () => {
    const { container, onNavigateTo } = renderBlock({ failingNodes: 3, warningNodes: 2 });
    act(() => buttonNamed(container, 'Warnings')!.click());
    expect(onNavigateTo).toHaveBeenCalledWith('runs', { runsStatus: 'warning' });
  });

  it('renders zero counts as plain text, not buttons', () => {
    const { container } = renderBlock({ failingNodes: 0, warningNodes: 0 });
    expect(buttonNamed(container, 'Failing')).toBeUndefined();
    expect(buttonNamed(container, 'Warnings')).toBeUndefined();
    expect(container.textContent).toContain('Failing');
  });

  describe('when showing the whole run', () => {
    it('shows the run brief in place of the generic summary', () => {
      const { container } = renderBlock(
        { failingNodes: 1, warningNodes: 0 },
        { executions: [failingRow] },
      );
      expect(container.querySelector('ul[aria-label="Run brief"]')?.textContent).toContain(
        'The run took 40s wall-clock.',
      );
      expect(container.querySelector('.health-posture__summary')).toBeNull();
      expect(container.querySelector('.health-posture__followup')).toBeNull();
    });

    it('keeps the headline and the metrics row', () => {
      const { container } = renderBlock(
        { failingNodes: 1, warningNodes: 0 },
        { executions: [failingRow] },
      );
      expect(container.querySelector('.health-posture__headline')?.textContent).toContain(
        '1 failing node',
      );
      expect(buttonNamed(container, 'Failing')).toBeDefined();
    });
  });

  describe('when the dashboard filters are active', () => {
    it('keeps the generic summary and follow-up and leaves out the run brief', () => {
      const { container } = renderBlock(
        { failingNodes: 1, warningNodes: 0 },
        { filtered: true, executions: [failingRow] },
      );
      expect(container.querySelector('[aria-label="Run brief"]')).toBeNull();
      expect(container.querySelector('.health-posture__summary')?.textContent).toBe(
        'Prioritize failing nodes before reviewing downstream impact.',
      );
      expect(container.querySelector('.health-posture__followup')?.textContent).toBe(
        '1 failed model may block downstream investigation.',
      );
    });
  });

  describe('node time metric', () => {
    const metricWithTitle = (container: HTMLElement) =>
      container.querySelector<HTMLElement>('[title*="wall-clock"]');

    it('is labelled Node time, not Runtime, and says it is not wall-clock time', () => {
      const { container } = renderBlock({ failingNodes: 0, warningNodes: 0 });
      const metric = metricWithTitle(container);
      expect(metric?.textContent).toBe('Node time1m 40.00s');
      expect(metric?.title).toBe(
        "Sum of every node's execution time. This is not the run's wall-clock time.",
      );
      expect(container.textContent).not.toContain('Runtime');
    });

    it('shows the filtered nodes time while filters are active', () => {
      const { container } = renderBlock({ failingNodes: 0, warningNodes: 0 }, { filtered: true });
      expect(metricWithTitle(container)?.textContent).toBe('Node time7.00s');
    });
  });
});
