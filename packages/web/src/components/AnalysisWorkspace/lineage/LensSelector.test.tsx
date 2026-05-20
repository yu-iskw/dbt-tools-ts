// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LensSelector } from './LensSelector';

describe('LensSelector', () => {
  let root: Root;
  let container: HTMLDivElement;

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('invokes setLensMode when a lens pill is clicked', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const setLensMode = vi.fn();

    act(() => {
      root.render(<LensSelector lensMode="type" setLensMode={setLensMode} />);
    });

    const status = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Status'),
    ) as HTMLButtonElement;

    act(() => {
      status.click();
    });

    expect(setLensMode).toHaveBeenCalledWith('status');
  });
});
