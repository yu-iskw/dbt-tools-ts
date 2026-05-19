import { describe, it, expect } from 'vitest';

import { buildInvocationResourceComparison } from './invocation-resource-stats';

import type { AnalysisState, ResourceNode } from '@web/types';

function resourceStub(uniqueId: string, resourceType: string, packageName: string): ResourceNode {
  return {
    uniqueId,
    name: uniqueId,
    resourceType,
    packageName,
    path: null,
    originalFilePath: null,
    patchPath: null,
    database: null,
    schema: null,
    description: null,
    compiledCode: null,
    rawCode: null,
    definition: null,
    status: null,
    statusTone: 'neutral',
    executionTime: null,
    threadId: null,
  };
}

function minimalAnalysis(
  overrides: Partial<AnalysisState> & Pick<AnalysisState, 'graphSummary'>,
): AnalysisState {
  const { graphSummary, ...rest } = overrides;
  return {
    summary: {
      total_execution_time: 0,
      total_nodes: 0,
      nodes_by_status: {},
      node_executions: [],
    },
    projectName: 'pkg',
    warehouseType: null,
    runStartedAt: null,
    ganttData: [],
    bottlenecks: undefined,
    resources: [],
    resourceGroups: [],
    executions: [],
    statusBreakdown: [],
    threadStats: [],
    dependencyIndex: {},
    timelineAdjacency: {},
    selectedResourceId: null,
    invocationId: null,
    ...rest,
    graphSummary,
  };
}

describe('buildInvocationResourceComparison', () => {
  it('counts graph, run, and timeline per type with package filter on executions', () => {
    const resources: ResourceNode[] = [
      resourceStub('model.pkg.a', 'model', 'pkg'),
      ...[0, 1, 2, 3].map((i) => resourceStub(`model.other.m${i}`, 'model', 'other')),
      ...[0, 1, 2].map((i) => resourceStub(`source.other.s${i}`, 'source', 'other')),
      resourceStub('seed.pkg.s', 'seed', 'pkg'),
    ];
    const analysis = minimalAnalysis({
      graphSummary: {
        totalNodes: resources.length,
        totalEdges: 0,
        hasCycles: false,
        nodesByType: { model: 5, source: 3, seed: 1 },
      },
      resources,
      executions: [
        {
          uniqueId: 'model.pkg.a',
          name: 'a',
          resourceType: 'model',
          packageName: 'pkg',
          path: null,
          status: 'success',
          statusTone: 'positive',
          executionTime: 1,
          threadId: null,
          start: 0,
          end: 1,
        },
        {
          uniqueId: 'model.other.b',
          name: 'b',
          resourceType: 'model',
          packageName: 'other',
          path: null,
          status: 'success',
          statusTone: 'positive',
          executionTime: 1,
          threadId: null,
          start: 0,
          end: 1,
        },
      ],
      ganttData: [
        {
          unique_id: 'model.pkg.a',
          name: 'a',
          start: 0,
          end: 1,
          duration: 1,
          status: 'success',
          resourceType: 'model',
          packageName: 'pkg',
          path: null,
          parentId: null,
          compileStart: null,
          compileEnd: null,
          executeStart: null,
          executeEnd: null,
          materialized: null,
        },
      ],
    });

    const rows = buildInvocationResourceComparison(analysis, 'pkg');
    const model = rows.find((r) => r.resourceType === 'model');
    const source = rows.find((r) => r.resourceType === 'source');

    expect(model).toEqual({
      resourceType: 'model',
      graphCount: 1,
      runCount: 1,
      timelineCount: 1,
    });
    expect(source).toMatchObject({
      resourceType: 'source',
      graphCount: 0,
      runCount: 0,
      timelineCount: 0,
    });
  });

  it('includes pinned types when other columns are zero', () => {
    const analysis = minimalAnalysis({
      graphSummary: {
        totalNodes: 1,
        totalEdges: 0,
        hasCycles: false,
        nodesByType: { model: 1 },
      },
    });
    const rows = buildInvocationResourceComparison(analysis, null);
    expect(rows.some((r) => r.resourceType === 'source')).toBe(true);
    expect(rows.some((r) => r.resourceType === 'seed')).toBe(true);
  });

  it('uses full graphSummary.nodesByType when projectName is null even if resources is empty', () => {
    const analysis = minimalAnalysis({
      graphSummary: {
        totalNodes: 2,
        totalEdges: 0,
        hasCycles: false,
        nodesByType: { model: 2, exposure: 1 },
      },
      resources: [],
    });
    const rows = buildInvocationResourceComparison(analysis, null);
    expect(rows.find((r) => r.resourceType === 'model')).toMatchObject({
      graphCount: 2,
      runCount: 0,
      timelineCount: 0,
    });
    expect(rows.find((r) => r.resourceType === 'exposure')).toMatchObject({
      graphCount: 1,
      runCount: 0,
      timelineCount: 0,
    });
  });
});
