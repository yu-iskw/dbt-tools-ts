import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildInitialLineageViewState,
  getActiveNavigationItem,
  getInitialAssetTab,
  getInitialSidebarCollapsed,
  getInitialView,
  isNavigationTargetActive,
  navigationItems,
  parseAssetTab,
  parseLineageAllDepsMode,
  parseLineageDownstreamDepth,
  parseLineageLensMode,
  parseLineageUpstreamDepth,
  parseRunsKind,
  parseShowAdapterMetrics,
  parseSelectedExecutionId,
  parseSelectedResourceId,
  parseViewFromSearch,
  resolveView,
  viewParamImpliesInventoryLineageTab,
} from './app-navigation';

describe('viewParamImpliesInventoryLineageTab', () => {
  it('is true for lineage and dependencies view params', () => {
    expect(viewParamImpliesInventoryLineageTab('?view=lineage')).toBe(true);
    expect(viewParamImpliesInventoryLineageTab('?view=dependencies')).toBe(true);
  });

  it('is false otherwise', () => {
    expect(viewParamImpliesInventoryLineageTab('')).toBe(false);
    expect(viewParamImpliesInventoryLineageTab('?view=inventory')).toBe(false);
  });
});

describe('resolveView', () => {
  it('maps legacy names to current views', () => {
    expect(resolveView('overview')).toBe('health');
    expect(resolveView('catalog')).toBe('inventory');
    expect(resolveView('execution')).toBe('runs');
    expect(resolveView('quality')).toBe('runs');
    expect(resolveView('dependencies')).toBe('inventory');
    expect(resolveView('lineage')).toBe('inventory');
    expect(resolveView('search')).toBe('inventory');
  });

  it('passes through primary views', () => {
    expect(resolveView('discover')).toBe('inventory');
    expect(resolveView('health')).toBe('health');
    expect(resolveView('inventory')).toBe('inventory');
    expect(resolveView('runs')).toBe('runs');
    expect(resolveView('timeline')).toBe('timeline');
    expect(resolveView('settings')).toBe('settings');
  });

  it('defaults unknown values to health', () => {
    expect(resolveView('nope')).toBe('health');
  });
});

describe('parseViewFromSearch', () => {
  it('returns null when view is absent', () => {
    expect(parseViewFromSearch('')).toBeNull();
  });

  it('maps runs+timeline tab to timeline', () => {
    expect(parseViewFromSearch('?view=runs&tab=timeline')).toBe('timeline');
  });

  it('maps lineage and dependencies to inventory', () => {
    expect(parseViewFromSearch('?view=lineage')).toBe('inventory');
    expect(parseViewFromSearch('?view=dependencies')).toBe('inventory');
  });

  it('returns null for invalid view values', () => {
    expect(parseViewFromSearch('?view=not-a-view')).toBeNull();
  });

  it('accepts settings as a first-class destination', () => {
    expect(parseViewFromSearch('?view=settings')).toBe('settings');
  });

  it('maps legacy discover view to inventory', () => {
    expect(parseViewFromSearch('?view=discover')).toBe('inventory');
    expect(parseViewFromSearch('?view=discover&q=orders')).toBe('inventory');
  });
});

describe('parseSelectedResourceId / parseSelectedExecutionId', () => {
  it('reads resource and selected params', () => {
    expect(parseSelectedResourceId('?resource=m1')).toBe('m1');
    expect(parseSelectedExecutionId('?selected=exec-1')).toBe('exec-1');
  });
});

describe('parseAssetTab', () => {
  it('accepts known tabs', () => {
    expect(parseAssetTab('?assetTab=lineage')).toBe('lineage');
    expect(parseAssetTab('?assetTab=summary')).toBe('summary');
  });

  it('returns null for unknown', () => {
    expect(parseAssetTab('?assetTab=other')).toBeNull();
  });
});

describe('getInitialAssetTab', () => {
  it('prefers explicit assetTab', () => {
    expect(getInitialAssetTab('?view=lineage&assetTab=sql')).toBe('sql');
  });

  it('uses lineage tab when view implies lineage', () => {
    expect(getInitialAssetTab('?view=lineage')).toBe('lineage');
  });

  it('defaults to summary', () => {
    expect(getInitialAssetTab('?view=inventory')).toBe('summary');
  });
});

describe('parseRunsKind', () => {
  it('parses known kinds', () => {
    expect(parseRunsKind('?kind=models')).toBe('models');
  });

  it('returns null for unknown', () => {
    expect(parseRunsKind('?kind=widgets')).toBeNull();
  });
});

describe('parseShowAdapterMetrics', () => {
  it('defaults true when adapter is absent or empty', () => {
    expect(parseShowAdapterMetrics('')).toBe(true);
    expect(parseShowAdapterMetrics('?view=runs')).toBe(true);
    expect(parseShowAdapterMetrics('?adapter=')).toBe(true);
  });

  it('is false for 0, false, and no', () => {
    expect(parseShowAdapterMetrics('?adapter=0')).toBe(false);
    expect(parseShowAdapterMetrics('?adapter=false')).toBe(false);
    expect(parseShowAdapterMetrics('?adapter=no')).toBe(false);
    expect(parseShowAdapterMetrics('?adapter=FALSE')).toBe(false);
  });

  it('is true for explicit show tokens and other values', () => {
    expect(parseShowAdapterMetrics('?adapter=1')).toBe(true);
    expect(parseShowAdapterMetrics('?adapter=true')).toBe(true);
    expect(parseShowAdapterMetrics('?adapter=yes')).toBe(true);
    expect(parseShowAdapterMetrics('?adapter=anything')).toBe(true);
  });
});

describe('lineage URL parsers', () => {
  it('parses lens', () => {
    expect(parseLineageLensMode('?lens=status')).toBe('status');
    expect(parseLineageLensMode('?lens=bad')).toBeNull();
  });

  it('parses depths', () => {
    expect(parseLineageUpstreamDepth('?up=3')).toBe(3);
    expect(parseLineageDownstreamDepth('?down=4')).toBe(4);
    expect(parseLineageUpstreamDepth('?up=nan')).toBeNull();
  });

  it('parses allDeps', () => {
    expect(parseLineageAllDepsMode('?allDeps=1')).toBe(true);
    expect(parseLineageAllDepsMode('?allDeps=0')).toBe(false);
    expect(parseLineageAllDepsMode('')).toBeNull();
  });
});

describe('buildInitialLineageViewState', () => {
  it('clamps depths and applies defaults', () => {
    const s = buildInitialLineageViewState('?resource=r1&up=99&down=-1&allDeps=1&lens=coverage');
    expect(s.rootResourceId).toBe('r1');
    expect(s.selectedResourceId).toBe('r1');
    expect(s.upstreamDepth).toBe(10);
    expect(s.downstreamDepth).toBe(0);
    expect(s.allDepsMode).toBe(true);
    expect(s.lensMode).toBe('coverage');
    expect(s.activeLegendKeys).toEqual(new Set());
  });

  it('uses selected as graph focus when lineage tab is active', () => {
    const s = buildInitialLineageViewState('?resource=root&assetTab=lineage&selected=node-a');
    expect(s.selectedResourceId).toBe('node-a');
  });

  it('uses selected when view=lineage', () => {
    const s = buildInitialLineageViewState('?view=lineage&resource=root&selected=node-b');
    expect(s.selectedResourceId).toBe('node-b');
  });
});

describe('sidebar navigation helpers', () => {
  it('does not expose a standalone lineage nav item', () => {
    expect(navigationItems.map((i) => i.id)).not.toContain('lineage');
  });

  it('places health first, then timeline, inventory, and runs', () => {
    expect(navigationItems.map((i) => i.id)).toEqual(['health', 'timeline', 'inventory', 'runs']);
  });

  it('resolves active item for inventory', () => {
    const inv = navigationItems.find((i) => i.id === 'inventory')!;
    expect(isNavigationTargetActive(inv, 'inventory')).toBe(true);
    expect(isNavigationTargetActive(inv, 'health')).toBe(false);
    expect(getActiveNavigationItem('inventory').id).toBe('inventory');
  });
});

describe('window-backed initializers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getInitialView reads location.search', () => {
    vi.stubGlobal('window', {
      location: { search: '?view=inventory' },
    });
    expect(getInitialView()).toBe('inventory');
  });

  it('getInitialSidebarCollapsed reads localStorage', () => {
    const getItem = vi.fn().mockReturnValue('false');
    vi.stubGlobal('window', {
      localStorage: { getItem },
    });
    expect(getInitialSidebarCollapsed()).toBe(false);
    expect(getItem).toHaveBeenCalled();
  });

  it('getInitialSidebarCollapsed defaults when localStorage throws', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('blocked');
        },
      },
    });
    expect(getInitialSidebarCollapsed()).toBe(true);
  });
});
