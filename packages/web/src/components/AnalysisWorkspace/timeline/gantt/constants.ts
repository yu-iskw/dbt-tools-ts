import type { CSSProperties } from 'react';

export const ROW_H = 44;
export const BAR_H = 14;
export const BAR_PAD = 6;
export const LABEL_W = 160;
/** User preference for timeline name column width (localStorage). */
export const TIMELINE_LABEL_WIDTH_STORAGE_KEY = 'dbt-tools.timelineLabelWidthPx';
export const LABEL_COLUMN_MIN_PX = 120;
export const LABEL_COLUMN_MAX_PX = 560;
/** Minimum chart area width so bars stay usable when resizing the label column. */
export const LABEL_COLUMN_RESERVED_CHART_PX = 200;
/** Minimum horizontal gap between adjacent X-axis tick labels (CSS px). */
export const MIN_TICK_LABEL_GAP_PX = 10;
export const X_PAD = 24;
export const AXIS_TOP = 32;
export const MIN_VIEWPORT_H = 240;
export const VIEWPORT_SCREEN_PADDING = 320;
export const MAX_VIEWPORT_RATIO = 0.78;

// Bundle / test-chip layout
/** Inner vertical padding inside a bundle hull. */
export const BUNDLE_HULL_PAD = 5;
/** Height of each test chip bar. */
export const TEST_BAR_H = 10;
/** Total height per test lane row (chip + inter-lane gap). */
export const TEST_LANE_H = TEST_BAR_H + 4;
/** Minimum rendered width for a test chip (px). */
export const MIN_CHIP_W = 4;

export const TOOLTIP_LABEL_STYLE: CSSProperties = {
  color: 'var(--text-soft)',
  fontSize: '0.82rem',
};

export const TIMELINE_TIMEZONE_STORAGE_KEY = 'dbt-tools.timelineTimezone';

/** Show a hint when the timeline has this many bundle rows (parents). */
export const TIMELINE_BUNDLE_COUNT_WARNING = 20_000;

/** Max direct upstream edges drawn in compact timeline focus mode. */
export const TIMELINE_MAX_UPSTREAM_EDGES = 8;

/** Max direct downstream edges drawn in compact timeline focus mode. */
export const TIMELINE_MAX_DOWNSTREAM_EDGES = 8;

/** Max hop index when collecting extended (multi-hop) timeline focus edges. */
export const TIMELINE_EXTENDED_MAX_HOPS = 3;

/**
 * Max extended edges per direction (upstream vs downstream), separate from
 * one-hop caps. See ADR 0025.
 */
export const TIMELINE_EXTENDED_MAX_EDGES_PER_DIRECTION = 12;

export type DisplayMode = 'duration' | 'timestamps';
