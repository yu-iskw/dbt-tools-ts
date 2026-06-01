import { describe, expect, it } from 'vitest';

import { getResourceInputSchema, queryDependenciesInputSchema } from './tool-input-schemas.js';

describe('tool input schemas (MCP coercion)', () => {
  it('parses includeCode string literals', () => {
    expect(
      getResourceInputSchema.parse({ uniqueId: 'model.pkg.x', includeCode: 'false' }).includeCode,
    ).toBe(false);
    expect(
      getResourceInputSchema.parse({ uniqueId: 'model.pkg.x', includeCode: 'true' }).includeCode,
    ).toBe(true);
    expect(() =>
      getResourceInputSchema.parse({ uniqueId: 'model.pkg.x', includeCode: 'maybe' }),
    ).toThrow();
  });

  it('parses buildOrder string literals', () => {
    expect(
      queryDependenciesInputSchema.parse({
        uniqueId: 'model.pkg.x',
        buildOrder: 'false',
      }).buildOrder,
    ).toBe(false);
  });
});
