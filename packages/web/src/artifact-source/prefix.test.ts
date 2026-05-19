import { describe, expect, it } from 'vitest';

import { normalizeArtifactPrefix } from './prefix';

describe('normalizeArtifactPrefix', () => {
  it('trims leading and trailing slashes', () => {
    expect(normalizeArtifactPrefix('/a/b/')).toBe('a/b');
    expect(normalizeArtifactPrefix('///x///')).toBe('x');
  });

  it('leaves empty when only slashes', () => {
    expect(normalizeArtifactPrefix('///')).toBe('');
  });
});
