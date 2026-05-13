// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import type { NodeExecutionSemantics } from '@web/types';
import { MaterializationSemanticsBadge } from './MaterializationSemanticsBadge';

afterEach(() => {
  document.body.replaceChildren();
});

function makeSemantics(overrides: Partial<NodeExecutionSemantics> = {}): NodeExecutionSemantics {
  return {
    resourceType: 'model',
    materialization: 'table',
    persisted: true,
    createsRelation: true,
    compiledIntoParent: false,
    materializationSource: 'manifest',
    ...overrides,
  };
}

describe('MaterializationSemanticsBadge', () => {
  it('renders short label and title with semantics copy', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<MaterializationSemanticsBadge semantics={makeSemantics()} />);
    });
    const el = container.querySelector('.materialization-semantics-badge');
    expect(el?.textContent).toMatch(/table/i);
    expect((el as HTMLElement).title.toLowerCase()).toMatch(/table/);
    expect((el as HTMLElement).title.toLowerCase()).toMatch(/manifest/);
    root.unmount();
    container.remove();
  });

  it('renders nothing for unknown materialization on non-model resource types', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <MaterializationSemanticsBadge
          semantics={makeSemantics({
            resourceType: 'semantic_model',
            materialization: 'unknown',
            persisted: false,
            createsRelation: false,
            materializationSource: 'derived',
          })}
        />,
      );
    });
    expect(container.querySelector('.materialization-semantics-badge')).toBeNull();
    root.unmount();
    container.remove();
  });

  it('shows raw fragment for unknown custom materializations', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <MaterializationSemanticsBadge
          semantics={makeSemantics({
            materialization: 'unknown',
            rawMaterialization: 'iceberg_table',
          })}
        />,
      );
    });
    const el = container.querySelector('.materialization-semantics-badge');
    expect(el?.textContent).toMatch(/iceberg/);
    root.unmount();
    container.remove();
  });
});
