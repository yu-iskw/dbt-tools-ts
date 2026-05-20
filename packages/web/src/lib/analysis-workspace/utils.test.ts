import { describe, it, expect } from 'vitest';

import {
  countTimelineTestResources,
  formatRelationNameForDisplay,
  formatSeconds,
  deriveProjectName,
  matchesAssetStatus,
  matchesResource,
  isMainProjectResource,
  isDefaultTimelineResource,
  getDefaultTimelineActiveTypes,
  timelineGanttHasCompileExecutePhases,
} from './utils';

import type { ResourceNode, ExecutionRow } from '@web/types';

// minimal stubs
function makeResource(overrides: Partial<ResourceNode> = {}): ResourceNode {
  return {
    uniqueId: 'model.jaffle_shop.orders',
    name: 'orders',
    resourceType: 'model',
    packageName: 'jaffle_shop',
    fqn: ['jaffle_shop', 'orders'],
    originalFilePath: 'models/orders.sql',
    description: '',
    dependsOn: [],
    database: 'dev',
    schema: 'dbt',
    ...overrides,
  } as ResourceNode;
}

describe('formatRelationNameForDisplay', () => {
  it('removes redundant quotes around each dotted segment', () => {
    expect(formatRelationNameForDisplay(`"jaffle_shop"."elementary"."orders"`)).toBe(
      'jaffle_shop.elementary.orders',
    );
  });

  it('leaves already-unquoted relation paths unchanged', () => {
    expect(formatRelationNameForDisplay('dev.analytics.fct_orders')).toBe(
      'dev.analytics.fct_orders',
    );
  });

  it('unescapes doubled double-quotes inside a quoted segment', () => {
    expect(formatRelationNameForDisplay(`"a""b"."schema"`)).toBe(`a"b.schema`);
  });
});

describe('formatSeconds', () => {
  it('formats sub-minute', () => expect(formatSeconds(1.5)).toBe('1.50s'));
  it('formats exactly 0', () => expect(formatSeconds(0)).toBe('0.00s'));
  it('formats minutes', () => expect(formatSeconds(65.3)).toBe('1m 05.30s'));
  it('formats large values', () => expect(formatSeconds(125)).toBe('2m 05.00s'));
});

describe('deriveProjectName', () => {
  it('returns null for empty array', () => expect(deriveProjectName([])).toBeNull());
  it('returns most-common packageName', () => {
    const rows = [
      { packageName: 'a' },
      { packageName: 'b' },
      { packageName: 'b' },
    ] as ExecutionRow[];
    expect(deriveProjectName(rows)).toBe('b');
  });
});

describe('matchesResource', () => {
  it('matches by name', () => expect(matchesResource(makeResource(), 'orders')).toBe(true));
  it('no match on wrong query', () =>
    expect(matchesResource(makeResource(), 'customers')).toBe(false));
  it('empty query always matches', () => expect(matchesResource(makeResource(), '')).toBe(true));
  it('matches structured type filters', () =>
    expect(matchesResource(makeResource(), 'type:model')).toBe(true));
  it('matches structured package and path filters', () =>
    expect(
      matchesResource(
        makeResource({ path: 'models/marts/orders.sql' }),
        'package:jaffle_shop path:marts',
      ),
    ).toBe(true));
  it('matches structured tag filters', () =>
    expect(matchesResource(makeResource({ tags: ['daily', 'finance'] }), 'tag:finance')).toBe(
      true,
    ));
});

describe('matchesAssetStatus', () => {
  it('issues matches danger execution tone without rollup', () => {
    expect(
      matchesAssetStatus(
        makeResource({ uniqueId: 'm1', statusTone: 'danger' }),
        'issues',
        new Map(),
      ),
    ).toBe(true);
  });

  it('issues matches successful model when rollup map shows test attention', () => {
    expect(
      matchesAssetStatus(
        makeResource({ uniqueId: 'm1', statusTone: 'positive' }),
        'issues',
        new Map([['m1', { fail: 0, error: 1, warn: 0, skipped: 0 }]]),
      ),
    ).toBe(true);
  });

  it('issues excludes successful model with no rollup attention', () => {
    expect(
      matchesAssetStatus(
        makeResource({ uniqueId: 'm1', statusTone: 'positive' }),
        'issues',
        new Map(),
      ),
    ).toBe(false);
  });

  it('Fail filter ignores test rollup', () => {
    expect(
      matchesAssetStatus(
        makeResource({ uniqueId: 'm1', statusTone: 'positive' }),
        'danger',
        new Map([['m1', { fail: 0, error: 1, warn: 0, skipped: 0 }]]),
      ),
    ).toBe(false);
  });
});

describe('isMainProjectResource', () => {
  it('true when packageName equals projectName', () =>
    expect(isMainProjectResource(makeResource({ packageName: 'jaffle_shop' }), 'jaffle_shop')).toBe(
      true,
    ));
  it('false for different package', () =>
    expect(isMainProjectResource(makeResource({ packageName: 'elementary' }), 'jaffle_shop')).toBe(
      false,
    ));
});

describe('timelineGanttHasCompileExecutePhases', () => {
  it('false when compile or execute span is missing or non-positive', () => {
    expect(timelineGanttHasCompileExecutePhases([])).toBe(false);
    expect(
      timelineGanttHasCompileExecutePhases([
        {
          compileStart: 0,
          compileEnd: 0,
          executeStart: 1,
          executeEnd: 2,
        },
      ]),
    ).toBe(false);
    expect(
      timelineGanttHasCompileExecutePhases([
        {
          compileStart: 0,
          compileEnd: 1,
          executeStart: 1,
          executeEnd: 1,
        },
      ]),
    ).toBe(false);
  });

  it('true when any row has positive compile and execute duration', () => {
    expect(
      timelineGanttHasCompileExecutePhases([
        {
          compileStart: 0,
          compileEnd: 1,
          executeStart: 1,
          executeEnd: 2,
        },
      ]),
    ).toBe(true);
  });
});

describe('countTimelineTestResources', () => {
  it('counts test and unit_test in project scope', () => {
    expect(
      countTimelineTestResources(
        [
          makeResource({ resourceType: 'test', packageName: 'p' }),
          makeResource({ resourceType: 'unit_test', packageName: 'p' }),
          makeResource({ resourceType: 'model', packageName: 'p' }),
        ],
        'p',
      ),
    ).toBe(2);
  });

  it('excludes other packages when projectName is set', () =>
    expect(
      countTimelineTestResources(
        [makeResource({ resourceType: 'test', packageName: 'other' })],
        'p',
      ),
    ).toBe(0));

  it('includes tests from all packages when projectName is null', () =>
    expect(
      countTimelineTestResources([
        makeResource({ resourceType: 'test', packageName: 'a' }),
        makeResource({ resourceType: 'test', packageName: 'b' }),
      ]),
    ).toBe(2));
});

describe('isDefaultTimelineResource', () => {
  it('false for test resource', () =>
    expect(isDefaultTimelineResource(makeResource({ resourceType: 'test' }))).toBe(false));
  it('false for unit_test resource', () =>
    expect(isDefaultTimelineResource(makeResource({ resourceType: 'unit_test' }))).toBe(false));
  it('true for model resource', () =>
    expect(isDefaultTimelineResource(makeResource({ resourceType: 'model' }))).toBe(true));
  it('true for seed in project package', () =>
    expect(
      isDefaultTimelineResource(
        {
          resourceType: 'seed',
          packageName: 'jaffle_shop',
          name: 'raw_customers',
          path: null,
        },
        'jaffle_shop',
      ),
    ).toBe(true));
  it('true for source in project package', () =>
    expect(
      isDefaultTimelineResource(
        {
          resourceType: 'source',
          packageName: 'jaffle_shop',
          name: 'orders',
          path: null,
        },
        'jaffle_shop',
      ),
    ).toBe(true));
  it('true for source_freshness in project package', () =>
    expect(
      isDefaultTimelineResource(
        {
          resourceType: 'source_freshness',
          packageName: 'jaffle_shop',
          name: 'freshness',
          path: null,
        },
        'jaffle_shop',
      ),
    ).toBe(true));
});

describe('getDefaultTimelineActiveTypes', () => {
  it('includes seed snapshot and source when present', () => {
    expect([...getDefaultTimelineActiveTypes(['model', 'seed', 'snapshot', 'source'])]).toEqual([
      'model',
      'seed',
      'snapshot',
      'source',
    ]);
  });

  it('excludes test-like types from the default active set', () => {
    expect([...getDefaultTimelineActiveTypes(['model', 'test', 'unit_test', 'seed'])]).toEqual([
      'model',
      'seed',
    ]);
  });
});
