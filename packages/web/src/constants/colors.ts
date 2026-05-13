import {
  type ThemeMode,
  STATUS_HEX_DARK,
  STATUS_HEX_LIGHT,
  getResourceTypeHexMap,
  getThemeHex,
} from '@web/constants/themeColors';

/** Execution status → bar fill color (light theme; use {@link getStatusColor} with theme in canvas). */
export const STATUS_COLORS: Record<string, string> = { ...STATUS_HEX_LIGHT };

export function getStatusColor(status: string, theme: ThemeMode = 'light'): string {
  const map = theme === 'dark' ? STATUS_HEX_DARK : STATUS_HEX_LIGHT;
  const key = status.toLowerCase();
  const fromMap = (map as Record<string, string | undefined>)[key];
  return fromMap ?? getThemeHex(theme).textSoft;
}

export function getResourceTypeColor(
  resourceType: string | undefined,
  theme: ThemeMode = 'light',
): string {
  const map = getResourceTypeHexMap(theme);
  return (resourceType && map[resourceType]) ?? getThemeHex(theme).borderSubtle;
}
