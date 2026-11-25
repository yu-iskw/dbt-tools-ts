import { describe, expect, it } from 'vitest';

import { revealTimelineTarget, type TimelineRevealTarget } from './timeline-reveal';

import type { TimelineFilterState } from './types';
import type { GanttItem } from '@web/types';

const filters: TimelineFilterState = {
  query: '',
  activeStatuses: new Set(),
  activeTypes: new Set(),
  selectedExecutionId: null,
  showTests: false,
  failuresOnly: false,
  dependencyDirection: 'both',
  dependencyDepthHops: 1,
  timeWindow: null,
  neighborhoodRowsShowAll: false,
};

const row: GanttItem = {
  unique_id: 'model.p.orders',
  name: 'orders',
  start: 1000,
  end: 2000,
  duration: 1000,
  status: 'success',
  resourceType: 'model',
  packageName: 'p',
  path: 'models/orders.sql',
  parentId: null,
};

function target(over: Partial<TimelineRevealTarget> = {}): TimelineRevealTarget {
  return {
    isTest: false,
    row,
    isDefaultRow: true,
    defaultActiveTypes: new Set(['model', 'seed']),
    hasFailureSignal: () => false,
    ...over,
  };
}

describe('revealTimelineTarget', () => {
  it('returns the same filters when nothing hides the target', () => {
    expect(revealTimelineTarget(filters, target())).toBe(filters);
  });

  it('turns showTests on for a test target', () => {
    const next = revealTimelineTarget(filters, target({ isTest: true }));
    expect(next.showTests).toBe(true);
  });

  it('leaves showTests alone for a non-test target', () => {
    expect(revealTimelineTarget(filters, target()).showTests).toBe(false);
  });

  it('clears a status filter that excludes the target and keeps one that includes it', () => {
    const excluding = { ...filters, activeStatuses: new Set(['error']) };
    expect(revealTimelineTarget(excluding, target()).activeStatuses.size).toBe(0);
    const including = { ...filters, activeStatuses: new Set(['success']) };
    expect(revealTimelineTarget(including, target())).toBe(including);
  });

  it('clears a type filter that excludes the target and keeps one that includes it', () => {
    const excluding = { ...filters, activeTypes: new Set(['seed']) };
    expect(revealTimelineTarget(excluding, target()).activeTypes.size).toBe(0);
    const including = { ...filters, activeTypes: new Set(['model']) };
    expect(revealTimelineTarget(including, target())).toBe(including);
  });

  it('adds the type on top of the defaults when the default set would hide the target', () => {
    const macroRow = { ...row, resourceType: 'macro' };
    const next = revealTimelineTarget(filters, target({ row: macroRow, isDefaultRow: false }));
    expect([...next.activeTypes].sort()).toEqual(['macro', 'model', 'seed']);
  });

  it('clears a query that does not match the name or unique ID and keeps one that does', () => {
    expect(revealTimelineTarget({ ...filters, query: 'customers' }, target()).query).toBe('');
    const byName = { ...filters, query: 'ORD' };
    expect(revealTimelineTarget(byName, target())).toBe(byName);
    const byId = { ...filters, query: 'model.p.orders' };
    expect(revealTimelineTarget(byId, target())).toBe(byId);
  });

  it('clears failuresOnly only when the target has no failure signal', () => {
    const on = { ...filters, failuresOnly: true };
    expect(revealTimelineTarget(on, target()).failuresOnly).toBe(false);
    const failing = target({ hasFailureSignal: () => true });
    expect(revealTimelineTarget(on, failing)).toBe(on);
  });

  it('clears a zoom window that does not overlap the target', () => {
    const away = { ...filters, timeWindow: { start: 5000, end: 6000 } };
    expect(revealTimelineTarget(away, target()).timeWindow).toBeNull();
    const around = { ...filters, timeWindow: { start: 1500, end: 6000 } };
    expect(revealTimelineTarget(around, target())).toBe(around);
  });

  it('judges a test by its parent bundle row', () => {
    const parent = { ...row, status: 'error' };
    const next = revealTimelineTarget(
      { ...filters, activeStatuses: new Set(['success']) },
      target({ isTest: true, row: parent }),
    );
    expect(next.showTests).toBe(true);
    expect(next.activeStatuses.size).toBe(0);
  });

  it('only turns showTests on for a test without a parent row', () => {
    const next = revealTimelineTarget(
      { ...filters, query: 'x' },
      target({ isTest: true, row: null }),
    );
    expect(next.showTests).toBe(true);
    expect(next.query).toBe('x');
  });
});
