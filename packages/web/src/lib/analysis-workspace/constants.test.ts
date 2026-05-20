import { describe, it, expect } from 'vitest';

import { getStatusTonePalette } from '@web/lib/analysis-workspace/constants';

describe('getStatusTonePalette', () => {
  it('returns distinct semantic colors for light theme', () => {
    const p = getStatusTonePalette('light');
    expect(p.positive).toBe('#0F8A4B');
    expect(p.danger).toBe('#C0352B');
    expect(p.warning).toBe('#A56315');
    expect(p.neutral).toBe('#64748B');
    expect(p.skipped).toBe('#635BFF');
  });

  it('returns distinct semantic colors for dark theme', () => {
    const p = getStatusTonePalette('dark');
    expect(p.positive).toBe('#59D38C');
    expect(p.danger).toBe('#FF8D86');
    expect(p.warning).toBe('#F5B95C');
    expect(p.neutral).toBe('#8690AA');
    expect(p.skipped).toBe('#8A7CFF');
  });
});
