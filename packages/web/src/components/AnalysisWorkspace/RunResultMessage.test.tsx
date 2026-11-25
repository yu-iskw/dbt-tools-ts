// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RunResultMessage } from './RunResultMessage';

import type { StatusTone } from '@web/types';

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

const MESSAGE =
  'Runtime Error in model orders\n  Binder Error: Referenced column "order_total" not found in FROM clause!';

describe('RunResultMessage', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function render(message: string | null | undefined, tone: StatusTone) {
    act(() => {
      root.render(<RunResultMessage message={message} statusTone={tone} />);
    });
  }

  it('shows the full message with an error heading and copy button for danger', () => {
    render(MESSAGE, 'danger');
    expect(container.querySelector('pre')?.textContent).toBe(MESSAGE);
    expect(container.textContent).toContain('Error message');
    expect(container.querySelector('button')?.getAttribute('aria-label')).toBe(
      'Copy error message',
    );
    expect(container.querySelector('.run-result-message--danger')).not.toBeNull();
  });

  it('uses warning copy for warnings and a skip-reason heading for skipped nodes', () => {
    render('Got 3 results, configured to warn if != 0', 'warning');
    expect(container.textContent).toContain('Warning message');
    render('SKIP relation main.customers due to ephemeral model error', 'skipped');
    expect(container.textContent).toContain('Skip reason');
    expect(container.querySelector('pre')?.textContent).toBe(
      'SKIP relation main.customers due to ephemeral model error',
    );
  });

  it('hides routine adapter messages on successful and neutral nodes', () => {
    render('OK', 'positive');
    expect(container.innerHTML).toBe('');
    render('SELECT 5', 'neutral');
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when the message is empty', () => {
    render(null, 'danger');
    expect(container.innerHTML).toBe('');
    render('   ', 'danger');
    expect(container.innerHTML).toBe('');
  });
});
