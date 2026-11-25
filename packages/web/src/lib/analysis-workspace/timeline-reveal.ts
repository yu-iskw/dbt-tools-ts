import { TEST_RESOURCE_TYPES } from './constants';
import { buildResourceTestStats } from './explorer-tree';
import {
  deriveProjectName,
  getDefaultTimelineActiveTypes,
  isDefaultTimelineResource,
  isPositiveStatus,
} from './utils';

import type { TimelineFilterState } from './types';
import type { AnalysisState, GanttItem } from '@web/types';

/** Whether the Timeline's text search keeps `item`. Matches name and unique ID. */
export function matchesTimelineQuery(item: GanttItem, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return (
    item.name.toLowerCase().includes(normalized) ||
    item.unique_id.toLowerCase().includes(normalized)
  );
}

/** Whether the "failures only" filter keeps this bundle row. */
export function parentHasFailureSignal(
  item: GanttItem,
  childTests: GanttItem[],
  testStatsById: ReturnType<typeof buildResourceTestStats>,
): boolean {
  const stats = testStatsById.get(item.unique_id);
  const hasTestFail = stats
    ? stats.error + stats.warn > 0
    : childTests.some((t) => !isPositiveStatus(t.status));
  return !isPositiveStatus(item.status) || hasTestFail;
}

/** Types the Timeline shows when the user has not picked any. */
export function getTimelineDefaultActiveTypes(
  ganttData: readonly GanttItem[],
  projectName: string | null,
): Set<string> {
  const presentTypes = Array.from(
    new Set(
      ganttData
        .filter((item) => isDefaultTimelineResource(item, projectName))
        .map((item) => item.resourceType)
        .filter((type): type is string => Boolean(type)),
    ),
  ).sort();
  return getDefaultTimelineActiveTypes(presentTypes);
}

export interface TimelineRevealTarget {
  isTest: boolean;
  /**
   * The bundle row the Timeline filters act on: the node itself, or the parent
   * of a test (tests render inside their parent's bundle). Null for a test with no parent row.
   */
  row: GanttItem | null;
  /** True when the row is in the default Timeline set (project package, primary type). */
  isDefaultRow: boolean;
  defaultActiveTypes: ReadonlySet<string>;
  /** Evaluated only when "failures only" is on. */
  hasFailureSignal: () => boolean;
}

function clearHiddenStatuses(filters: TimelineFilterState, row: GanttItem): TimelineFilterState {
  return filters.activeStatuses.size > 0 && !filters.activeStatuses.has(row.status.toLowerCase())
    ? { ...filters, activeStatuses: new Set() }
    : filters;
}

function clearHiddenTypes(
  filters: TimelineFilterState,
  target: TimelineRevealTarget,
  row: GanttItem,
): TimelineFilterState {
  const shownByDefault = target.isDefaultRow && target.defaultActiveTypes.has(row.resourceType);
  const hidden =
    filters.activeTypes.size > 0 ? !filters.activeTypes.has(row.resourceType) : !shownByDefault;
  if (!hidden) return filters;
  return {
    ...filters,
    // Defaults already show this row; otherwise add its type on top of the defaults.
    activeTypes: shownByDefault
      ? new Set()
      : new Set([...target.defaultActiveTypes, row.resourceType]),
  };
}

function clearHiddenZoom(filters: TimelineFilterState, row: GanttItem): TimelineFilterState {
  const zoomWindow = filters.timeWindow;
  return zoomWindow != null && (row.end < zoomWindow.start || row.start > zoomWindow.end)
    ? { ...filters, timeWindow: null }
    : filters;
}

/**
 * Loosen only the Timeline filters that would hide `target`, so a handoff lands on the
 * node it was asked to show. Returns `filters` itself when nothing hides the target.
 * Mirrors how TimelineView filters bundle rows.
 */
export function revealTimelineTarget(
  filters: TimelineFilterState,
  target: TimelineRevealTarget,
): TimelineFilterState {
  let next = target.isTest && !filters.showTests ? { ...filters, showTests: true } : filters;
  const { row } = target;
  if (!row) return next;

  next = clearHiddenStatuses(next, row);
  next = clearHiddenTypes(next, target, row);
  if (!matchesTimelineQuery(row, next.query)) next = { ...next, query: '' };
  if (next.failuresOnly && !target.hasFailureSignal()) next = { ...next, failuresOnly: false };
  return clearHiddenZoom(next, row);
}

/** Finds the Timeline row for `executionId` and the facts `revealTimelineTarget` needs. */
export function resolveTimelineRevealTarget(
  analysis: AnalysisState,
  executionId: string,
): TimelineRevealTarget | null {
  const item = analysis.ganttData.find((entry) => entry.unique_id === executionId);
  if (!item) return null;
  const isTest = TEST_RESOURCE_TYPES.has(item.resourceType);
  const row = isTest
    ? (analysis.ganttData.find((entry) => entry.unique_id === item.parentId) ?? null)
    : item;
  const projectName = analysis.projectName ?? deriveProjectName(analysis.executions);
  return {
    isTest,
    row,
    isDefaultRow: row != null && isDefaultTimelineResource(row, projectName),
    defaultActiveTypes: getTimelineDefaultActiveTypes(analysis.ganttData, projectName),
    hasFailureSignal: () => {
      if (!row) return true;
      const childTests = analysis.ganttData.filter(
        (entry) => entry.parentId === row.unique_id && TEST_RESOURCE_TYPES.has(entry.resourceType),
      );
      return parentHasFailureSignal(
        row,
        childTests,
        buildResourceTestStats(analysis.resources, analysis.dependencyIndex),
      );
    },
  };
}
