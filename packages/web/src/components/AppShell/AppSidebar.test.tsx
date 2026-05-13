// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppSidebar } from './AppSidebar';

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

function renderSidebar({
  sidebarCollapsed = false,
  activeView = 'health',
  onNavigate = vi.fn<() => void>(),
  setNavigationTarget = vi.fn<(target: { view: string }) => void>(),
}: {
  sidebarCollapsed?: boolean;
  activeView?: 'health' | 'settings';
  onNavigate?: () => void;
  setNavigationTarget?: (target: { view: string }) => void;
} = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const setSidebarCollapsed = vi.fn();

  act(() => {
    root.render(
      <AppSidebar
        activeView={activeView}
        setNavigationTarget={setNavigationTarget}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        onNavigate={onNavigate}
        analysis={null}
        analysisSource={null}
      />,
    );
  });

  return {
    container,
    root,
    onNavigate,
    setNavigationTarget,
    setSidebarCollapsed,
  };
}

function cleanupRoot(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

beforeEach(() => {
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
  document.body.innerHTML = '';
});

describe('AppSidebar branding', () => {
  it('renders the shared SVG logo instead of the old text badge', () => {
    const { container, root } = renderSidebar();
    const brandLink = container.querySelector('.app-sidebar__brand-link');
    const logo = brandLink?.querySelector('img');

    expect(brandLink).not.toBeNull();
    expect(logo?.getAttribute('src')).toContain('image/svg+xml');
    expect(container.querySelector('.brand-mark')).toBeNull();

    cleanupRoot(root, container);
  });

  it('keeps the health navigation action on the brand button', () => {
    const { container, root, onNavigate, setNavigationTarget } = renderSidebar();
    const brandButton = container.querySelector('.app-sidebar__brand-link') as HTMLButtonElement;

    act(() => {
      brandButton.click();
    });

    expect(setNavigationTarget).toHaveBeenCalledWith({ view: 'health' });
    expect(onNavigate).toHaveBeenCalled();

    cleanupRoot(root, container);
  });

  it('renders a settings affordance in the expanded footer', () => {
    const { container, root } = renderSidebar();
    const settingsButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.getAttribute('title') === 'Settings',
    );

    expect(settingsButton).not.toBeUndefined();
    expect(settingsButton?.textContent).toContain('Settings');

    cleanupRoot(root, container);
  });

  it('keeps the settings affordance accessible when collapsed', () => {
    const { container, root } = renderSidebar({ sidebarCollapsed: true });
    const settingsButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.getAttribute('title') === 'Settings',
    );

    expect(settingsButton).not.toBeUndefined();
    expect(settingsButton?.querySelector('.sidebar-link__body')).toBeNull();

    cleanupRoot(root, container);
  });

  it('routes to the settings view from the footer icon', () => {
    const { container, root, setNavigationTarget, onNavigate } = renderSidebar();
    const settingsButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.getAttribute('title') === 'Settings',
    );

    act(() => {
      settingsButton?.click();
    });

    expect(setNavigationTarget).toHaveBeenCalledWith({ view: 'settings' });
    expect(onNavigate).toHaveBeenCalled();

    cleanupRoot(root, container);
  });

  it('highlights the footer icon when settings is active', () => {
    const { container, root } = renderSidebar({ activeView: 'settings' });
    const settingsButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.getAttribute('title') === 'Settings',
    );

    expect(settingsButton?.className).toContain('sidebar-link--active');

    cleanupRoot(root, container);
  });
});
