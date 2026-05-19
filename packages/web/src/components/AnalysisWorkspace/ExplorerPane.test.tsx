// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import {
  buildExplorerTreeEmptySubtext,
  EXPLORER_UI_COPY,
  executionStatusFilterButtonTitle,
  executionStatusPillLabel,
  ExplorerTreeTestStatsGroup,
  ResourceTypeSummaryBar,
} from './ExplorerPane';

import type { DashboardStatusFilter } from '@web/lib/analysis-workspace/types';
import type { ResourceNode, StatusTone } from '@web/types';

function makeModel(uniqueId: string, statusTone: StatusTone): ResourceNode {
  return {
    uniqueId,
    name: uniqueId,
    resourceType: 'model',
    packageName: 'pkg',
    path: `models/${uniqueId}.sql`,
    statusTone,
  } as ResourceNode;
}

function cleanup(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

describe('EXPLORER_UI_COPY', () => {
  it('distinguishes executed assets from dbt test totals in summary copy', () => {
    expect(EXPLORER_UI_COPY.resourceTypeSummaryAriaLabel.toLowerCase()).toMatch(/not dbt test/);
    expect(EXPLORER_UI_COPY.resourceTypeSummaryTitle.toLowerCase()).toMatch(/not dbt test/);
  });

  it('execution fail empty hint explains run rows vs not executed', () => {
    const text = EXPLORER_UI_COPY.treeEmptyExecutionFilterSubtext('danger');
    expect(text.toLowerCase()).toMatch(/fail/);
    expect(text.toLowerCase()).toMatch(/not executed/);
    expect(text.toLowerCase()).toMatch(/run results/);
    expect(text.toLowerCase()).toMatch(/issues/);
  });

  it('issues empty hint contrasts execution fail vs test rollup', () => {
    const text = EXPLORER_UI_COPY.treeEmptyExecutionFilterSubtext('issues');
    expect(text.toLowerCase()).toMatch(/issues/);
    expect(text.toLowerCase()).toMatch(/fail/);
  });

  it('execution filter section copy distinguishes run outcome from tests row', () => {
    expect(EXPLORER_UI_COPY.executionStatusSectionTitle.toLowerCase()).toMatch(/run/);
    expect(EXPLORER_UI_COPY.executionStatusRunOutcomeSubLabel).toMatch(/run outcome/i);
    expect(EXPLORER_UI_COPY.executionStatusProblemsSubLabel.toLowerCase()).toMatch(/test/);
  });

  it('explains attention-only tree test copy', () => {
    expect(EXPLORER_UI_COPY.treeTestStatsTitle.toLowerCase()).toMatch(/dbt test|attention/);
    expect(EXPLORER_UI_COPY.treeTestStatsTitle.toLowerCase()).toMatch(/not executed|not shown/);
    expect(EXPLORER_UI_COPY.treeTestStatsBranchAriaLabel.toLowerCase()).toMatch(
      /rollup|attention|skipped/,
    );
    expect(EXPLORER_UI_COPY.treeTestStatsBranchAriaLabel.toLowerCase()).toMatch(
      /not-executed|not shown/,
    );
    expect(EXPLORER_UI_COPY.treeTestStatsTitle.toLowerCase()).toMatch(/pass/);
  });
});

describe('executionStatusPillLabel', () => {
  it('labels Fail and Issues so they are not confused', () => {
    expect(executionStatusPillLabel('danger')).toMatch(/fail/i);
    expect(executionStatusPillLabel('danger')).toMatch(/run/i);
    expect(executionStatusPillLabel('issues').toLowerCase()).toMatch(/issues/);
    expect(executionStatusPillLabel('issues').toLowerCase()).toMatch(/test/);
  });

  it('covers every dashboard status filter value', () => {
    const values: DashboardStatusFilter[] = [
      'all',
      'issues',
      'positive',
      'warning',
      'danger',
      'skipped',
      'neutral',
    ];
    for (const v of values) {
      expect(executionStatusPillLabel(v).length).toBeGreaterThan(0);
      expect(executionStatusFilterButtonTitle(v).length).toBeGreaterThan(10);
    }
  });
});

describe('buildExplorerTreeEmptySubtext', () => {
  it('uses default subtext when no restrictive filters', () => {
    expect(
      buildExplorerTreeEmptySubtext({
        status: 'all',
        resourceQuery: '',
        activeResourceTypeCount: 0,
      }),
    ).toBe(EXPLORER_UI_COPY.treeEmptyDefaultSubtext);
  });

  it('combines execution status with search and type hints', () => {
    const sub = buildExplorerTreeEmptySubtext({
      status: 'danger',
      resourceQuery: 'orders',
      activeResourceTypeCount: 2,
    });
    expect(sub).toContain(EXPLORER_UI_COPY.treeEmptyExecutionFilterSubtext('danger'));
    expect(sub).toContain(EXPLORER_UI_COPY.treeEmptySearchSubtext);
    expect(sub).toContain(EXPLORER_UI_COPY.treeEmptyResourceTypesSubtext);
  });

  it('mentions materialization filters when active', () => {
    const sub = buildExplorerTreeEmptySubtext({
      status: 'all',
      resourceQuery: '',
      activeResourceTypeCount: 0,
      activeMaterializationKindCount: 1,
    });
    expect(sub).toContain(EXPLORER_UI_COPY.treeEmptyMaterializationSubtext);
  });
});

describe('ResourceTypeSummaryBar', () => {
  let container: HTMLElement;
  let root: Root;

  afterEach(() => {
    if (root && container.parentNode) cleanup(root, container);
  });

  it('returns null when there are no executed non-test assets', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(<ResourceTypeSummaryBar resources={[makeModel('m1', 'neutral')]} />);
    });
    expect(container.querySelector('.resource-type-summary')).toBeNull();
  });

  it('exposes an aria-label that states counts are not dbt test totals', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(<ResourceTypeSummaryBar resources={[makeModel('m1', 'positive')]} />);
    });
    const bar = container.querySelector('.resource-type-summary');
    expect(bar).not.toBeNull();
    const label = bar?.getAttribute('aria-label') ?? '';
    expect(label.toLowerCase()).toContain('not dbt test');
    expect(bar?.getAttribute('title')).toBe(EXPLORER_UI_COPY.resourceTypeSummaryTitle);
  });

  it('sets per-type item title for executed asset outcomes', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(<ResourceTypeSummaryBar resources={[makeModel('m1', 'positive')]} />);
    });
    const item = container.querySelector('.resource-type-summary__item');
    const title = item?.getAttribute('title') ?? '';
    expect(title.toLowerCase()).toContain('not dbt test');
  });
});

describe('ExplorerTreeTestStatsGroup', () => {
  let container: HTMLElement;
  let root: Root;

  afterEach(() => {
    if (root && container.parentNode) cleanup(root, container);
  });

  it('renders nothing when there are no test stats', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <ExplorerTreeTestStatsGroup
          testStats={{
            pass: 0,
            fail: 0,
            error: 0,
            warn: 0,
            skipped: 0,
            notExecuted: 0,
          }}
          variant="branch"
        />,
      );
    });
    expect(container.textContent?.trim()).toBe('');
  });

  it('shows Test issues label, error only, no pass pill', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <ExplorerTreeTestStatsGroup
          testStats={{
            pass: 2,
            fail: 0,
            error: 1,
            warn: 0,
            skipped: 0,
            notExecuted: 0,
          }}
          variant="branch"
        />,
      );
    });
    expect(container.textContent).toContain('Test issues');
    expect(container.textContent).not.toContain('✓');
    expect(container.textContent).toContain('✗1');
    const group = container.querySelector('[role="group"]');
    expect(group?.getAttribute('aria-label')).toBe(EXPLORER_UI_COPY.treeTestStatsBranchAriaLabel);
    expect(group?.getAttribute('title')).toBe(EXPLORER_UI_COPY.treeTestStatsTitle);
  });

  it('renders nothing for pass-only stats', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <ExplorerTreeTestStatsGroup
          testStats={{
            pass: 5,
            fail: 0,
            error: 0,
            warn: 0,
            skipped: 0,
            notExecuted: 0,
          }}
          variant="leaf"
        />,
      );
    });
    expect(container.querySelector('[role="group"]')).toBeNull();
    expect(container.textContent?.trim()).toBe('');
  });

  it('shows warn and dbt-skipped badges without red X when no errors', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <ExplorerTreeTestStatsGroup
          testStats={{
            pass: 0,
            fail: 0,
            error: 0,
            warn: 2,
            skipped: 3,
            notExecuted: 0,
          }}
          variant="branch"
        />,
      );
    });
    expect(container.textContent).toContain('!2');
    expect(container.textContent).toContain('\u22123');
    expect(container.textContent).not.toContain('✗');
    const skipped = container.querySelector('.explorer-tree__test-stat--skipped');
    expect(skipped?.getAttribute('title')).toBe(EXPLORER_UI_COPY.treeTestStatSkippedTitle(3));
  });

  it('renders nothing for not-executed-only stats', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <ExplorerTreeTestStatsGroup
          testStats={{
            pass: 0,
            fail: 0,
            error: 0,
            warn: 0,
            skipped: 0,
            notExecuted: 2,
          }}
          variant="leaf"
        />,
      );
    });
    expect(container.querySelector('[role="group"]')).toBeNull();
    expect(container.textContent?.trim()).toBe('');
  });

  it('shows error badge but not not-executed when both are non-zero', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <ExplorerTreeTestStatsGroup
          testStats={{
            pass: 0,
            fail: 0,
            error: 1,
            warn: 0,
            skipped: 0,
            notExecuted: 99,
          }}
          variant="leaf"
        />,
      );
    });
    expect(container.textContent).toContain('✗1');
    expect(container.textContent).not.toContain('99');
    expect(container.querySelector('.explorer-tree__test-stat--not-executed')).toBeNull();
  });

  it('sets per-segment title for error stats', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <ExplorerTreeTestStatsGroup
          testStats={{
            pass: 5,
            fail: 0,
            error: 2,
            warn: 0,
            skipped: 0,
            notExecuted: 0,
          }}
          variant="branch"
        />,
      );
    });
    expect(container.querySelector('.explorer-tree__test-stat--pass')).toBeNull();
    expect(container.querySelector('.explorer-tree__test-stat--fail')?.getAttribute('title')).toBe(
      EXPLORER_UI_COPY.treeTestStatErrorTitle(2),
    );
  });
});
