import { describe, expect, it } from 'vitest';
import { ROW_H } from './constants';
import { findBundleAtOffset } from './hitTest';

describe('hitTest findBundleAtOffset', () => {
  it('returns -1 for empty layout', () => {
    expect(findBundleAtOffset([], [], 0)).toBe(-1);
  });

  it('finds the bundle row containing contentY', () => {
    const rowOffsets = [0, ROW_H, ROW_H * 2];
    const rowHeights = [ROW_H, ROW_H, ROW_H];
    expect(findBundleAtOffset(rowOffsets, rowHeights, ROW_H * 1.5)).toBe(1);
  });
});
