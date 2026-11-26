// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GroupBySelector } from './GroupBySelector';

describe('GroupBySelector', () => {
  let root: Root;
  let container: HTMLDivElement;

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('invokes setGroupBy with warehouse when the Warehouse pill is clicked', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const setGroupBy = vi.fn();

    act(() => {
      root.render(<GroupBySelector groupBy="none" setGroupBy={setGroupBy} />);
    });

    const warehouse = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Warehouse'),
    ) as HTMLButtonElement;

    act(() => {
      warehouse.click();
    });

    expect(setGroupBy).toHaveBeenCalledWith('warehouse');
  });

  it('invokes setGroupBy with none when the None pill is clicked', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const setGroupBy = vi.fn();

    act(() => {
      root.render(<GroupBySelector groupBy="warehouse" setGroupBy={setGroupBy} />);
    });

    const none = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('None'),
    ) as HTMLButtonElement;

    act(() => {
      none.click();
    });

    expect(setGroupBy).toHaveBeenCalledWith('none');
  });

  it('renders a Group by label', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root.render(<GroupBySelector groupBy="none" setGroupBy={vi.fn()} />);
    });

    expect(container.textContent).toContain('Group by');
  });
});
