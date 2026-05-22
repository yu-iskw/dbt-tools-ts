import { describe, it, expect } from 'vitest';

import { program } from './cli';

function commandNames(cmd: typeof program): string[] {
  return cmd.commands.map((child) => child.name());
}

describe('CLI command registration', () => {
  it('registers failures, impact, and run-report on the root program', () => {
    const names = commandNames(program);
    expect(names).toContain('failures');
    expect(names).toContain('impact');
    expect(names).toContain('run-report');
    expect(names).toContain('run-summary');
  });
});
