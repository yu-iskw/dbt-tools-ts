import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isCliEntrypoint } from './entrypoint.js';

const thisModulePath = fileURLToPath(import.meta.url);

describe('isCliEntrypoint', () => {
  it('returns true when argv1 is the same absolute path', () => {
    expect(isCliEntrypoint(import.meta.url, thisModulePath)).toBe(true);
  });

  it('returns true when argv1 is a relative path to the same file', () => {
    const relativeArgv = path.relative(process.cwd(), thisModulePath);
    expect(isCliEntrypoint(import.meta.url, relativeArgv)).toBe(true);
  });

  it('returns false for a different path', () => {
    expect(isCliEntrypoint(import.meta.url, path.join(thisModulePath, '..', 'server.ts'))).toBe(
      false,
    );
  });

  it('returns false when argv1 is undefined', () => {
    expect(isCliEntrypoint(import.meta.url, undefined)).toBe(false);
  });
});
