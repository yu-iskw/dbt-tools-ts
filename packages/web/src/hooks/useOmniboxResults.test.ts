import { describe, expect, it } from 'vitest';
import type { AnalysisState, ResourceNode } from '@web/types';
import { matchesResource } from '@web/lib/analysis-workspace/utils';
import { computeOmniboxRecentResults } from './useOmniboxResults';

function analysisWithResources(resources: ResourceNode[]): AnalysisState {
  return {
    resources,
    summary: {
      total_execution_time: 0,
      total_nodes: 0,
      total_edges: 0,
      nodes_by_status: {},
      type_counts: {},
    },
    bundles: [],
    graph: { nodes: [], edges: [] },
  } as unknown as AnalysisState;
}

describe('computeOmniboxRecentResults', () => {
  it('returns recent resources when query is empty', () => {
    const resources = [
      {
        uniqueId: 'm.a',
        name: 'a',
        resourceType: 'model',
        packageName: 'pkg',
        path: 'models/a.sql',
      },
    ] as ResourceNode[];
    const analysis = analysisWithResources(resources);
    const out = computeOmniboxRecentResults(analysis, {
      query: '',
      recentResourceIds: ['m.a'],
      isOpen: true,
    });
    expect(out).toHaveLength(1);
    expect(out[0]?.uniqueId).toBe('m.a');
  });

  it('returns empty when query is non-empty (search is async in useOmniboxResults)', () => {
    const resources = [
      {
        uniqueId: 'm.x',
        name: 'alpha',
        resourceType: 'model',
        packageName: 'pkg',
        path: 'models/x.sql',
      },
    ] as ResourceNode[];
    const analysis = analysisWithResources(resources);
    expect(
      computeOmniboxRecentResults(analysis, {
        query: 'alpha',
        recentResourceIds: [],
        isOpen: true,
      }),
    ).toEqual([]);
  });

  it('returns empty when analysis is null', () => {
    expect(
      computeOmniboxRecentResults(null, {
        query: '',
        recentResourceIds: [],
        isOpen: false,
      }),
    ).toEqual([]);
  });
});

describe('matchesResource (omnibox filter parity with worker)', () => {
  it('filters by query substring', () => {
    const resources = [
      {
        uniqueId: 'm.x',
        name: 'alpha',
        resourceType: 'model',
        packageName: 'pkg',
        path: 'models/x.sql',
      },
      {
        uniqueId: 'm.y',
        name: 'beta',
        resourceType: 'test',
        packageName: 'pkg',
        path: 'tests/y.sql',
      },
    ] as ResourceNode[];
    expect(resources.filter((r) => matchesResource(r, 'beta'))).toHaveLength(1);
    expect(resources.find((r) => matchesResource(r, 'beta'))?.uniqueId).toBe('m.y');
  });
});
