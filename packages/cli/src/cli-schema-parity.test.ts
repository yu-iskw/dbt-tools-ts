import { getAllSchemas } from '@dbt-tools/core';
import { describe, expect, it } from 'vitest';

import { program } from './cli';

import type { Command } from 'commander';

function collectCommands(
  root: Command,
  prefix: string[] = [],
  result: Map<string, Command> = new Map(),
): Map<string, Command> {
  for (const child of root.commands) {
    const path = [...prefix, child.name()];
    result.set(path.join(' '), child);
    collectCommands(child, path, result);
  }
  return result;
}

describe('CLI schema parity', () => {
  it('has exactly one schema for every registered command path', () => {
    const commandPaths = [...collectCommands(program).keys()].sort();
    const schemaPaths = Object.keys(getAllSchemas()).sort();

    expect(schemaPaths).toEqual(commandPaths);
  });

  it('keeps registered long options aligned with each command schema', () => {
    const schemas = new Map(Object.entries(getAllSchemas()));

    for (const [commandPath, command] of collectCommands(program)) {
      const registeredOptions = command.options.map((option) => option.long).sort();
      const schemaOptions = schemas.get(commandPath)?.options.map((option) => option.name).sort();

      expect({ command: commandPath, options: schemaOptions }).toEqual({
        command: commandPath,
        options: registeredOptions,
      });
    }
  });
});
