import { describe, it, expect } from 'vitest';

import { getResourceTypeColor, getStatusColor } from '@web/constants/colors';

describe('getStatusColor', () => {
  it('resolves known statuses in light theme', () => {
    expect(getStatusColor('pass', 'light')).toBe('#0F8A4B');
    expect(getStatusColor('fail', 'light')).toBe('#C0352B');
  });

  it('resolves known statuses in dark theme', () => {
    expect(getStatusColor('pass', 'dark')).toBe('#59D38C');
    expect(getStatusColor('fail', 'dark')).toBe('#FF8D86');
  });

  it('falls back to theme textSoft for unknown status', () => {
    expect(getStatusColor('unknown-status-xyz', 'light')).toBe('#6B7385');
    expect(getStatusColor('unknown-status-xyz', 'dark')).toBe('#98A3BC');
  });
});

describe('getResourceTypeColor', () => {
  it('returns mapped color for known types', () => {
    expect(getResourceTypeColor('model', 'light')).toBe('#1D4ED8');
    expect(getResourceTypeColor('model', 'dark')).toBe('#5c8deb');
  });

  it('returns borderSubtle fallback when type missing', () => {
    expect(getResourceTypeColor(undefined, 'light')).toBe('#E6E9F0');
    expect(getResourceTypeColor(undefined, 'dark')).toBe('#262E47');
  });
});
