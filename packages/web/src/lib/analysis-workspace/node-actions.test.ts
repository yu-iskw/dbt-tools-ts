import { describe, expect, it, vi } from 'vitest';

import { buildNodeActionContext, getNodeActions, runNodeAction } from './node-actions';

import type { AnalysisState } from '@web/types';

const analysis = {
  ganttData: [{ unique_id: 'model.p.orders' }, { unique_id: 'source.p.raw.customers' }],
  executions: [{ uniqueId: 'model.p.orders' }],
  resources: [
    { uniqueId: 'model.p.orders' },
    { uniqueId: 'source.p.raw.customers' },
    { uniqueId: 'macro.p.helper' },
  ],
} as unknown as AnalysisState;

const ctx = buildNodeActionContext(analysis);
const labels = (nodeId: string, exclude: Parameters<typeof getNodeActions>[2] = []) =>
  getNodeActions(ctx, nodeId, exclude).map((action) => action.label);

describe('getNodeActions', () => {
  it('offers every view for an executed model', () => {
    expect(labels('model.p.orders')).toEqual([
      'Open in Timeline',
      'Open in Runs',
      'Open in Inventory',
      'Open in Lineage',
    ]);
  });

  it('offers Timeline but not Runs for a source that only has a Timeline row', () => {
    expect(labels('source.p.raw.customers')).toEqual([
      'Open in Timeline',
      'Open in Inventory',
      'Open in Lineage',
    ]);
  });

  it('offers only Inventory and Lineage for a macro that did not run', () => {
    expect(labels('macro.p.helper')).toEqual(['Open in Inventory', 'Open in Lineage']);
  });

  it('offers nothing for an unknown node', () => {
    expect(labels('model.p.ghost')).toEqual([]);
  });

  it('leaves out the views listed in exclude', () => {
    expect(labels('model.p.orders', ['runs'])).toEqual([
      'Open in Timeline',
      'Open in Inventory',
      'Open in Lineage',
    ]);
    expect(labels('model.p.orders', ['inventory', 'lineage'])).toEqual([
      'Open in Timeline',
      'Open in Runs',
    ]);
  });
});

describe('node action navigation', () => {
  const id = 'model.p.orders';
  const call = (action: Parameters<typeof runNodeAction>[0]) => {
    const onNavigateTo = vi.fn();
    runNodeAction(action, id, onNavigateTo);
    return onNavigateTo;
  };

  it('opens Timeline with the node selected', () => {
    expect(call('timeline')).toHaveBeenCalledWith('timeline', { resourceId: id, executionId: id });
  });

  it('opens Runs with the execution selected', () => {
    expect(call('runs')).toHaveBeenCalledWith('runs', { executionId: id });
  });

  it('opens the Inventory summary', () => {
    expect(call('inventory')).toHaveBeenCalledWith('inventory', {
      resourceId: id,
      assetTab: 'summary',
    });
  });

  it('opens the Inventory lineage tab rooted at the node', () => {
    expect(call('lineage')).toHaveBeenCalledWith('inventory', {
      resourceId: id,
      assetTab: 'lineage',
      rootResourceId: id,
    });
  });
});
