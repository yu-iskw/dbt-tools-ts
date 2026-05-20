import type { ThemeMode } from '@web/constants/theme-colors';

/** Solid darken pass before stripe pattern (matches canvas timeline compile band). */
export function getCompilePhaseDarkenRgba(theme: ThemeMode): string {
  return theme === 'dark' ? 'rgba(0, 0, 0, 0.34)' : 'rgba(0, 0, 0, 0.2)';
}

const compileStripePatternCache = new Map<ThemeMode, CanvasPattern | null>();

function createDiagonalStripePattern(theme: ThemeMode): CanvasPattern | null {
  if (typeof document === 'undefined') return null;
  const el = document.createElement('canvas');
  const n = 8;
  el.width = n;
  el.height = n;
  const pctx = el.getContext('2d');
  if (!pctx) return null;
  pctx.strokeStyle = theme === 'dark' ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.22)';
  pctx.lineWidth = 1;
  pctx.beginPath();
  pctx.moveTo(0, n);
  pctx.lineTo(n, 0);
  pctx.stroke();
  pctx.beginPath();
  pctx.moveTo(-4, 4);
  pctx.lineTo(4, -4);
  pctx.stroke();
  pctx.beginPath();
  pctx.moveTo(4, n + 4);
  pctx.lineTo(n + 4, 4);
  pctx.stroke();
  return pctx.createPattern(el, 'repeat');
}

/** Cached repeating pattern for compile phase (browser only). */
export function getCompileStripePattern(theme: ThemeMode): CanvasPattern | null {
  if (compileStripePatternCache.has(theme)) {
    return compileStripePatternCache.get(theme) ?? null;
  }
  const pattern = createDiagonalStripePattern(theme);
  compileStripePatternCache.set(theme, pattern);
  return pattern;
}

/**
 * Draw compile-phase shading: uniform darken then diagonal stripes (theme-neutral hue).
 */
export function fillCompilePhaseSegment(
  ctx: CanvasRenderingContext2D,
  theme: ThemeMode,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  if (w <= 0.5) return;
  ctx.fillStyle = getCompilePhaseDarkenRgba(theme);
  ctx.fillRect(x, y, w, h);
  const pat = getCompileStripePattern(theme);
  if (pat) {
    ctx.save();
    ctx.fillStyle = pat;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }
}
