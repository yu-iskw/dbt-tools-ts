import { ArtifactBundleResolutionError } from './artifact-bundle-resolution-error';

/**
 * Structured error format for JSON output
 */
export interface StructuredError {
  error: string;
  code: string;
  message: string;
  details?: unknown;
}

/**
 * ErrorHandler provides structured error formatting for agent consumption
 */
export class ErrorHandler {
  /**
   * Format an error for CLI output.
   * @param preferHumanReadable - When true, return a single-line human string.
   *   When false, return a {@link StructuredError} object for JSON serialization
   *   (e.g. when the CLI was invoked with `--json`).
   */
  static formatError(error: Error, preferHumanReadable: boolean): StructuredError | string {
    const structured: StructuredError = {
      error: error.name || 'Error',
      code: this.getErrorCode(error),
      message: error.message,
    };

    // Add details for validation errors
    if (error.name === 'ValidationError' && 'field' in error) {
      structured.details = { field: (error as { field?: string }).field };
    }

    if (error instanceof ArtifactBundleResolutionError) {
      structured.details = {
        target: error.target,
        provider: error.provider,
        missing: error.missing,
        found: error.found,
        ...(error.keysTried != null ? { keysTried: error.keysTried } : {}),
      };
    }

    if (preferHumanReadable) {
      return `Error [${structured.code}]: ${structured.message}`;
    }

    return structured;
  }

  /**
   * Create a validation error
   */
  static createValidationError(message: string, field?: string): Error {
    const error = new Error(message);
    error.name = 'ValidationError';
    if (field) {
      (error as { field?: string }).field = field;
    }
    return error;
  }

  /**
   * Get error code from error type
   */
  private static getErrorCode(error: Error): string {
    if (error.name === 'ArtifactBundleResolutionError') {
      return 'ARTIFACT_BUNDLE_INCOMPLETE';
    }
    if (error.name === 'ValidationError') {
      return 'VALIDATION_ERROR';
    }
    if (error.message.includes('not found') || error.message.includes('File not found')) {
      return 'FILE_NOT_FOUND';
    }
    if (error.message.includes('Failed to parse')) {
      return 'PARSE_ERROR';
    }
    if (error.message.includes('Unsupported dbt version')) {
      return 'UNSUPPORTED_VERSION';
    }
    return 'UNKNOWN_ERROR';
  }
}
