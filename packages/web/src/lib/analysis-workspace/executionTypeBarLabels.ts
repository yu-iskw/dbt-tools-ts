import type { StatusBreakdownItem } from '@web/types';

/** Minimum segment share to show an in-bar percent label (matches prior donut callout threshold). */
export const EXECUTION_TYPE_BAR_LABEL_INSIDE_MIN_SHARE = 0.08;

/** Descending by count for breakdown line order (matches dominant-left bar order). */
export function sortStatusBreakdownByCountDesc(
  entries: readonly StatusBreakdownItem[],
): StatusBreakdownItem[] {
  return [...entries].sort((a, b) => b.count - a.count);
}

const SHARE_EFFECTIVELY_FULL = 1 - 1e-12;
/** Below this share, show "<0.1%" instead of rounding to 0%. */
const SHARE_TINY_THRESHOLD = 0.0005;

export function shouldPlaceExecutionSegmentLabelInsideBar(
  share: number,
  minShare: number = EXECUTION_TYPE_BAR_LABEL_INSIDE_MIN_SHARE,
): boolean {
  return share >= minShare;
}

/**
 * Formats a segment's share of runs within one resource type for display on execution bars.
 * Uses `share` only (e.g. count / baseline type total) so dashboard status filters do not
 * imply 100% just because one status segment is visible. Avoids rounding a dominant slice to
 * "100%" when it is not full (e.g. 6038/6057 → "99.7%").
 */
export function formatExecutionTypeSegmentPercent(share: number): string {
  if (share >= SHARE_EFFECTIVELY_FULL) {
    return '100%';
  }

  const pct = share * 100;
  if (share < SHARE_TINY_THRESHOLD) {
    return '<0.1%';
  }

  const rounded0 = Math.round(pct);
  if (rounded0 === 100) {
    let s = pct.toFixed(1);
    if (Number.parseFloat(s) >= 100) {
      s = pct.toFixed(2);
    }
    return `${s}%`;
  }

  if (rounded0 === 0 && share > 0) {
    return pct < 0.1 ? '<0.1%' : `${pct.toFixed(1)}%`;
  }

  if (Math.abs(pct - rounded0) < 1e-9) {
    return `${rounded0}%`;
  }

  let s = pct.toFixed(1);
  if (Number.parseFloat(s) >= 100 && share < SHARE_EFFECTIVELY_FULL) {
    s = pct.toFixed(2);
  }
  return `${s}%`;
}
