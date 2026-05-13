// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { estimateBadgeWidth, positionOverlay } from './lineageOverlayConstants';

describe('lineageOverlayConstants', () => {
  it('estimateBadgeWidth scales with label length', () => {
    expect(estimateBadgeWidth('')).toBeGreaterThan(0);
    expect(estimateBadgeWidth('abc')).toBeGreaterThan(estimateBadgeWidth('a'));
  });

  it('positionOverlay clamps within the viewport', () => {
    vi.stubGlobal('innerWidth', 800);
    vi.stubGlobal('innerHeight', 600);
    const pos = positionOverlay({
      anchorX: 100,
      anchorY: 100,
      width: 200,
      height: 150,
    });
    expect(pos.x).toBeGreaterThanOrEqual(12);
    expect(pos.y).toBeGreaterThanOrEqual(12);
    vi.unstubAllGlobals();
  });
});
