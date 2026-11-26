import { describe, expect, it } from 'vitest';

// ?raw needs the web vitest config's css.include for these two files (otherwise vitest blanks CSS).
import lineageCss from './lineage-graph.css?raw';
import tokensCss from './tokens.css?raw';

/**
 * Contrast pairs checked in both themes (WCAG 2.x ratio). Token names omit the leading `--`.
 * To cover a new lineage surface, add a row here and bind it in USES below.
 */
const PAIRS: Array<{ label: string; fg: string; bg: string; min: number }> = [
  { label: 'dialog title on header', fg: 'text-primary', bg: 'bg-elevated', min: 4.5 },
  { label: 'dialog subtitle on header', fg: 'text-secondary', bg: 'bg-elevated', min: 4.5 },
  {
    label: 'eyebrow and LENS/GROUP BY labels on header',
    fg: 'text-tertiary',
    bg: 'bg-elevated',
    min: 4.5,
  },
  { label: 'close glyph on close button', fg: 'text-primary', bg: 'bg-elevated', min: 4.5 },
  { label: 'close glyph on close hover', fg: 'text-primary', bg: 'graph-panel-hover', min: 4.5 },
  { label: 'ordinary edge on graph panel', fg: 'graph-edge', bg: 'graph-panel', min: 3 },
  {
    label: 'ordinary edge on accent-soft group',
    fg: 'graph-edge',
    bg: 'bg-accent-soft',
    min: 3,
  },
  { label: 'outer group stroke on canvas', fg: 'graph-group-stroke', bg: 'bg-canvas', min: 3 },
  {
    label: 'inner group stroke on outer fill',
    fg: 'graph-group-stroke',
    bg: 'bg-accent-soft',
    min: 3,
  },
  { label: 'lane dashed stroke on canvas', fg: 'graph-group-stroke', bg: 'bg-canvas', min: 3 },
  { label: 'group label on inner fill', fg: 'graph-text', bg: 'graph-panel', min: 4.5 },
];

/** CSS bindings: [selector, property, token] that the stylesheet must reference for the pairs above. */
const USES: Array<[selector: string, prop: string, token: string]> = [
  ['.lineage-dialog__header', 'background', 'bg-elevated'],
  ['.lineage-dialog__close', 'background', 'bg-elevated'],
  ['.lineage-dialog__close', 'color', 'text-primary'],
  ['.lineage-dialog__close:hover', 'background', 'graph-panel-hover'],
  ['.lineage-dialog__panel', 'background', 'bg-surface-muted'],
  ['.dependency-graph__edge', 'stroke', 'graph-edge'],
  ['.lineage-group--outer', 'fill', 'bg-accent-soft'],
  ['.lineage-group--outer', 'stroke', 'graph-group-stroke'],
  ['.lineage-group--inner', 'fill', 'graph-panel'],
  ['.lineage-group--inner', 'stroke', 'graph-group-stroke'],
  ['.lineage-group--lane', 'stroke', 'graph-group-stroke'],
  ['.lineage-group__label', 'fill', 'graph-text'],
];

const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');

function declarations(body: string): Map<string, string> {
  return new Map([...body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

/** Token map for one theme: dark overrides :root, and var() aliases resolve against that merged map. */
function tokenResolver(theme: 'dark' | 'light'): (name: string) => string {
  const css = stripComments(tokensCss);
  const root = declarations(/^:root\s*\{([\s\S]*?)^\}/m.exec(css)?.[1] ?? '');
  const dark = declarations(/^\[data-theme='dark'\]\s*\{([\s\S]*?)^\}/m.exec(css)?.[1] ?? '');
  const merged = theme === 'dark' ? new Map([...root, ...dark]) : root;
  const resolve = (name: string): string => {
    const raw = merged.get(name);
    if (raw === undefined) throw new Error(`--${name} is not defined in ${theme} theme`);
    const ref = /^var\(--([\w-]+)\)$/.exec(raw);
    if (ref) return resolve(ref[1]);
    if (!/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(raw))
      throw new Error(`--${name} is not a hex colour: ${raw}`);
    return raw;
  };
  return resolve;
}

function luminance(hex: string): number {
  const h = hex.slice(1);
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function ruleBodies(css: string): Array<{ selectors: string[]; body: string }> {
  return [...stripComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selectors: m[1].split(',').map((s) => s.trim()),
    body: m[2],
  }));
}

function declarationValues(selector: string, prop: string): string {
  return ruleBodies(lineageCss)
    .filter((r) => r.selectors.includes(selector))
    .flatMap((r) => r.body.split(';'))
    .map((decl) => decl.split(':'))
    .filter(([name]) => name?.trim() === prop)
    .map(([, ...value]) => value.join(':').trim())
    .join(' ');
}

describe.each(['light', 'dark'] as const)('lineage contrast in %s theme', (theme) => {
  const token = tokenResolver(theme);
  it.each(PAIRS)('$label >= $min:1', ({ fg, bg, min }) => {
    expect(contrast(token(fg), token(bg)), `--${fg} on --${bg}`).toBeGreaterThanOrEqual(min);
  });
});

describe('lineage CSS binds the tested tokens', () => {
  it.each(USES)('%s { %s } uses var(--%s)', (selector, prop, tokenName) => {
    expect(declarationValues(selector, prop)).toContain(`var(--${tokenName})`);
  });

  it('dialog header, close and panel rules have no hard-coded white', () => {
    const dialogRule = /^\.lineage-dialog__(header|close|panel)/;
    const offenders = ruleBodies(lineageCss)
      .filter((r) => r.selectors.some((s) => dialogRule.test(s)) && /rgb\(255|white/i.test(r.body))
      .map((r) => r.selectors.join(', '));
    expect(offenders).toEqual([]);
  });
});
