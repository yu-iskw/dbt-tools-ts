import { describe, expect, it } from 'vitest';

import { getObjectProperty } from '../../util/typed-map';

import { buildTestAttachedTargetDisplay } from './test-target';

import type { GraphLike } from './internal';

function stubGraph(attrsById: Record<string, Record<string, unknown>>): GraphLike {
  return {
    getGraph: () => ({
      forEachNode: () => {},
      getNodeAttributes: (id) =>
        getObjectProperty(attrsById, id) as Record<string, unknown> | undefined,
      hasNode: (id) => id in attrsById,
    }),
    getUpstream: () => [],
    getDownstream: () => [],
  };
}

describe('buildTestAttachedTargetDisplay', () => {
  it('joins attached model name and column_name', () => {
    const graph = stubGraph({
      'model.jaffle_shop.orders': {
        name: 'orders',
        resource_type: 'model',
      },
    });
    expect(
      buildTestAttachedTargetDisplay(
        {
          attached_node: 'model.jaffle_shop.orders',
          column_name: 'order_id',
        },
        graph,
      ),
    ).toBe('orders.order_id');
  });

  it('falls back to depends_on nodes when attached_node is absent', () => {
    const graph = stubGraph({
      'model.jaffle_shop.orders': {
        name: 'orders',
        resource_type: 'model',
      },
    });
    expect(
      buildTestAttachedTargetDisplay(
        {
          depends_on: { nodes: ['model.jaffle_shop.orders'] },
          column_name: 'customer_id',
        },
        graph,
      ),
    ).toBe('orders.customer_id');
  });
});
