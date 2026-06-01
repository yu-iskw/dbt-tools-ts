import { describe, expect, it } from 'vitest';

import { captureSessionBinding, isSessionBindingCurrent } from './session-binding';

describe('session-binding', () => {
  it('matches when epoch and scope are unchanged', () => {
    const binding = captureSessionBinding(2, 's3://bucket/prefix');
    expect(isSessionBindingCurrent(binding, 2, 's3://bucket/prefix')).toBe(true);
  });

  it('is stale when epoch or scope changes', () => {
    const binding = captureSessionBinding(2, 's3://bucket/prefix');
    expect(isSessionBindingCurrent(binding, 3, 's3://bucket/prefix')).toBe(false);
    expect(isSessionBindingCurrent(binding, 2, 's3://other/prefix')).toBe(false);
  });
});
