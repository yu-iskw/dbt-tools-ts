import { describe, it, expect } from 'vitest';

import { getCommandSchema, getAllSchemas } from './schema-generator';

describe('SchemaGenerator', () => {
  describe('getCommandSchema', () => {
    it('should return schema for summary command', () => {
      const schema = getCommandSchema('summary');
      expect(schema).not.toBeNull();
      expect(schema?.command).toBe('summary');
      expect(schema?.arguments).toBeInstanceOf(Array);
      expect(schema?.options).toBeInstanceOf(Array);
    });

    it('should return schema for deps command', () => {
      const schema = getCommandSchema('deps');
      expect(schema).not.toBeNull();
      expect(schema?.command).toBe('deps');
      expect(schema?.arguments).toBeInstanceOf(Array);
      expect(schema?.options).toBeInstanceOf(Array);
      expect(schema?.arguments[0]?.name).toBe('resource-id');
      expect(schema?.arguments[0]?.required).toBe(true);
    });

    it('should return schema for graph command', () => {
      const schema = getCommandSchema('graph');
      expect(schema).not.toBeNull();
      expect(schema?.command).toBe('graph');
    });

    it('should return schema for query-executions command', () => {
      const schema = getCommandSchema('query-executions');
      expect(schema).not.toBeNull();
      expect(schema?.command).toBe('query-executions');
    });

    it('should return schema for run-summary command', () => {
      const schema = getCommandSchema('run-summary');
      expect(schema).not.toBeNull();
      expect(schema?.command).toBe('run-summary');
    });

    it('should return schema for schema command', () => {
      const schema = getCommandSchema('schema');
      expect(schema).not.toBeNull();
      expect(schema?.command).toBe('schema');
    });

    it('should return null for invalid command', () => {
      const schema = getCommandSchema('invalid-command');
      expect(schema).toBeNull();
    });
  });

  describe('getAllSchemas', () => {
    it('should return all command schemas', () => {
      const schemas = getAllSchemas();
      expect(schemas).toHaveProperty('summary');
      expect(schemas).toHaveProperty('deps');
      expect(schemas).toHaveProperty('graph');
      expect(schemas).toHaveProperty('query-executions');
      expect(schemas).toHaveProperty('run-summary');
      expect(schemas).toHaveProperty('schema');
      expect(schemas).toHaveProperty('discover');
      expect(schemas).toHaveProperty('explain');
      expect(schemas).toHaveProperty('export');
    });

    it('should have complete schema structure for all commands', () => {
      const schemas = getAllSchemas();
      for (const [command, schema] of Object.entries(schemas)) {
        expect(schema.command).toBe(command);
        expect(schema.description).toBeTruthy();
        expect(schema.arguments).toBeInstanceOf(Array);
        expect(schema.options).toBeInstanceOf(Array);
        expect(schema.output_format).toBeTruthy();
        expect(schema.example).toBeTruthy();
        expect(schema.stability).toMatch(/^(core|evolving|experimental)$/);
      }
    });

    it('should have correct argument structure', () => {
      const schemas = getAllSchemas();
      for (const schema of Object.values(schemas)) {
        for (const arg of schema.arguments) {
          expect(arg).toHaveProperty('name');
          expect(arg).toHaveProperty('required');
          expect(arg).toHaveProperty('description');
          expect(typeof arg.name).toBe('string');
          expect(typeof arg.required).toBe('boolean');
          expect(typeof arg.description).toBe('string');
        }
      }
    });

    it('should have correct option structure', () => {
      const schemas = getAllSchemas();
      for (const schema of Object.values(schemas)) {
        for (const option of schema.options) {
          expect(option).toHaveProperty('name');
          expect(option).toHaveProperty('type');
          expect(option).toHaveProperty('description');
          expect(typeof option.name).toBe('string');
          expect(typeof option.type).toBe('string');
          expect(typeof option.description).toBe('string');
        }
      }
    });

    it('should have enum values for enum type options', () => {
      const depsSchema = getCommandSchema('deps');
      const directionOption = depsSchema?.options.find((opt) => opt.name === '--direction');
      expect(directionOption?.type).toBe('enum');
      expect(directionOption?.values).toEqual(['upstream', 'downstream']);
    });

    it('should have --format option for deps with flat and tree values', () => {
      const depsSchema = getCommandSchema('deps');
      const formatOption = depsSchema?.options.find((opt) => opt.name === '--format');
      expect(formatOption).toBeDefined();
      expect(formatOption?.type).toBe('enum');
      expect(formatOption?.values).toEqual(['flat', 'tree']);
      expect(formatOption?.default).toBe('tree');
    });
  });
});
