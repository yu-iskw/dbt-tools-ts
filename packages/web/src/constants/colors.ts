import { getObjectProperty } from '@dbt-tools/core/browser';
import {
  type ThemeMode,
  STATUS_HEX_DARK,
  STATUS_HEX_LIGHT,
  getResourceTypeHexMap,
  getThemeHex,
} from '@web/constants/theme-colors';

/** Execution status → bar fill color (light theme; use {@link getStatusColor} with theme in canvas). */
export const STATUS_COLORS: Record<string, string> = { ...STATUS_HEX_LIGHT };

export function getStatusColor(status: string, theme: ThemeMode = 'light'): string {
  const map = theme === 'dark' ? STATUS_HEX_DARK : STATUS_HEX_LIGHT;
  const key = status.toLowerCase();
  const fromMap = getObjectProperty(map as Record<string, unknown>, key);
  return typeof fromMap === 'string' ? fromMap : getThemeHex(theme).textSoft;
}

export function getResourceTypeColor(
  resourceType: string | undefined,
  theme: ThemeMode = 'light',
): string {
  const map = getResourceTypeHexMap(theme);
  if (resourceType) {
    const color = getObjectProperty(map as Record<string, unknown>, resourceType);
    if (typeof color === 'string') return color;
  }
  return getThemeHex(theme).borderSubtle;
}
