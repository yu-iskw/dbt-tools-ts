import { describe, it, expect } from 'vitest';

import {
  assertPathUnderBase,
  validateSafePath,
  validateNoControlChars,
  validateResourceId,
  validateNoPreEncoding,
  validateString,
  validateDepth,
} from './input-validator';

describe('InputValidator', () => {
  describe('assertPathUnderBase', () => {
    it('accepts paths under the base directory', () => {
      expect(() => assertPathUnderBase('/tmp/cwd/target', '/tmp/cwd')).not.toThrow();
    });

    it('rejects paths outside the base directory', () => {
      expect(() => assertPathUnderBase('/etc/passwd', '/tmp/cwd')).toThrow(/outside allowed base/);
    });
  });

  describe('validateSafePath', () => {
    it('should accept valid paths', () => {
      expect(() => validateSafePath('./target/manifest.json')).not.toThrow();
      expect(() => validateSafePath('target/manifest.json')).not.toThrow();
      expect(() => validateSafePath('/absolute/path.json')).not.toThrow();
    });

    it('should reject path traversals', () => {
      expect(() => validateSafePath('../../.ssh')).toThrow('Path traversal detected');
      expect(() => validateSafePath('../etc/passwd')).toThrow('Path traversal detected');
      expect(() => validateSafePath('..\\..\\etc')).toThrow('Path traversal detected');
      expect(() => validateSafePath('path/../other')).toThrow('Path traversal detected');
    });

    it('should reject empty or non-string paths', () => {
      expect(() => validateSafePath('')).toThrow('Path must be a non-empty string');
      expect(() => validateSafePath(null as unknown as string)).toThrow(
        'Path must be a non-empty string',
      );
      expect(() => validateSafePath(undefined as unknown as string)).toThrow(
        'Path must be a non-empty string',
      );
    });
  });

  describe('validateNoControlChars', () => {
    it('should accept normal strings', () => {
      expect(() => validateNoControlChars('normal string')).not.toThrow();
      expect(() => validateNoControlChars('model.my_project.customers')).not.toThrow();
    });

    it('should allow newline, carriage return, and tab', () => {
      expect(() => validateNoControlChars('line1\nline2')).not.toThrow();
      expect(() => validateNoControlChars('line1\rline2')).not.toThrow();
      expect(() => validateNoControlChars('col1\tcol2')).not.toThrow();
    });

    it('should reject null bytes', () => {
      expect(() => validateNoControlChars('test\u0000string')).toThrow(
        'Control character detected',
      );
    });

    it('should reject other control characters', () => {
      expect(() => validateNoControlChars('test\u0001string')).toThrow(
        'Control character detected',
      );
      expect(() => validateNoControlChars('test\u001fstring')).toThrow(
        'Control character detected',
      );
    });

    it('should handle empty strings', () => {
      expect(() => validateNoControlChars('')).not.toThrow();
      expect(() => validateNoControlChars(null as unknown as string)).not.toThrow();
    });
  });

  describe('validateResourceId', () => {
    it('should accept valid resource IDs', () => {
      expect(() => validateResourceId('model.my_project.customers')).not.toThrow();
      expect(() => validateResourceId('source.my_project.raw_data')).not.toThrow();
      expect(() => validateResourceId('test.my_project.unique_customers')).not.toThrow();
    });

    it('should reject embedded query params', () => {
      expect(() => validateResourceId('model.x?fields=name')).toThrow(
        'Resource ID contains invalid characters',
      );
      expect(() => validateResourceId('model.x#fragment')).toThrow(
        'Resource ID contains invalid characters',
      );
    });

    it('should reject pre-encoded URLs', () => {
      expect(() => validateResourceId('model%2ex')).toThrow(
        'Resource ID appears to be URL-encoded',
      );
      expect(() => validateResourceId('model%2E%2Ex')).toThrow(
        'Resource ID appears to be URL-encoded',
      );
    });

    it('should reject empty or non-string IDs', () => {
      expect(() => validateResourceId('')).toThrow('Resource ID must be a non-empty string');
      expect(() => validateResourceId(null as unknown as string)).toThrow(
        'Resource ID must be a non-empty string',
      );
    });

    it('should also validate control characters', () => {
      expect(() => validateResourceId('model\u0000x')).toThrow('Control character detected');
    });
  });

  describe('validateNoPreEncoding', () => {
    it('should accept normal strings', () => {
      expect(() => validateNoPreEncoding('normal string')).not.toThrow();
      expect(() => validateNoPreEncoding('model.my_project.customers')).not.toThrow();
    });

    it('should reject encoded path traversals', () => {
      expect(() => validateNoPreEncoding('%2e%2e')).toThrow('Pre-encoded path traversal detected');
      expect(() => validateNoPreEncoding('%2E%2E')).toThrow('Pre-encoded path traversal detected');
      expect(() => validateNoPreEncoding('%2e%2e%2f')).toThrow(
        'Pre-encoded path traversal detected',
      );
      expect(() => validateNoPreEncoding('%2e%2e%5c')).toThrow(
        'Pre-encoded path traversal detected',
      );
    });

    it("should allow other percent-encoded strings that aren't traversal", () => {
      // This is a bit lenient - we only check for specific traversal patterns
      expect(() => validateNoPreEncoding('test%20string')).not.toThrow();
    });

    it('should handle empty strings', () => {
      expect(() => validateNoPreEncoding('')).not.toThrow();
      expect(() => validateNoPreEncoding(null as unknown as string)).not.toThrow();
    });
  });

  describe('validateString', () => {
    it('should accept valid strings', () => {
      expect(() => validateString('valid string')).not.toThrow();
      expect(() => validateString('model.my_project.customers')).not.toThrow();
    });

    it('should reject empty strings by default', () => {
      expect(() => validateString('')).toThrow('Input must be a non-empty string');
      expect(() => validateString('   ')).toThrow('Input must be a non-empty string');
    });

    it('should allow empty strings when flag is set', () => {
      expect(() => validateString('', true)).not.toThrow();
    });

    it('should validate control characters', () => {
      expect(() => validateString('test\u0000string')).toThrow('Control character detected');
    });

    it('should validate pre-encoding', () => {
      expect(() => validateString('%2e%2e')).toThrow('Pre-encoded path traversal detected');
    });
  });

  describe('validateDepth', () => {
    it('should accept undefined', () => {
      expect(() => validateDepth(undefined)).not.toThrow();
    });

    it('should accept positive integers', () => {
      expect(() => validateDepth(1)).not.toThrow();
      expect(() => validateDepth(2)).not.toThrow();
      expect(() => validateDepth(10)).not.toThrow();
    });

    it('should reject NaN', () => {
      expect(() => validateDepth(Number.NaN)).toThrow(
        'Invalid depth: NaN. Must be a positive integer',
      );
    });

    it('should reject zero and negative', () => {
      expect(() => validateDepth(0)).toThrow('Invalid depth');
      expect(() => validateDepth(-1)).toThrow('Invalid depth');
    });

    it('should reject non-integers', () => {
      expect(() => validateDepth(1.5)).toThrow('Invalid depth');
    });

    it('should reject non-numbers', () => {
      expect(() => validateDepth('abc')).toThrow('Invalid depth');
      expect(() => validateDepth('1')).toThrow('Invalid depth');
    });
  });
});
