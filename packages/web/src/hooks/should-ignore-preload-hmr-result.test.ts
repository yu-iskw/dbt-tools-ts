import { describe, expect, it } from 'vitest';

import { shouldIgnorePreloadHmrResult } from './use-dbt-artifacts-reload';

describe('shouldIgnorePreloadHmrResult', () => {
  it('ignores results while a managed load is in flight without superseding preload', () => {
    expect(shouldIgnorePreloadHmrResult(false, true, 2, 2)).toBe(true);
  });

  it('allows results when preload HMR is still active', () => {
    expect(shouldIgnorePreloadHmrResult(false, false, 1, 1)).toBe(false);
  });

  it('ignores results after preload was superseded by a committed managed load', () => {
    expect(shouldIgnorePreloadHmrResult(true, false, 3, 3)).toBe(true);
  });

  it('ignores results when load generation changed since the HMR event', () => {
    expect(shouldIgnorePreloadHmrResult(false, false, 2, 1)).toBe(true);
  });
});
