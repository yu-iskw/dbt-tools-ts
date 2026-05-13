import { useEffect, useState } from 'react';
import type {
  AssetExplorerMode,
  LensMode,
  ThemePreference,
  TimelineDependencyDirection,
} from '@web/lib/analysis-workspace/types';

const WORKSPACE_PREFERENCES_KEY = 'dbt-tools.workspacePreferences';

export interface WorkspacePreferences {
  theme: ThemePreference;
  sidebarCollapsedDefault: boolean;
  timelineDefaults: {
    showTests: boolean;
    failuresOnly: boolean;
    dependencyDirection: TimelineDependencyDirection;
    dependencyDepthHops: number;
  };
  inventoryDefaults: {
    explorerMode: AssetExplorerMode;
    lineageLensMode: LensMode;
    lineageUpstreamDepth: number;
    lineageDownstreamDepth: number;
    allDepsMode: boolean;
  };
}

const DEFAULT_PREFERENCES: WorkspacePreferences = {
  theme: 'system',
  sidebarCollapsedDefault: true,
  timelineDefaults: {
    showTests: false,
    failuresOnly: false,
    dependencyDirection: 'both',
    dependencyDepthHops: 2,
  },
  inventoryDefaults: {
    explorerMode: 'project',
    lineageLensMode: 'type',
    lineageUpstreamDepth: 2,
    lineageDownstreamDepth: 2,
    allDepsMode: false,
  },
};

function clampDepth(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(10, Math.round(value)));
}

function isDependencyDirection(value: unknown): value is TimelineDependencyDirection {
  return value === 'upstream' || value === 'both' || value === 'downstream';
}

function isExplorerMode(value: unknown): value is AssetExplorerMode {
  return value === 'project' || value === 'database';
}

function isLensMode(value: unknown): value is LensMode {
  return value === 'status' || value === 'type' || value === 'coverage';
}

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

function parseStoredPreferences(raw: string | null): WorkspacePreferences {
  if (!raw) return DEFAULT_PREFERENCES;
  try {
    const parsed = JSON.parse(raw) as Partial<WorkspacePreferences>;
    return {
      theme: isThemePreference(parsed.theme) ? parsed.theme : DEFAULT_PREFERENCES.theme,
      sidebarCollapsedDefault:
        typeof parsed.sidebarCollapsedDefault === 'boolean'
          ? parsed.sidebarCollapsedDefault
          : DEFAULT_PREFERENCES.sidebarCollapsedDefault,
      timelineDefaults: {
        showTests:
          typeof parsed.timelineDefaults?.showTests === 'boolean'
            ? parsed.timelineDefaults.showTests
            : DEFAULT_PREFERENCES.timelineDefaults.showTests,
        failuresOnly:
          typeof parsed.timelineDefaults?.failuresOnly === 'boolean'
            ? parsed.timelineDefaults.failuresOnly
            : DEFAULT_PREFERENCES.timelineDefaults.failuresOnly,
        dependencyDirection: isDependencyDirection(parsed.timelineDefaults?.dependencyDirection)
          ? parsed.timelineDefaults.dependencyDirection
          : DEFAULT_PREFERENCES.timelineDefaults.dependencyDirection,
        dependencyDepthHops: clampDepth(
          parsed.timelineDefaults?.dependencyDepthHops,
          DEFAULT_PREFERENCES.timelineDefaults.dependencyDepthHops,
        ),
      },
      inventoryDefaults: {
        explorerMode: isExplorerMode(parsed.inventoryDefaults?.explorerMode)
          ? parsed.inventoryDefaults.explorerMode
          : DEFAULT_PREFERENCES.inventoryDefaults.explorerMode,
        lineageLensMode: isLensMode(parsed.inventoryDefaults?.lineageLensMode)
          ? parsed.inventoryDefaults.lineageLensMode
          : DEFAULT_PREFERENCES.inventoryDefaults.lineageLensMode,
        lineageUpstreamDepth: clampDepth(
          parsed.inventoryDefaults?.lineageUpstreamDepth,
          DEFAULT_PREFERENCES.inventoryDefaults.lineageUpstreamDepth,
        ),
        lineageDownstreamDepth: clampDepth(
          parsed.inventoryDefaults?.lineageDownstreamDepth,
          DEFAULT_PREFERENCES.inventoryDefaults.lineageDownstreamDepth,
        ),
        allDepsMode:
          typeof parsed.inventoryDefaults?.allDepsMode === 'boolean'
            ? parsed.inventoryDefaults.allDepsMode
            : DEFAULT_PREFERENCES.inventoryDefaults.allDepsMode,
      },
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function useWorkspacePreferences() {
  const [preferences, setPreferences] = useState<WorkspacePreferences>(() => {
    try {
      return parseStoredPreferences(window.localStorage.getItem(WORKSPACE_PREFERENCES_KEY));
    } catch {
      return DEFAULT_PREFERENCES;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(WORKSPACE_PREFERENCES_KEY, JSON.stringify(preferences));
    } catch {
      // ignore
    }
  }, [preferences]);

  return { preferences, setPreferences };
}
