// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { AssetSummarySection } from './AssetSummarySection';

import type { ResourceNode } from '@web/types';

function makeResource(overrides: Partial<ResourceNode> = {}): ResourceNode {
  return {
    uniqueId: 'source.jaffle_shop.ecom.raw_customers',
    name: 'raw_customers',
    resourceType: 'source',
    packageName: 'jaffle_shop',
    path: 'models/staging/__sources.yml',
    originalFilePath: 'models/staging/__sources.yml',
    description: 'Raw customers source',
    status: null,
    statusTone: 'neutral',
    executionTime: null,
    threadId: null,
    ...overrides,
  };
}

describe('AssetSummarySection', () => {
  let root: Root;
  let container: HTMLDivElement;

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders catalog and source freshness enrichment when present', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root.render(
        <AssetSummarySection
          resource={makeResource({
            catalogStats: {
              columnCount: 3,
              tableType: 'table',
              bytes: 128,
              rowCount: 42,
            },
            sourceFreshness: {
              status: 'Warn',
              statusTone: 'warning',
              maxLoadedAt: '2026-01-01T00:00:00.000Z',
              snapshottedAt: '2026-01-01T01:00:00.000Z',
              ageSeconds: 3600,
              criteria: {
                warnAfter: '12 hour',
                errorAfter: '24 hour',
                filter: null,
              },
              error: null,
            },
          })}
        />,
      );
    });

    expect(container.textContent).toContain('Catalog columns');
    expect(container.textContent).toContain('3');
    expect(container.textContent).toContain('Source freshness');
    expect(container.textContent).toContain('Warn');
    expect(container.textContent).toContain('12 hour');
  });

  it('shows the run error message in the This run section', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const message =
      'Runtime Error in model orders\n  Binder Error: Referenced column "order_total" not found in FROM clause!';

    act(() => {
      root.render(
        <AssetSummarySection
          resource={makeResource({
            status: 'Error',
            statusTone: 'danger',
            runResultMessage: message,
          })}
        />,
      );
    });

    expect(container.querySelector('.run-result-message__body')?.textContent).toBe(message);
  });

  it('falls back to the execution row message and renders none when absent', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root.render(
        <AssetSummarySection
          resource={makeResource()}
          executionRow={{
            uniqueId: 'x',
            name: 'x',
            resourceType: 'model',
            packageName: 'p',
            path: null,
            status: 'Error',
            statusTone: 'danger',
            executionTime: 1,
            threadId: null,
            start: null,
            end: null,
            runResultMessage: 'boom',
          }}
        />,
      );
    });
    expect(container.querySelector('.run-result-message__body')?.textContent).toBe('boom');

    act(() => {
      root.render(<AssetSummarySection resource={makeResource()} />);
    });
    expect(container.querySelector('.run-result-message')).toBeNull();
  });
});
