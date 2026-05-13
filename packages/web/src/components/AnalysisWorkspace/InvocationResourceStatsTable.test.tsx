// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import type { AnalysisState } from '@web/types';
import { InvocationResourceStats } from './InvocationResourceStatsTable';

const minimalAnalysis = {
  projectName: 'my_project',
  executions: [],
  ganttData: [],
  graphSummary: { nodesByType: { model: 2, source: 1 } },
} as unknown as AnalysisState;

afterEach(() => {
  document.body.replaceChildren();
});

describe('InvocationResourceStats', () => {
  it('renders the resource comparison title on Health-style usage', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<InvocationResourceStats analysis={minimalAnalysis} />);
    });

    expect(
      container.textContent?.includes(
        'Resource counts (manifest graph vs this run vs timeline rows)',
      ),
    ).toBe(true);

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
