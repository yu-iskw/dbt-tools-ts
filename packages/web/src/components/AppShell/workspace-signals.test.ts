import { describe, expect, it } from 'vitest';

import { buildWorkspaceSignals } from './workspace-signals';

import type { AnalysisState, ExecutionRow, ResourceNode } from '@web/types';

function resource(partial: Partial<ResourceNode> & { uniqueId: string }): ResourceNode {
  return {
    name: partial.uniqueId,
    resourceType: 'model',
    packageName: 'pkg',
    path: null,
    originalFilePath: null,
    description: partial.description ?? null,
    status: null,
    statusTone: 'neutral',
    executionTime: null,
    threadId: null,
    ...partial,
  };
}

function execution(partial: Partial<ExecutionRow> & { uniqueId: string }): ExecutionRow {
  return {
    name: partial.uniqueId,
    resourceType: 'model',
    packageName: 'pkg',
    path: null,
    status: 'success',
    statusTone: 'positive',
    executionTime: 0,
    threadId: null,
    start: null,
    end: null,
    ...partial,
  };
}

function analysis(overrides: Partial<AnalysisState>): AnalysisState {
  return {
    summary: {
      total_execution_time: 0,
      total_nodes: 2,
      nodes_by_status: {},
      node_executions: [],
    },
    projectName: 'p',
    runStartedAt: null,
    ganttData: [],
    bottlenecks: undefined,
    graphSummary: {
      totalNodes: 2,
      totalEdges: 7,
      hasCycles: false,
      nodesByType: {},
    },
    resources: [],
    resourceGroups: [],
    executions: [],
    statusBreakdown: [],
    threadStats: [],
    dependencyIndex: {},
    timelineAdjacency: {},
    selectedResourceId: null,
    ...overrides,
  } as AnalysisState;
}

describe('buildWorkspaceSignals', () => {
  it('reports healthy run posture when no danger or warning executions', () => {
    const signals = buildWorkspaceSignals(
      analysis({
        executions: [execution({ uniqueId: 'a', statusTone: 'positive' })],
      }),
      'upload',
    );
    expect(signals[0].label).toBe('Run posture');
    expect(signals[0].value).toBe('Healthy');
    expect(signals[0].tone).toBe('positive');
  });

  it('prefers danger over warning for run posture', () => {
    const signals = buildWorkspaceSignals(
      analysis({
        executions: [
          execution({ uniqueId: 'w', statusTone: 'warning' }),
          execution({ uniqueId: 'd', statusTone: 'danger' }),
        ],
      }),
      'upload',
    );
    expect(signals[0].value).toBe('1 failing');
    expect(signals[0].tone).toBe('danger');
  });

  it('surfaces warning posture when no failures', () => {
    const signals = buildWorkspaceSignals(
      analysis({
        executions: [execution({ uniqueId: 'w', statusTone: 'warning' })],
      }),
      'upload',
    );
    expect(signals[0].value).toBe('1 warning');
    expect(signals[0].tone).toBe('warning');
  });

  it('computes metadata coverage tones from documented share', () => {
    const low = buildWorkspaceSignals(
      analysis({
        resources: [
          resource({ uniqueId: 'a', description: '' }),
          resource({ uniqueId: 'b', description: '   ' }),
        ],
      }),
      'upload',
    );
    expect(low[1].label).toBe('Metadata coverage');
    expect(low[1].tone).toBe('neutral');

    const mid = buildWorkspaceSignals(
      analysis({
        resources: [
          resource({ uniqueId: 'a', description: 'x' }),
          resource({ uniqueId: 'b', description: 'y' }),
          resource({ uniqueId: 'c', description: '' }),
          resource({ uniqueId: 'd', description: '' }),
        ],
      }),
      'upload',
    );
    expect(mid[1].tone).toBe('warning');

    const high = buildWorkspaceSignals(
      analysis({
        resources: [
          resource({ uniqueId: 'a', description: 'x' }),
          resource({ uniqueId: 'b', description: 'y' }),
        ],
      }),
      'upload',
    );
    expect(high[1].value).toBe('100%');
    expect(high[1].tone).toBe('positive');
  });

  it('describes preload vs upload workspace modes', () => {
    const preload = buildWorkspaceSignals(analysis({}), 'preload');
    expect(preload[2].value).toBe('Live target');
    expect(preload[2].detail).toContain('7 dependency edges');

    const upload = buildWorkspaceSignals(
      analysis({
        summary: {
          total_execution_time: 0,
          total_nodes: 5,
          nodes_by_status: {},
          node_executions: [],
        },
        executions: [
          execution({ uniqueId: 't1', resourceType: 'test' }),
          execution({ uniqueId: 't2', resourceType: 'unit_test' }),
        ],
      }),
      'upload',
    );
    expect(upload[2].value).toBe('Artifact upload');
    expect(upload[2].detail).toContain('including 2 tests');
  });
});
