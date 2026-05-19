import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  dbtToolsDebugLog,
  dbtToolsDebugLogPhase,
  dbtToolsDebugNow,
} from './dbt-tools-debug-log.js';

describe('dbtToolsDebugLog', () => {
  let stderr = '';
  const prevDebug = process.env.DBT_TOOLS_DEBUG;

  beforeEach(() => {
    stderr = '';
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderr += String(chunk);
      return true;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (prevDebug === undefined) {
      delete process.env.DBT_TOOLS_DEBUG;
    } else {
      process.env.DBT_TOOLS_DEBUG = prevDebug;
    }
  });

  it('writes to stderr when DBT_TOOLS_DEBUG=1', () => {
    process.env.DBT_TOOLS_DEBUG = '1';
    dbtToolsDebugLog('hello');
    expect(stderr).toBe('[dbt-tools] hello\n');
  });

  it('is silent when debug is disabled', () => {
    delete process.env.DBT_TOOLS_DEBUG;
    dbtToolsDebugLog('hello');
    expect(stderr).toBe('');
  });

  it('logs phased timing', () => {
    process.env.DBT_TOOLS_DEBUG = '1';
    const start = dbtToolsDebugNow();
    dbtToolsDebugLogPhase('listObjects', start, 'keys=3');
    expect(stderr).toMatch(/\[dbt-tools\] listObjects \(\d+ms\) keys=3\n/);
  });
});
