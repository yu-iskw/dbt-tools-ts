// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Spinner } from './Spinner';

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

beforeEach(() => {
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
  document.body.replaceChildren();
});

describe('Spinner', () => {
  it('renders decorative spinner without label', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<Spinner size={32} />);
    });
    const svg = container.querySelector('svg.spinner');
    expect(svg?.getAttribute('width')).toBe('32');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('sets accessible attributes when label is provided', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<Spinner label="Loading" />);
    });
    const svg = container.querySelector('svg.spinner');
    expect(svg?.getAttribute('aria-label')).toBe('Loading');
    expect(svg?.getAttribute('role')).toBe('img');
    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
