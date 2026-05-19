import { describe, it, expect } from 'vitest';

import { ArtifactBundleResolutionError } from './artifact-bundle-resolution-error';
import { ErrorHandler } from './error-handler';

describe('ErrorHandler', () => {
  describe('formatError', () => {
    it('should format error as structured object when preferHumanReadable is false', () => {
      const error = new Error('Test error');
      const result = ErrorHandler.formatError(error, false);
      expect(typeof result).toBe('object');
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('code');
      expect(result).toHaveProperty('message');
      expect((result as { message: string }).message).toBe('Test error');
    });

    it('should format error as string when preferHumanReadable is true', () => {
      const error = new Error('Test error');
      const result = ErrorHandler.formatError(error, true);
      expect(typeof result).toBe('string');
      expect(result).toContain('Test error');
      expect(result).toContain('Error [');
    });

    it('should assign correct error codes', () => {
      const validationError = ErrorHandler.createValidationError('Invalid input');
      const result = ErrorHandler.formatError(validationError, false);
      expect((result as { code: string }).code).toBe('VALIDATION_ERROR');

      const notFoundError = new Error('File not found: test.json');
      const notFoundResult = ErrorHandler.formatError(notFoundError, false);
      expect((notFoundResult as { code: string }).code).toBe('FILE_NOT_FOUND');

      const parseError = new Error('Failed to parse JSON');
      const parseResult = ErrorHandler.formatError(parseError, false);
      expect((parseResult as { code: string }).code).toBe('PARSE_ERROR');

      const versionError = new Error('Unsupported dbt version');
      const versionResult = ErrorHandler.formatError(versionError, false);
      expect((versionResult as { code: string }).code).toBe('UNSUPPORTED_VERSION');
    });

    it('should include field details for validation errors', () => {
      const error = ErrorHandler.createValidationError('Invalid field', 'resource_id');
      const result = ErrorHandler.formatError(error, false);
      expect((result as { details?: { field?: string } }).details).toEqual({
        field: 'resource_id',
      });
    });

    it('should include bundle details for ArtifactBundleResolutionError', () => {
      const error = ArtifactBundleResolutionError.incomplete({
        target: './target',
        provider: 'local',
        missing: ['manifest.json'],
        found: ['run_results.json'],
      });
      const result = ErrorHandler.formatError(error, false) as {
        code: string;
        details?: Record<string, unknown>;
      };
      expect(result.code).toBe('ARTIFACT_BUNDLE_INCOMPLETE');
      expect(result.details).toMatchObject({
        target: './target',
        provider: 'local',
        missing: ['manifest.json'],
        found: ['run_results.json'],
      });
    });
  });

  describe('createValidationError', () => {
    it('should create validation error with message', () => {
      const error = ErrorHandler.createValidationError('Invalid input');
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Invalid input');
    });

    it('should include field in error', () => {
      const error = ErrorHandler.createValidationError('Invalid input', 'field_name');
      expect((error as { field?: string }).field).toBe('field_name');
    });

    it('should work without field', () => {
      const error = ErrorHandler.createValidationError('Invalid input');
      expect((error as { field?: string }).field).toBeUndefined();
    });
  });
});
