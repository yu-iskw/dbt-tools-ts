// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HealthPostureBlock } from './HealthPostureBlock';

import type { OverviewDerivedState } from '@web/lib/analysis-workspace/overview-state';
import type { AnalysisState } from '@web/types';

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

function renderBlock(counts: { failingNodes: number; warningNodes: number }) {
  const onNavigateTo = vi.fn();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <HealthPostureBlock
        analysis={
          {
            summary: { total_nodes: 4, total_execution_time: 1 },
            graphSummary: { totalNodes: 4, totalEdges: 3 },
            invocationId: null,
            executions: [],
            resources: [],
          } as unknown as AnalysisState
        }
        projectName="shop"
        analysisSource="preload"
        derived={
          {
            ...counts,
            failedModels: 0,
            filteredExecutionTime: 1,
            filteredExecutions: [],
          } as unknown as OverviewDerivedState
        }
        filtered={false}
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
});
