import { describe, it, expect } from 'vitest';

import { greet } from './index';

describe('greet', () => {
  it('should return a greeting message', () => {
    expect(greet('World')).toBe('Hello, World!');
  });
});
