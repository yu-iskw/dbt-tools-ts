import { describe, expect, it } from 'vitest';

import { LABEL_COLUMN_MIN_PX } from './constants';
import { clampGanttLabelColumnWidth } from './gantt-label-column-width';

describe('clampGanttLabelColumnWidth', () => {
  it('clamps to min and max derived from container', () => {
    expect(clampGanttLabelColumnWidth(50, 800)).toBe(LABEL_COLUMN_MIN_PX);
    expect(clampGanttLabelColumnWidth(900, 800)).toBe(560);
    expect(clampGanttLabelColumnWidth(900, 800)).toBeLessThanOrEqual(600);
  });

  it('allows width up to max when container is wide', () => {
    expect(clampGanttLabelColumnWidth(400, 1200)).toBe(400);
  });

  it('uses global max when container width is zero', () => {
    expect(clampGanttLabelColumnWidth(400, 0)).toBe(400);
    expect(clampGanttLabelColumnWidth(900, 0)).toBe(560);
  });
});
