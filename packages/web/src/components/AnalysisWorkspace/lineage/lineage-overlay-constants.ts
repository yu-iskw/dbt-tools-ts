export const OVERLAY_VIEWPORT_MARGIN = 12;
export const OVERLAY_CURSOR_OFFSET = 6;
export const TOOLTIP_OVERLAY_SIZE = { width: 248, height: 176 };
export const CONTEXT_MENU_OVERLAY_SIZE = { width: 220, height: 120 };
export const TOOLTIP_NODE_PADDING = { x: 10, y: 8 };

export function estimateBadgeWidth(label: string): number {
  return 16 + label.length * 6.2;
}

export function positionOverlay({
  anchorX,
  anchorY,
  width,
  height,
  offset = OVERLAY_CURSOR_OFFSET,
  margin = OVERLAY_VIEWPORT_MARGIN,
}: {
  anchorX: number;
  anchorY: number;
  width: number;
  height: number;
  offset?: number;
  margin?: number;
}): { x: number; y: number } {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let x = anchorX + offset;
  let y = anchorY + offset;

  if (x + width + margin > viewportWidth) {
    x = anchorX - width - offset;
  }
  if (y + height + margin > viewportHeight) {
    y = anchorY - height - offset;
  }

  x = Math.min(Math.max(margin, x), Math.max(margin, viewportWidth - width - margin));
  y = Math.min(Math.max(margin, y), Math.max(margin, viewportHeight - height - margin));

  return { x, y };
}
