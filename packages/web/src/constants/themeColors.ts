/**
 * Hex mirrors of design tokens in `index.css` for canvas, SVG, and TS
 * consumers that cannot use CSS `var()`.
 * Keep in sync with `:root` and `[data-theme="dark"]` in index.css.
 */

export type ThemeMode = 'light' | 'dark';

export const THEME_HEX_LIGHT = {
  accent: '#635BFF',
  text: '#171C28',
  textSoft: '#6B7385',
  bg: '#F6F7FB',
  bgSoft: '#FFFFFF',
  borderDefault: '#D7DCE7',
  borderSubtle: '#E6E9F0',
  slate: '#64748B',
  rose: '#C0352B',
  mint: '#0F8A4B',
  amber: '#A56315',
} as const;

export const THEME_HEX_DARK = {
  accent: '#8A7CFF',
  text: '#F3F6FC',
  textSoft: '#98A3BC',
  bg: '#0D1120',
  bgSoft: '#151A2E',
  borderDefault: '#313A58',
  borderSubtle: '#262E47',
  slate: '#8690AA',
  rose: '#FF8D86',
  mint: '#59D38C',
  amber: '#F5B95C',
} as const;

export function getThemeHex(theme: ThemeMode) {
  return theme === 'dark' ? THEME_HEX_DARK : THEME_HEX_LIGHT;
}

/** Execution status keys — align with `STATUS_HEX` / status tokens in index.css */
export const STATUS_HEX_LIGHT = {
  success: THEME_HEX_LIGHT.mint,
  error: THEME_HEX_LIGHT.rose,
  skipped: THEME_HEX_LIGHT.slate,
  'run error': THEME_HEX_LIGHT.rose,
  pass: THEME_HEX_LIGHT.mint,
  fail: THEME_HEX_LIGHT.rose,
  warn: THEME_HEX_LIGHT.amber,
  'no op': THEME_HEX_LIGHT.slate,
} as const;

export const STATUS_HEX_DARK = {
  success: THEME_HEX_DARK.mint,
  error: THEME_HEX_DARK.rose,
  skipped: THEME_HEX_DARK.slate,
  'run error': THEME_HEX_DARK.rose,
  pass: THEME_HEX_DARK.mint,
  fail: THEME_HEX_DARK.rose,
  warn: THEME_HEX_DARK.amber,
  'no op': THEME_HEX_DARK.slate,
} as const;

const HEX_SOURCE_LIGHT = '#059669';
const HEX_SOURCE_DARK = '#45c49a';
const SOFT_TEST_LIGHT = 'rgba(100, 116, 139, 0.14)';
const SOFT_TEST_DARK = 'rgba(134, 144, 170, 0.2)';
const SOFT_SOURCE_LIGHT = 'rgba(5, 150, 105, 0.14)';
const SOFT_SOURCE_DARK = 'rgba(69, 196, 154, 0.2)';

export const RESOURCE_TYPE_HEX_LIGHT: Record<string, string> = {
  model: '#1D4ED8',
  test: '#64748B',
  seed: '#635BFF',
  snapshot: '#D97706',
  source: HEX_SOURCE_LIGHT,
  source_freshness: HEX_SOURCE_LIGHT,
  exposure: '#EA580C',
  metric: '#DB2777',
  semantic_model: '#0891B2',
  analysis: '#64748B',
  unit_test: '#64748B',
};

export const RESOURCE_TYPE_HEX_DARK: Record<string, string> = {
  model: '#5c8deb',
  test: '#8690aa',
  seed: '#9588e8',
  snapshot: '#d4a24a',
  source: HEX_SOURCE_DARK,
  source_freshness: HEX_SOURCE_DARK,
  exposure: '#d9845c',
  metric: '#d172ae',
  semantic_model: '#3eb0c8',
  analysis: '#8690aa',
  unit_test: '#8690aa',
};

/**
 * Soft fills for canvas — mirror `tokens.css` `--dbt-type-*-soft` (light / dark).
 * Keep rgba values in sync when graph tokens change.
 */
export const RESOURCE_TYPE_SOFT_FILL_LIGHT: Record<string, string> = {
  model: 'rgba(29, 78, 216, 0.14)',
  test: SOFT_TEST_LIGHT,
  seed: 'rgba(99, 91, 255, 0.14)',
  snapshot: 'rgba(217, 119, 6, 0.14)',
  source: SOFT_SOURCE_LIGHT,
  source_freshness: SOFT_SOURCE_LIGHT,
  semantic_model: 'rgba(8, 145, 178, 0.14)',
  metric: 'rgba(219, 39, 119, 0.14)',
  exposure: 'rgba(234, 88, 12, 0.14)',
  analysis: SOFT_TEST_LIGHT,
  unit_test: SOFT_TEST_LIGHT,
};

export const RESOURCE_TYPE_SOFT_FILL_DARK: Record<string, string> = {
  model: 'rgba(92, 141, 235, 0.22)',
  test: SOFT_TEST_DARK,
  seed: 'rgba(149, 136, 232, 0.22)',
  snapshot: 'rgba(212, 162, 74, 0.22)',
  source: SOFT_SOURCE_DARK,
  source_freshness: SOFT_SOURCE_DARK,
  semantic_model: 'rgba(62, 176, 200, 0.22)',
  metric: 'rgba(209, 114, 174, 0.22)',
  exposure: 'rgba(217, 132, 92, 0.22)',
  analysis: SOFT_TEST_DARK,
  unit_test: SOFT_TEST_DARK,
};

export function getResourceTypeHexMap(theme: ThemeMode): Record<string, string> {
  return theme === 'dark' ? RESOURCE_TYPE_HEX_DARK : RESOURCE_TYPE_HEX_LIGHT;
}

export function getResourceTypeSoftFillMap(theme: ThemeMode): Record<string, string> {
  return theme === 'dark' ? RESOURCE_TYPE_SOFT_FILL_DARK : RESOURCE_TYPE_SOFT_FILL_LIGHT;
}

export function getResourceTypeSoftFill(
  resourceType: string | undefined,
  theme: ThemeMode,
): string {
  const map = getResourceTypeSoftFillMap(theme);
  if (resourceType && map[resourceType]) return map[resourceType]!;
  return theme === 'dark' ? SOFT_TEST_DARK : SOFT_TEST_LIGHT;
}

export const CANVAS_LIGHT = {
  rowStripe: '#F1F3F8',
  rowStripeHover: '#EEF0FF',
  labelText: THEME_HEX_LIGHT.text,
  metaText: THEME_HEX_LIGHT.textSoft,
  axisTick: THEME_HEX_LIGHT.slate,
  gridLine: '#E6E9F0',
  barHoverStroke: THEME_HEX_LIGHT.accent,
  testFailStripe: 'rgba(192, 53, 43, 0.9)',
  /** Skipped/no-op bundle fill in the minimap — amber. */
  testSkipStripe: 'rgba(165, 99, 21, 0.88)',
  /** Bundle hull stroke — light neutral border. */
  hullStroke: '#C8CEDB',
  /** Bundle hull fill — near-transparent background. */
  hullFill: 'rgba(230, 233, 240, 0.35)',
} as const;

export const CANVAS_DARK = {
  rowStripe: '#101527',
  rowStripeHover: '#232845',
  labelText: THEME_HEX_DARK.text,
  metaText: THEME_HEX_DARK.textSoft,
  axisTick: THEME_HEX_DARK.slate,
  gridLine: '#262E47',
  barHoverStroke: THEME_HEX_DARK.accent,
  testFailStripe: 'rgba(255, 141, 134, 0.88)',
  /** Skipped/no-op bundle fill in the minimap — amber. */
  testSkipStripe: 'rgba(245, 185, 92, 0.88)',
  /** Bundle hull stroke — dark neutral border. */
  hullStroke: '#2E3759',
  /** Bundle hull fill — near-transparent background. */
  hullFill: 'rgba(38, 46, 71, 0.4)',
} as const;

export function getCanvasColors(theme: ThemeMode) {
  return theme === 'dark' ? CANVAS_DARK : CANVAS_LIGHT;
}
