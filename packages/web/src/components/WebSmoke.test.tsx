// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { LoadingCard } from './AppShell/LoadingCard';
import { ErrorBanner } from './ErrorBanner';
import { Spinner } from './ui/Spinner';

describe('lightweight UI components', () => {
  let root: Root;
  let container: HTMLDivElement;

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders ErrorBanner with the message', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(<ErrorBanner message="Something failed" />);
    });
    expect(container.textContent).toContain('Something failed');
  });

  it('renders LoadingCard skeleton placeholders', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(<LoadingCard />);
    });
    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
  });

  it('renders Spinner with default and labeled modes', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <>
          <Spinner />
          <Spinner size={16} label="Loading" />
        </>,
      );
    });
    expect(container.querySelectorAll('svg.spinner').length).toBe(2);
  });
});
