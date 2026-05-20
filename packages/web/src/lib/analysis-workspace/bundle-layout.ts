import { TEST_RESOURCE_TYPES } from './constants';

import type { GanttItem } from '@web/types';

/** A test item assigned to a vertical lane within its parent bundle. */
export interface TestLane {
  item: GanttItem;
  /** 0-indexed vertical lane within the bundle (for stacking concurrent tests). */
  lane: number;
}

/**
 * A bundle groups a primary parent resource (model / seed / source / snapshot)
 * with all test nodes that have it as their parentId.
 */
export interface BundleRow {
  /** The primary parent resource. */
  item: GanttItem;
  /** All test items associated with this bundle. */
  tests: GanttItem[];
  /** Tests with lane assignments (populated from assignLanes). */
  lanes: TestLane[];
  /** Number of vertical lanes needed when expanded. 0 when no tests. */
  laneCount: number;
}

/**
 * Groups a flat array of GanttItems (parents + tests) into BundleRows.
 *
 * Parent items are non-test resources; test items have a non-null parentId.
 * Tests without a matching parent in the array are dropped (they would be
 * orphaned — their parent was filtered out).
 *
 * Result is sorted ascending by parent start time.
 */
export function groupIntoBundles(items: GanttItem[]): BundleRow[] {
  const parents: GanttItem[] = [];
  const testsByParent = new Map<string, GanttItem[]>();

  for (const item of items) {
    if (TEST_RESOURCE_TYPES.has(item.resourceType)) {
      if (item.parentId != null) {
        const existing = testsByParent.get(item.parentId) ?? [];
        existing.push(item);
        testsByParent.set(item.parentId, existing);
      }
      // Tests with no parentId are omitted (would render as orphaned chips)
    } else {
      parents.push(item);
    }
  }

  // Sort parents by start time ascending; break ties by duration descending
  parents.sort((a, b) => {
    const startDiff = a.start - b.start;
    if (startDiff !== 0) return startDiff;
    return b.duration - a.duration;
  });

  return parents.map((parent) => {
    const tests = testsByParent.get(parent.unique_id) ?? [];
    const { lanes, laneCount } = assignLanes(tests);
    return { item: parent, tests, lanes, laneCount };
  });
}

/**
 * Assigns each test to a vertical lane using a greedy interval-scheduling
 * algorithm (earliest-start first). Tests that do not overlap share a lane;
 * concurrent tests are placed in separate lanes.
 */
function assignLanes(tests: GanttItem[]): {
  lanes: TestLane[];
  laneCount: number;
} {
  if (tests.length === 0) return { lanes: [], laneCount: 0 };

  const sorted = [...tests].sort((a, b) => a.start - b.start);
  const laneTails: number[] = []; // end-time of the last item placed in each lane
  const lanes: TestLane[] = [];

  for (const test of sorted) {
    let assignedLane = -1;
    for (let l = 0; l < laneTails.length; l++) {
      if ((laneTails.at(l) ?? 0) <= test.start) {
        assignedLane = l;
        laneTails.splice(l, 1, test.end);
        break;
      }
    }
    if (assignedLane === -1) {
      assignedLane = laneTails.length;
      laneTails.push(test.end);
    }
    lanes.push({ item: test, lane: assignedLane });
  }

  return { lanes, laneCount: laneTails.length };
}
