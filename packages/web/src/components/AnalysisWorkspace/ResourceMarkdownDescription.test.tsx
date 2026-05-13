// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResourceMarkdownDescription } from './ResourceMarkdownDescription';

describe('ResourceMarkdownDescription', () => {
  let container: HTMLElement;
  let root: Root;
  const originalResizeObserver = globalThis.ResizeObserver;

  afterEach(() => {
    if (root && container.parentNode) {
      act(() => {
        root.unmount();
      });
      container.remove();
    }
    globalThis.ResizeObserver = originalResizeObserver;
    vi.restoreAllMocks();
  });

  it('renders GFM heading and paragraph', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver;

    act(() => {
      root.render(<ResourceMarkdownDescription markdown="## Overview\n\nHello **world**." />);
    });

    const h2 = container.querySelector('h2');
    expect(h2?.textContent).toContain('Overview');
    expect(container.textContent).toContain('Hello');
    expect(container.textContent).toContain('world');
  });

  it('renders fenced code and table', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver;

    const md = ['| a | b |', '| - | - |', '| 1 | 2 |', '', '```sql', 'select 1', '```'].join('\n');

    act(() => {
      root.render(<ResourceMarkdownDescription markdown={md} />);
    });

    expect(container.querySelector('table')).toBeTruthy();
    expect(container.querySelector('pre code')?.textContent).toContain('select 1');
  });

  it('opens https links in a new tab with rel noopener', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver;

    act(() => {
      root.render(<ResourceMarkdownDescription markdown="[docs](https://example.com/x)" />);
    });

    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://example.com/x');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toContain('noopener');
  });

  describe('expand and collapse', () => {
    const roCallbacks: Array<() => void> = [];

    beforeEach(() => {
      roCallbacks.length = 0;
      globalThis.ResizeObserver = class MockResizeObserver implements ResizeObserver {
        private readonly cb: ResizeObserverCallback;
        constructor(cb: ResizeObserverCallback) {
          this.cb = cb;
        }
        observe(): void {
          roCallbacks.push(() => {
            this.cb([], this);
          });
        }
        unobserve(): void {}
        disconnect(): void {}
      };
    });

    it('shows expand when collapsed viewport overflows then collapse when expanded', () => {
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);

      act(() => {
        root.render(
          <ResourceMarkdownDescription
            markdown={`# Title\n\n${'Long line of text.\n\n'.repeat(40)}`}
          />,
        );
      });

      const viewport = container.querySelector(
        '.resource-description-md__viewport',
      ) as HTMLDivElement | null;
      expect(viewport).toBeTruthy();
      Object.defineProperty(viewport!, 'clientHeight', {
        configurable: true,
        value: 48,
      });
      Object.defineProperty(viewport!, 'scrollHeight', {
        configurable: true,
        value: 400,
      });

      act(() => {
        for (const fn of roCallbacks) fn();
      });

      const expand = [...container.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('Expand description'),
      );
      expect(expand).toBeTruthy();

      act(() => {
        expand!.click();
      });

      const collapse = [...container.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('Collapse description'),
      );
      expect(collapse).toBeTruthy();

      act(() => {
        collapse!.click();
      });

      expect(
        [...container.querySelectorAll('button')].some((b) =>
          b.textContent?.includes('Expand description'),
        ),
      ).toBe(true);
    });
  });
});
