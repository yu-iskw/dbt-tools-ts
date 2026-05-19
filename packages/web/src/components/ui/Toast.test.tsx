// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider, useToast } from './Toast';

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

function Consumer({ onReady }: { onReady: (t: ReturnType<typeof useToast>) => void }) {
  const ctx = useToast();
  onReady(ctx);
  return null;
}

beforeEach(() => {
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
  document.body.replaceChildren();
});

describe('ToastProvider and useToast', () => {
  it('shows a toast and removes it after the dismiss delay', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    let api: ReturnType<typeof useToast> | null = null;

    act(() => {
      root.render(
        <ToastProvider>
          <Consumer onReady={(t) => (api = t)} />
        </ToastProvider>,
      );
    });

    expect(api).not.toBeNull();
    act(() => {
      api!.toast('Saved', 'positive');
    });

    expect(container.querySelector('.toast-portal')).toBeTruthy();
    expect(container.textContent).toContain('Saved');

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(container.querySelector('.toast-portal')).toBeNull();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('dismisses when the dismiss button is clicked', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    let api: ReturnType<typeof useToast> | null = null;

    act(() => {
      root.render(
        <ToastProvider>
          <Consumer onReady={(t) => (api = t)} />
        </ToastProvider>,
      );
    });

    act(() => {
      api!.toast('Hey');
    });

    const btn = container.querySelector('button.toast__dismiss') as HTMLButtonElement;
    expect(btn).toBeTruthy();

    act(() => {
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.querySelector('.toast-portal')).toBeNull();

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
