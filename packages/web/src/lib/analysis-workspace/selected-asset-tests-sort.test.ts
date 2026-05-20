import { describe, expect, it } from 'vitest';

import { sortSelectedAssetTests } from './selected-asset-tests-sort';

import type { ResourceNode } from '@web/types';

function makeTestResource(overrides: Partial<ResourceNode> = {}): ResourceNode {
  return {
    uniqueId: overrides.uniqueId ?? 'test.pkg.t_a',
    name: overrides.name ?? 't_a',
    resourceType: overrides.resourceType ?? 'test',
    packageName: overrides.packageName ?? 'pkg',
    path: overrides.path ?? 'tests/t_a.sql',
    originalFilePath: overrides.originalFilePath ?? 'tests/t_a.sql',
    patchPath: overrides.patchPath ?? null,
    database: overrides.database ?? 'db',
    schema: overrides.schema ?? 'sch',
    description: overrides.description ?? '',
    compiledCode: overrides.compiledCode,
    rawCode: overrides.rawCode,
    definition: overrides.definition,
    status: overrides.status ?? 'success',
    statusTone: overrides.statusTone ?? 'positive',
    executionTime: overrides.executionTime ?? 1,
    threadId: overrides.threadId ?? 't1',
    ...overrides,
  } as ResourceNode;
}

describe('sortSelectedAssetTests', () => {
  it('sorts by test name ascending with uniqueId tie-break', () => {
    const b = makeTestResource({ name: 'b_test', uniqueId: 'test.pkg.b' });
    const a = makeTestResource({ name: 'a_test', uniqueId: 'test.pkg.a' });
    const sorted = sortSelectedAssetTests([b, a], 'test', 'asc');
    expect(sorted.map((r) => r.name)).toEqual(['a_test', 'b_test']);
  });

  it('sorts by duration descending (longer first)', () => {
    const short = makeTestResource({
      name: 'short',
      uniqueId: 'test.pkg.s',
      executionTime: 1,
    });
    const long = makeTestResource({
      name: 'long',
      uniqueId: 'test.pkg.l',
      executionTime: 99,
    });
    const sorted = sortSelectedAssetTests([short, long], 'duration', 'desc');
    expect(sorted.map((r) => r.name)).toEqual(['long', 'short']);
  });

  it('sorts by resource type label then name', () => {
    const unit = makeTestResource({
      name: 'u',
      uniqueId: 'test.pkg.u',
      resourceType: 'unit_test',
    });
    const generic = makeTestResource({
      name: 'g',
      uniqueId: 'test.pkg.g',
      resourceType: 'test',
    });
    const sorted = sortSelectedAssetTests([unit, generic], 'type', 'asc');
    expect(sorted.map((r) => r.resourceType)).toEqual(['test', 'unit_test']);
  });

  it('sorts by test target string then name', () => {
    const b = makeTestResource({
      name: 'b',
      uniqueId: 'test.pkg.b',
      testAttachedTarget: 'zebra.col',
    });
    const a = makeTestResource({
      name: 'a',
      uniqueId: 'test.pkg.a',
      testAttachedTarget: 'apple.col',
    });
    const sorted = sortSelectedAssetTests([b, a], 'target', 'asc');
    expect(sorted.map((r) => r.testAttachedTarget)).toEqual(['apple.col', 'zebra.col']);
  });

  it('sorts by status rank then duration (attention before passing)', () => {
    const pass = makeTestResource({
      name: 'ok',
      uniqueId: 'test.pkg.ok',
      statusTone: 'positive',
      executionTime: 100,
    });
    const warn = makeTestResource({
      name: 'bad',
      uniqueId: 'test.pkg.bad',
      statusTone: 'warning',
      executionTime: 1,
    });
    const sorted = sortSelectedAssetTests([pass, warn], 'status', 'desc');
    expect(sorted.map((r) => r.name)).toEqual(['bad', 'ok']);
  });

  it('sorts by status rank: neutral after skipped after positive (desc)', () => {
    const neutral = makeTestResource({
      name: 'n',
      uniqueId: 'test.pkg.n',
      statusTone: 'neutral',
      executionTime: 1,
    });
    const skipped = makeTestResource({
      name: 's',
      uniqueId: 'test.pkg.s',
      statusTone: 'skipped',
      executionTime: 1,
    });
    const pass = makeTestResource({
      name: 'p',
      uniqueId: 'test.pkg.p',
      statusTone: 'positive',
      executionTime: 1,
    });
    const sorted = sortSelectedAssetTests([neutral, skipped, pass], 'status', 'desc');
    expect(sorted.map((r) => r.name)).toEqual(['p', 's', 'n']);
  });
});
