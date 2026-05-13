// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppLogo } from './AppLogo';

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

function renderLogo(ui: React.ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(ui);
  });

  return { container, root };
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

describe('AppLogo', () => {
  it('renders as a decorative image by default', () => {
    const { container, root } = renderLogo(<AppLogo className="app-logo app-logo--brand" />);
    const logo = container.querySelector('img');

    expect(logo?.getAttribute('src')).toContain('image/svg+xml');
    expect(logo?.getAttribute('alt')).toBe('');
    expect(logo?.getAttribute('aria-hidden')).toBe('true');

    cleanupRoot(root, container);
  });

  it('uses accessible alternative text when a title is provided', () => {
    const { container, root } = renderLogo(<AppLogo title="dbt-tools logo" />);
    const logo = container.querySelector('img');

    expect(logo?.getAttribute('alt')).toBe('dbt-tools logo');
    expect(logo?.hasAttribute('aria-hidden')).toBe(false);

    cleanupRoot(root, container);
  });
});
