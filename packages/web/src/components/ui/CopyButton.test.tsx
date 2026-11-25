// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CopyButton } from './CopyButton';
import { ToastProvider } from './Toast';

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

function renderButton() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <ToastProvider>
        <CopyButton value="model.shop.orders" label="unique ID" />
      </ToastProvider>,
    );
  });
  return container;
}

async function clickCopy(container: HTMLElement) {
  await act(async () => {
    container.querySelector('button')!.click();
  });
}

beforeEach(() => {
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe('CopyButton', () => {
  it('copies the value and confirms with a toast', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const container = renderButton();

    expect(container.querySelector('button')?.getAttribute('aria-label')).toBe('Copy unique ID');
    await clickCopy(container);

    expect(writeText).toHaveBeenCalledWith('model.shop.orders');
    expect(container.querySelector('.toast--positive')?.textContent).toContain('Copied unique ID');
  });

  it('shows a failure toast when the clipboard rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const container = renderButton();

    await clickCopy(container);

    expect(container.querySelector('.toast--danger')?.textContent).toContain(
      'Could not copy unique ID',
    );
  });

  it('shows a failure toast when the clipboard API is missing', async () => {
    vi.stubGlobal('navigator', {});
    const container = renderButton();

    await clickCopy(container);

    expect(container.querySelector('.toast--danger')?.textContent).toContain(
      'Could not copy unique ID',
    );
  });
});
