import * as os from 'node:os';
import * as path from 'node:path';

import {
  validateResourceId,
  validateSafePath,
  validateDepth,
  isTTY,
  formatOutput,
  formatDeps,
  formatSummary,
  getCommandSchema,
  getAllSchemas,
  mkdtempSyncValidated,
  rmSyncValidated,
} from '@dbt-tools/core';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('CLI Integration', () => {
  describe('Core service integration', () => {
    it('should have input validation functions available', () => {
      expect(typeof validateResourceId).toBe('function');
      expect(typeof validateSafePath).toBe('function');
    });

    it('should have output formatting functions available', () => {
      expect(typeof isTTY).toBe('function');
      expect(typeof formatOutput).toBe('function');
    });

    it('should have schema introspection functions available', () => {
      expect(typeof getCommandSchema).toBe('function');
      expect(typeof getAllSchemas).toBe('function');
    });
  });

  describe('Command schema validation', () => {
    it('should have schema for all commands', () => {
      const schemas = getAllSchemas();
      expect(schemas).toHaveProperty('summary');
      expect(schemas).toHaveProperty('deps');
      expect(schemas).toHaveProperty('graph');
      expect(schemas).toHaveProperty('query-executions');
      expect(schemas).toHaveProperty('run-summary');
      expect(schemas).toHaveProperty('schema');
      expect(schemas).toHaveProperty('inventory');
      expect(schemas).toHaveProperty('timeline');
      expect(schemas).toHaveProperty('search');
      expect(schemas).toHaveProperty('discover');
      expect(schemas).toHaveProperty('explain');
      expect(schemas).toHaveProperty('diagnose run');
      expect(schemas).toHaveProperty('diagnose node');
      expect(schemas).toHaveProperty('export');
      expect(schemas).toHaveProperty('status');
      expect(schemas).toHaveProperty('freshness');
    });

    it('should have correct inventory schema', () => {
      const schema = getCommandSchema('inventory');
      expect(schema).not.toBeNull();
      expect(schema?.command).toBe('inventory');
      const typeOpt = schema?.options?.find((o) => o.name === '--type');
      expect(typeOpt).toBeDefined();
      const tagOpt = schema?.options?.find((o) => o.name === '--tag');
      expect(tagOpt).toBeDefined();
      const limitOpt = schema?.options?.find((o) => o.name === '--limit');
      expect(limitOpt?.type).toBe('number');
    });

    it('should have correct timeline schema', () => {
      const schema = getCommandSchema('timeline');
      expect(schema).not.toBeNull();
      expect(schema?.command).toBe('timeline');
      const sortOpt = schema?.options?.find((o) => o.name === '--sort');
      expect(sortOpt?.type).toBe('enum');
      const topOpt = schema?.options?.find((o) => o.name === '--top');
      expect(topOpt?.type).toBe('number');
    });

    it('should have correct search schema', () => {
      const schema = getCommandSchema('search');
      expect(schema).not.toBeNull();
      expect(schema?.command).toBe('search');
      expect(schema?.arguments[0]?.name).toBe('query');
      expect(schema?.arguments[0]?.required).toBe(false);
      expect(schema?.options?.some((o) => o.name === '--limit')).toBe(true);
    });

    it('should have correct query-executions schema', () => {
      const schema = getCommandSchema('query-executions');
      expect(schema).not.toBeNull();
      expect(schema?.command).toBe('query-executions');
    });

    it('should have correct discover schema', () => {
      const schema = getCommandSchema('discover');
      expect(schema).not.toBeNull();
      expect(schema?.command).toBe('discover');
      expect(schema?.arguments[0]?.name).toBe('query');
      expect(schema?.arguments[0]?.required).toBe(false);
      const limitOpt = schema?.options?.find((o) => o.name === '--limit');
      expect(limitOpt?.type).toBe('number');
      expect(schema?.options?.some((o) => o.name === '--trace')).toBe(true);
    });

    it('should have correct status schema', () => {
      const schema = getCommandSchema('status');
      expect(schema).not.toBeNull();
      expect(schema?.command).toBe('status');
      expect(schema?.options?.some((o) => o.name === '--dbt-target')).toBe(true);
    });

    it('freshness schema should have command = freshness', () => {
      const schema = getCommandSchema('freshness');
      expect(schema).not.toBeNull();
      expect(schema?.command).toBe('freshness');
    });

    it('should have correct deps command schema', () => {
      const schema = getCommandSchema('deps');
      expect(schema).not.toBeNull();
      expect(schema?.command).toBe('deps');
      expect(schema?.arguments.length).toBeGreaterThan(0);
      expect(schema?.arguments[0]?.name).toBe('resource-id');
      expect(schema?.arguments[0]?.required).toBe(true);

      const depthOpt = schema?.options?.find((o) => o.name === '--depth');
      expect(depthOpt).toBeDefined();
      expect(depthOpt?.type).toBe('number');

      const formatOpt = schema?.options?.find((o) => o.name === '--format');
      expect(formatOpt).toBeDefined();
      expect(formatOpt?.type).toBe('enum');
      expect(formatOpt?.values).toContain('flat');
      expect(formatOpt?.values).toContain('tree');

      const fieldOpt = schema?.options?.find((o) => o.name === '--field');
      expect(fieldOpt).toBeDefined();
      expect(fieldOpt?.type).toBe('string');
    });

    it('should have correct graph command schema with field-level', () => {
      const schema = getCommandSchema('graph');
      expect(schema).not.toBeNull();
      expect(schema?.command).toBe('graph');

      const fieldLevelOpt = schema?.options?.find((o) => o.name === '--field-level');
      expect(fieldLevelOpt).toBeDefined();
      expect(fieldLevelOpt?.type).toBe('boolean');

      expect(schema?.options?.some((o) => o.name === '--dbt-target')).toBe(true);
    });

    it('should have run-summary schema', () => {
      const schema = getCommandSchema('run-summary');
      expect(schema).not.toBeNull();
      expect(schema?.command).toBe('run-summary');
    });
  });

  describe('Input validation patterns', () => {
    it('should validate resource IDs correctly', () => {
      expect(() => validateResourceId('model.my_project.customers')).not.toThrow();
      expect(() => validateResourceId('model.x?fields=name')).toThrow();
      expect(() => validateResourceId('model%2ex')).toThrow();
    });

    it('should validate paths correctly', () => {
      expect(() => validateSafePath('./target/manifest.json')).not.toThrow();
      expect(() => validateSafePath('../../.ssh')).toThrow();
    });

    it('should reject invalid depth (NaN / non-integer) for deps', () => {
      expect(() => validateDepth(undefined)).not.toThrow();
      expect(() => validateDepth(1)).not.toThrow();
      expect(() => validateDepth(Number.NaN)).toThrow('Invalid depth');
      expect(() => validateDepth('abc' as unknown as number)).toThrow('Invalid depth');
    });
  });

  describe('Output formatting', () => {
    it('should format deps output correctly', () => {
      const result = {
        resource_id: 'model.test.example',
        direction: 'downstream' as const,
        dependencies: [
          {
            unique_id: 'model.test.dep',
            resource_type: 'model',
            name: 'dep',
            package_name: 'test',
            depth: 1,
          },
        ],
        count: 1,
      };

      const output = formatDeps(result);
      expect(output).toContain('Dependencies for model.test.example');
      expect(output).toContain('downstream');
      expect(output).toContain('model.test.dep');
    });

    it('should format summary output correctly', () => {
      const summary = {
        total_nodes: 10,
        total_edges: 15,
        has_cycles: false,
        nodes_by_type: { model: 8, test: 2 },
      };

      const output = formatSummary(summary);
      expect(output).toContain('dbt Project Summary');
      expect(output).toContain('Total Nodes: 10');
    });
  });
});

describe('CLI command error formatting', () => {
  const originalArgv = process.argv;
  const originalStdoutIsTTY = process.stdout.isTTY;
  let tmpDir: string;

  beforeEach(() => {
    vi.resetModules();
    tmpDir = mkdtempSyncValidated(path.join(os.tmpdir(), 'dbt-tools-cli-test-'));
  });

  afterEach(() => {
    process.argv = originalArgv;
    Object.defineProperty(process.stdout, 'isTTY', {
      value: originalStdoutIsTTY,
      configurable: true,
    });
    rmSyncValidated(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('graph reports human-readable errors by default', async () => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      configurable: true,
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { program } = await import('./cli');
    program.exitOverride();

    await expect(
      program.parseAsync(['graph', '--dbt-target', tmpDir], { from: 'user' }),
    ).rejects.toThrow(/process\.exit unexpectedly called with "1"/);

    const output = consoleErrorSpy.mock.calls.flat().join('\n');
    expect(output).toContain('Error [ARTIFACT_BUNDLE_INCOMPLETE]');
    expect(output).not.toContain('"error"');
  });
});
