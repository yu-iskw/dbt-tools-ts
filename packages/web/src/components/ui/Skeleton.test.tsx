// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Skeleton } from './Skeleton';

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

describe('Skeleton', () => {
  it('merges skeleton class with optional className and style', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<Skeleton className="wide" style={{ width: 120, height: 8 }} />);
    });
    const el = container.querySelector('div');
    expect(el?.className).toBe('skeleton wide');
    expect(el?.getAttribute('aria-hidden')).toBe('true');
    expect((el as HTMLElement).style.width).toBe('120px');
    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
