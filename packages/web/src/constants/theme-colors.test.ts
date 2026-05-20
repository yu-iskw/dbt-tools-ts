import { getCanvasColors, getResourceTypeHexMap, getThemeHex } from '@web/constants/theme-colors';
import { describe, it, expect } from 'vitest';

describe('getThemeHex', () => {
  it('returns light palette for light', () => {
    expect(getThemeHex('light').accent).toBe('#635BFF');
    expect(getThemeHex('light').bg).toBe('#F6F7FB');
  });

  it('returns dark palette for dark', () => {
    expect(getThemeHex('dark').accent).toBe('#8A7CFF');
    expect(getThemeHex('dark').bg).toBe('#0D1120');
  });
});

describe('getCanvasColors', () => {
  it('returns light canvas tokens for light theme', () => {
    const c = getCanvasColors('light');
    expect(c.gridLine).toBe('#E6E9F0');
    expect(c.labelText).toBe(getThemeHex('light').text);
  });

  it('returns dark canvas tokens for dark theme', () => {
    const c = getCanvasColors('dark');
    expect(c.gridLine).toBe('#262E47');
    expect(c.rowStripe).toBe('#101527');
  });
});

describe('getResourceTypeHexMap', () => {
  it('differs between light and dark for model', () => {
    const light = getResourceTypeHexMap('light').model;
    const dark = getResourceTypeHexMap('dark').model;
    expect(light).toBe('#1D4ED8');
    expect(dark).toBe('#5c8deb');
    expect(light).not.toBe(dark);
  });
});
