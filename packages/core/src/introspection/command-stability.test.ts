import { describe, expect, it } from 'vitest';

import { COMMAND_STABILITY } from './command-stability';
import { getAllSchemas } from './schema-generator';

describe('command stability coverage', () => {
  it('classifies every runtime command schema explicitly', () => {
    expect(Object.keys(COMMAND_STABILITY).sort()).toEqual(Object.keys(getAllSchemas()).sort());
  });
});
