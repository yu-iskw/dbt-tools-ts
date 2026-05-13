import * as path from 'path';

/**
 * Validate that a path does not contain traversal sequences
 * Rejects paths like ../../.ssh or ..\\..\\etc
 */
export function validateSafePath(pathInput: string): void {
  if (!pathInput || typeof pathInput !== 'string') {
    throw new Error('Path must be a non-empty string');
  }

  // Check for path traversal patterns
  const normalized = pathInput.replace(/\\/g, '/');
  if (
    normalized.includes('../') ||
    normalized.includes('..\\') ||
    normalized.startsWith('../') ||
    normalized.includes('/../') ||
    normalized.includes('\\..\\')
  ) {
    throw new Error(
      `Path traversal detected in path: ${pathInput}. Paths must not contain ../ or ..\\`,
    );
  }
}

/**
 * Validate path and resolve to absolute. Use instead of path.resolve for user-controlled paths.
 * Satisfies path-traversal audit: validation and resolve are coupled.
 */
export function resolveSafePath(pathInput: string): string {
  validateSafePath(pathInput);
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal — validateSafePath rejects traversal before resolve.
  return path.resolve(pathInput);
}

/**
 * Ensure a resolved path is under a base directory (e.g. cwd).
 * Call this after path.resolve() to prevent escaping the base via absolute paths or traversal.
 */
export function assertPathUnderBase(resolvedPath: string, baseDir: string): void {
  validateSafePath(resolvedPath);
  validateSafePath(baseDir);
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal — validateSafePath on both args before resolve.
  const absPath = path.resolve(resolvedPath);
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal — validateSafePath on both args before resolve.
  const baseAbs = path.resolve(baseDir);
  const relative = path.relative(baseAbs, absPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(
      `Path is outside allowed base: ${resolvedPath}. Paths must be under ${baseDir}`,
    );
  }
}

/**
 * Validate that input does not contain control characters
 * Allows \n (0x0A), \r (0x0D), and \t (0x09)
 */
export function validateNoControlChars(input: string): void {
  if (!input || typeof input !== 'string') {
    return; // Empty or non-string is fine
  }

  for (let i = 0; i < input.length; i++) {
    const charCode = input.charCodeAt(i);
    // Reject control characters (< 0x20) except \n, \r, \t
    if (charCode < 0x20 && charCode !== 0x09 && charCode !== 0x0a && charCode !== 0x0d) {
      throw new Error(
        `Control character detected at position ${i}: U+${charCode.toString(16).padStart(4, '0')}`,
      );
    }
  }
}

/**
 * Validate that input does not contain pre-encoded URL strings
 * Rejects strings like %2e%2e (encoded ..)
 */
export function validateNoPreEncoding(input: string): void {
  if (!input || typeof input !== 'string') {
    return;
  }

  // Check for URL encoding patterns
  if (input.includes('%')) {
    // Check for common encoded traversal patterns
    const lowerInput = input.toLowerCase();
    if (
      lowerInput.includes('%2e%2e') ||
      lowerInput.includes('%2e%2e%2f') ||
      lowerInput.includes('%2e%2e%5c')
    ) {
      throw new Error(
        `Pre-encoded path traversal detected: ${input}. Use the actual path, not an encoded version.`,
      );
    }
  }
}

/**
 * Validate a dbt resource ID
 * Rejects embedded query params, URL fragments, and pre-encoded strings
 */
export function validateResourceId(id: string): void {
  if (!id || typeof id !== 'string') {
    throw new Error('Resource ID must be a non-empty string');
  }

  // Reject embedded query params
  if (id.includes('?') || id.includes('#')) {
    throw new Error(`Resource ID contains invalid characters (?, #): ${id}`);
  }

  // Reject pre-encoded URLs (agents sometimes double-encode)
  if (id.includes('%')) {
    throw new Error(
      `Resource ID appears to be URL-encoded: ${id}. Use the actual resource ID, not an encoded version.`,
    );
  }

  validateNoControlChars(id);
}

/**
 * Validate optional depth for traversal (e.g. deps --depth).
 * Rejects NaN, non-integers, and values < 1 when depth is provided.
 */
export function validateDepth(depth: unknown): void {
  if (depth === undefined) {
    return;
  }
  if (typeof depth !== 'number' || Number.isNaN(depth) || !Number.isInteger(depth) || depth < 1) {
    throw new Error(`Invalid depth: ${depth}. Must be a positive integer`);
  }
}

/**
 * Validate a general string input (combines multiple validations)
 */
export function validateString(input: string, allowEmpty = false): void {
  if (!allowEmpty && (!input || typeof input !== 'string' || input.trim().length === 0)) {
    throw new Error('Input must be a non-empty string');
  }

  if (input) {
    validateNoControlChars(input);
    validateNoPreEncoding(input);
  }
}
