// @vitest-environment jsdom

import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HeaderSearch } from './app-workspace-chrome-internals';

import type { OmniboxResultsSnapshot } from '@web/hooks/use-omnibox-results';
import type { UseWorkspaceUrlStateResult } from '@web/hooks/use-workspace-url-state';
import type { SearchState } from '@web/lib/analysis-workspace/types';
import type { AnalysisState, ResourceNode } from '@web/types';

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

type HandleNavigateTo = UseWorkspaceUrlStateResult['handleNavigateTo'];

const results = [
  { uniqueId: 'model.shop.orders', name: 'orders', resourceType: 'model' },
  { uniqueId: 'model.shop.customers', name: 'customers', resourceType: 'model' },
  { uniqueId: 'source.shop.raw', name: 'raw', resourceType: 'source' },
] as unknown as ResourceNode[];

const omniboxResults: OmniboxResultsSnapshot = { results, loading: false };

function Harness({ handleNavigateTo }: { handleNavigateTo: HandleNavigateTo }) {
  const [searchState, setSearchState] = useState<SearchState>({
    query: 'o',
    recentResourceIds: [],
    isOpen: false,
  });
  return (
    <>
      <input data-testid="other-input" />
      <HeaderSearch
        analysis={{ resources: [] } as unknown as AnalysisState}
        searchState={searchState}
        setSearchState={setSearchState}
        omniboxResults={omniboxResults}
        handleNavigateTo={handleNavigateTo}
      />
    </>
  );
}

let container: HTMLDivElement;
let root: Root;
let handleNavigateTo: ReturnType<typeof vi.fn<HandleNavigateTo>>;

function mount() {
  act(() => {
    root.render(<Harness handleNavigateTo={handleNavigateTo} />);
  });
}

function pressKey(target: EventTarget, init: KeyboardEventInit) {
  act(() => {
    target.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }),
    );
  });
}

const searchInput = () =>
  container.querySelector<HTMLInputElement>('input[aria-label="Global search"]')!;

beforeEach(() => {
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  handleNavigateTo = vi.fn<HandleNavigateTo>();
  mount();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
});

describe('HeaderSearch keyboard behavior', () => {
  it('focuses and opens the search on Cmd+K and Ctrl+K', () => {
    pressKey(window, { key: 'k', metaKey: true });
    expect(document.activeElement).toBe(searchInput());
    expect(container.querySelector('[role="listbox"]')).not.toBeNull();

    act(() => searchInput().blur());
    pressKey(window, { key: 'k', ctrlKey: true });
    expect(document.activeElement).toBe(searchInput());
  });

  it('focuses the search on "/" unless the user is typing in another field', () => {
    pressKey(document.body, { key: '/' });
    expect(document.activeElement).toBe(searchInput());

    act(() => searchInput().blur());
    const other = container.querySelector<HTMLInputElement>('[data-testid="other-input"]')!;
    act(() => other.focus());
    pressKey(other, { key: '/' });
    expect(document.activeElement).toBe(other);
  });

  it('selects the second result with ArrowDown then Enter', () => {
    pressKey(window, { key: 'k', metaKey: true });
    pressKey(searchInput(), { key: 'ArrowDown' });
    const options = container.querySelectorAll('[role="option"]');
    expect(options[1]?.getAttribute('aria-selected')).toBe('true');
    expect(searchInput().getAttribute('aria-activedescendant')).toBe(options[1]?.id);

    pressKey(searchInput(), { key: 'Enter' });
    expect(handleNavigateTo).toHaveBeenCalledWith('inventory', {
      resourceId: 'model.shop.customers',
      assetTab: 'summary',
    });
    expect(container.querySelector('[role="listbox"]')).toBeNull();
  });

  it('wraps from the first result to the last with ArrowUp', () => {
    pressKey(window, { key: 'k', metaKey: true });
    pressKey(searchInput(), { key: 'ArrowUp' });
    pressKey(searchInput(), { key: 'Enter' });
    expect(handleNavigateTo).toHaveBeenCalledWith('inventory', {
      resourceId: 'source.shop.raw',
      assetTab: 'summary',
    });
  });

  it('closes the listbox and blurs on Escape', () => {
    pressKey(window, { key: 'k', metaKey: true });
    expect(container.querySelector('[role="listbox"]')).not.toBeNull();
    pressKey(searchInput(), { key: 'Escape' });
    expect(container.querySelector('[role="listbox"]')).toBeNull();
    expect(document.activeElement).not.toBe(searchInput());
  });

  it('closes the listbox when the input loses focus', () => {
    act(() => searchInput().focus());
    expect(container.querySelector('[role="listbox"]')).not.toBeNull();
    act(() => searchInput().blur());
    expect(container.querySelector('[role="listbox"]')).toBeNull();
  });

  it('exposes combobox semantics', () => {
    act(() => searchInput().focus());
    const input = searchInput();
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
    expect(input.getAttribute('aria-controls')).toBe(
      container.querySelector('[role="listbox"]')?.id,
    );
    expect(input.getAttribute('placeholder')).toBe('Search models, sources, tests…');
  });
});
