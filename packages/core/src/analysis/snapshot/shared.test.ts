import { describe, expect, it } from 'vitest';

import {
  buildTimelineProjectName,
  inferDominantPackageFromNodeExecutions,
  statusTone,
  type PackageLookupGraph,
} from './shared';

const stubLookupGraph: PackageLookupGraph = {
  hasNode: () => false,
  getNodeAttributes: () => undefined,
};

describe('statusTone', () => {
  it('maps dbt skipped and no-op statuses to skipped tone', () => {
    expect(statusTone('skipped')).toBe('skipped');
    expect(statusTone('Skipped')).toBe('skipped');
    expect(statusTone('no op')).toBe('skipped');
    expect(statusTone('NO OP')).toBe('skipped');
  });

  it('maps empty or unknown strings to neutral', () => {
    expect(statusTone(null)).toBe('neutral');
    expect(statusTone(undefined)).toBe('neutral');
    expect(statusTone('')).toBe('neutral');
    expect(statusTone('pending')).toBe('neutral');
    expect(statusTone('queued')).toBe('neutral');
  });

  it.each(['success', 'Success', 'pass', 'PASS', 'passed', 'Passed'])(
    'maps success-like %s to positive',
    (s) => {
      expect(statusTone(s)).toBe('positive');
    },
  );

  it.each(['warn', 'Warn', 'warning', 'WARNING'])('maps warning-like %s to warning', (s) => {
    expect(statusTone(s)).toBe('warning');
  });

  it.each([
    'error',
    'ERROR',
    'errors',
    'fail',
    'failed',
    'failure',
    'failures',
    'errored',
    'run error',
    'RUN ERROR',
    'runtime error',
    'compile error',
    'database error',
  ])('maps failure-like %s to danger', (s) => {
    expect(statusTone(s)).toBe('danger');
  });
});

describe('inferDominantPackageFromNodeExecutions', () => {
  it('breaks equal package counts by lexicographic package name, not execution order', () => {
    const orderA = [
      { unique_id: 'model.pkg_z.m1' },
      { unique_id: 'model.pkg_z.m2' },
      { unique_id: 'model.pkg_a.m3' },
      { unique_id: 'model.pkg_a.m4' },
    ];
    const orderB = [
      { unique_id: 'model.pkg_a.m3' },
      { unique_id: 'model.pkg_z.m1' },
      { unique_id: 'model.pkg_a.m4' },
      { unique_id: 'model.pkg_z.m2' },
    ];
    expect(inferDominantPackageFromNodeExecutions(orderA, stubLookupGraph)).toBe('pkg_a');
    expect(inferDominantPackageFromNodeExecutions(orderB, stubLookupGraph)).toBe('pkg_a');
  });
});

describe('buildTimelineProjectName', () => {
  it('when metadata project has no executions, falls back to lexicographic tie-break among packages', () => {
    const manifestJson = {
      metadata: { project_name: 'only_in_metadata' },
    };
    const executions = [
      { unique_id: 'model.pkg_z.m1' },
      { unique_id: 'model.pkg_z.m2' },
      { unique_id: 'model.pkg_a.m3' },
      { unique_id: 'model.pkg_a.m4' },
    ];
    expect(buildTimelineProjectName(manifestJson, executions, stubLookupGraph)).toBe('pkg_a');
  });
});
