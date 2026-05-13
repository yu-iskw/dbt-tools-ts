import { useEffect, useState } from 'react';
import type { ThemePreference } from '@web/lib/analysis-workspace/types';

export type Theme = 'light' | 'dark';

const DATA_THEME_ATTR = 'data-theme';
const THEME_DARK = 'dark' as const;
const THEME_LIGHT = 'light' as const;
const THEME_SYSTEM = 'system' as const;

function resolveThemePreference(preference: ThemePreference): Theme {
  if (preference === THEME_DARK) return THEME_DARK;
  if (preference === THEME_LIGHT) return THEME_LIGHT;
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? THEME_DARK : THEME_LIGHT;
  } catch {
    return THEME_LIGHT;
  }
}

/** Read the current app theme from the document root (for tests and non-React callers). */
export function readDocumentTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  const v = document.documentElement.getAttribute(DATA_THEME_ATTR);
  return v === THEME_DARK ? THEME_DARK : 'light';
}

/** Subscribe to `data-theme` changes on `document.documentElement`. */
export function subscribeDocumentTheme(onChange: (theme: Theme) => void): () => void {
  onChange(readDocumentTheme());
  const observer = new MutationObserver(() => onChange(readDocumentTheme()));
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [DATA_THEME_ATTR],
  });
  return () => observer.disconnect();
}

/**
 * Follows `data-theme` on `document.documentElement` (including updates from
 * {@link useTheme} elsewhere). Use in deep children that need theme-aware
 * colors without duplicating theme state.
 */
export function useSyncedDocumentTheme(): Theme {
  const [theme, setTheme] = useState<Theme>(() => readDocumentTheme());

  useEffect(() => {
    setTheme(readDocumentTheme());
    return subscribeDocumentTheme(setTheme);
  }, []);

  return theme;
}

export function useTheme() {
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => {
    try {
      const stored = window.localStorage.getItem('dbt-tools.theme');
      if (stored === THEME_LIGHT || stored === THEME_DARK || stored === THEME_SYSTEM) {
        return stored as ThemePreference;
      }
    } catch {
      // ignore
    }
    return THEME_SYSTEM;
  });
  const [theme, setTheme] = useState<Theme>(() => resolveThemePreference(themePreference));

  useEffect(() => {
    setTheme(resolveThemePreference(themePreference));
    try {
      window.localStorage.setItem('dbt-tools.theme', themePreference);
    } catch {
      // ignore
    }
  }, [themePreference]);

  useEffect(() => {
    document.documentElement.setAttribute(DATA_THEME_ATTR, theme);
  }, [theme]);

  const toggleTheme = () =>
    setThemePreference((prev) => {
      if (prev === THEME_LIGHT) return THEME_DARK;
      if (prev === THEME_DARK) return THEME_LIGHT;
      return THEME_DARK;
    });

  return { theme, themePreference, setThemePreference, toggleTheme };
}
