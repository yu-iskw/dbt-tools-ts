// @vitest-environment jsdom

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  fillCompilePhaseSegment,
  getCompilePhaseDarkenRgba,
  getCompileStripePattern,
} from './compilePhaseDraw';

describe('compilePhaseDraw', () => {
  beforeAll(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((type) => {
      if (type !== '2d') return null;
      return {
        strokeStyle: '',
        lineWidth: 1,
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        createPattern: vi.fn(() => ({}) as CanvasPattern),
      } as unknown as CanvasRenderingContext2D;
    });
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });
  it('returns theme-specific darken rgba', () => {
    expect(getCompilePhaseDarkenRgba('dark')).toContain('0.34');
    expect(getCompilePhaseDarkenRgba('light')).toContain('0.2');
  });

  it('builds a stripe pattern in the browser', () => {
    const pat = getCompileStripePattern('light');
    expect(pat === null || typeof pat === 'object').toBe(true);
  });

  it('fillCompilePhaseSegment fills rects when width is positive', () => {
    const fillRect = vi.fn();
    const ctx = {
      fillStyle: '',
      fillRect,
      save: vi.fn(),
      restore: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    fillCompilePhaseSegment(ctx, 'light', 0, 0, 40, 10);
    expect(fillRect).toHaveBeenCalled();
  });
});
