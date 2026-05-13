// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MaterializationKind } from '@web/types';
import { MaterializationKindPillRow } from './MaterializationKindPillRow';

afterEach(() => {
  document.body.replaceChildren();
});

describe('MaterializationKindPillRow', () => {
  it('marks all pills active when activeKinds is empty', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const kinds: MaterializationKind[] = ['table', 'view'];
    act(() => {
      root.render(
        <MaterializationKindPillRow
          kinds={kinds}
          activeKinds={new Set()}
          onToggleKind={vi.fn()}
          buttonTitle="test title"
        />,
      );
    });
    const buttons = container.querySelectorAll('button');
    expect(buttons).toHaveLength(2);
    for (const btn of buttons) {
      expect(btn.className).toContain('workspace-pill--active');
    }
  });

  it('calls onToggleKind with the clicked kind', () => {
    const onToggleKind = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <MaterializationKindPillRow
          kinds={['incremental']}
          activeKinds={new Set<MaterializationKind>(['incremental'])}
          onToggleKind={onToggleKind}
          buttonTitle="t"
        />,
      );
    });
    const btn = container.querySelector('button');
    expect(btn).toBeTruthy();
    act(() => {
      btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onToggleKind).toHaveBeenCalledWith('incremental');
  });
});
