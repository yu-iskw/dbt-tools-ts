import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getDbtToolsMaxRemoteListingObjectsFromEnv,
  getDbtToolsMaxRemoteObjectBytesFromEnv,
  getDbtToolsReloadDebounceMs,
  getDbtToolsRemoteSourceConfigFromEnv,
  getDbtToolsTargetDirFromEnv,
  isDbtToolsDebugEnabled,
  isDbtToolsWatchEnabled,
  normalizeGcsAuthOverrides,
  parseDbtToolsRemoteSourceConfigJson,
  resetDbtToolsEnvDeprecationWarningsForTests,
  DBT_TOOLS_DBT_TARGET_REQUIRED_HINT,
  resolveDbtToolsDbtTargetFromFlagOrEnv,
} from './dbt-tools-env';

const TARGET_KEYS = ['DBT_TOOLS_TARGET_DIR', 'DBT_TARGET_DIR', 'DBT_TARGET'] as const;
const DEBUG_KEYS = ['DBT_TOOLS_DEBUG', 'DBT_DEBUG'] as const;
const WATCH_KEYS = ['DBT_TOOLS_WATCH', 'DBT_WATCH'] as const;
const DEBOUNCE_KEYS = ['DBT_TOOLS_RELOAD_DEBOUNCE_MS', 'DBT_RELOAD_DEBOUNCE_MS'] as const;
const REMOTE_KEYS = ['DBT_TOOLS_REMOTE_SOURCE'] as const;
const MAX_REMOTE_OBJECT_KEYS = ['DBT_TOOLS_MAX_REMOTE_OBJECT_BYTES'] as const;
const MAX_REMOTE_LISTING_KEYS = ['DBT_TOOLS_MAX_REMOTE_LISTING_OBJECTS'] as const;

function clearKeys(keys: readonly string[]): Record<string, string | undefined> {
  const prev: Record<string, string | undefined> = {};
  for (const k of keys) {
    prev[k] = process.env[k];
    delete process.env[k];
  }
  return prev;
}

function restoreKeys(prev: Record<string, string | undefined>): void {
  for (const [k, v] of Object.entries(prev)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

describe('dbt-tools-env', () => {
  beforeEach(() => {
    resetDbtToolsEnvDeprecationWarningsForTests();
  });

  describe('getDbtToolsTargetDirFromEnv', () => {
    let prev: Record<string, string | undefined>;

    beforeEach(() => {
      prev = clearKeys(TARGET_KEYS);
    });

    afterEach(() => {
      restoreKeys(prev);
    });

    it('returns undefined when unset', () => {
      expect(getDbtToolsTargetDirFromEnv()).toBeUndefined();
    });

    it('returns trimmed canonical value', () => {
      process.env.DBT_TOOLS_TARGET_DIR = '  ./target  ';
      expect(getDbtToolsTargetDirFromEnv()).toBe('./target');
    });

    it('treats empty canonical as unset and falls back', () => {
      process.env.DBT_TOOLS_TARGET_DIR = '   ';
      process.env.DBT_TARGET_DIR = '/tmp/x';
      expect(getDbtToolsTargetDirFromEnv()).toBe('/tmp/x');
    });

    it('prefers canonical over legacy', () => {
      process.env.DBT_TOOLS_TARGET_DIR = '/a';
      process.env.DBT_TARGET_DIR = '/b';
      process.env.DBT_TARGET = '/c';
      expect(getDbtToolsTargetDirFromEnv()).toBe('/a');
    });

    it('falls back to DBT_TARGET_DIR then DBT_TARGET', () => {
      process.env.DBT_TARGET = '/from-target';
      expect(getDbtToolsTargetDirFromEnv()).toBe('/from-target');
    });

    it('warns once when using DBT_TARGET_DIR', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      process.env.DBT_TARGET_DIR = '/legacy';
      expect(getDbtToolsTargetDirFromEnv()).toBe('/legacy');
      expect(warn).toHaveBeenCalledTimes(1);
      getDbtToolsTargetDirFromEnv();
      expect(warn).toHaveBeenCalledTimes(1);
      warn.mockRestore();
    });
  });

  describe('isDbtToolsDebugEnabled', () => {
    let prev: Record<string, string | undefined>;

    beforeEach(() => {
      prev = clearKeys(DEBUG_KEYS);
    });

    afterEach(() => {
      restoreKeys(prev);
    });

    it('is false when unset', () => {
      expect(isDbtToolsDebugEnabled()).toBe(false);
    });

    it('is true only for DBT_TOOLS_DEBUG=1', () => {
      process.env.DBT_TOOLS_DEBUG = '1';
      expect(isDbtToolsDebugEnabled()).toBe(true);
      process.env.DBT_TOOLS_DEBUG = '0';
      expect(isDbtToolsDebugEnabled()).toBe(false);
    });

    it('falls back to DBT_DEBUG=1 with warning', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      process.env.DBT_DEBUG = '1';
      expect(isDbtToolsDebugEnabled()).toBe(true);
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  describe('isDbtToolsWatchEnabled', () => {
    let prev: Record<string, string | undefined>;

    beforeEach(() => {
      prev = clearKeys(WATCH_KEYS);
    });

    afterEach(() => {
      restoreKeys(prev);
    });

    it('defaults to true when unset', () => {
      expect(isDbtToolsWatchEnabled()).toBe(true);
    });

    it('disables when DBT_TOOLS_WATCH=0', () => {
      process.env.DBT_TOOLS_WATCH = '0';
      expect(isDbtToolsWatchEnabled()).toBe(false);
    });

    it('uses legacy DBT_WATCH with warning', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      process.env.DBT_WATCH = '0';
      expect(isDbtToolsWatchEnabled()).toBe(false);
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  describe('getDbtToolsReloadDebounceMs', () => {
    let prev: Record<string, string | undefined>;

    beforeEach(() => {
      prev = clearKeys(DEBOUNCE_KEYS);
    });

    afterEach(() => {
      restoreKeys(prev);
    });

    it('defaults to 300', () => {
      expect(getDbtToolsReloadDebounceMs()).toBe(300);
    });

    it('parses canonical', () => {
      process.env.DBT_TOOLS_RELOAD_DEBOUNCE_MS = '500';
      expect(getDbtToolsReloadDebounceMs()).toBe(500);
    });

    it('falls back to legacy with warning', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      process.env.DBT_RELOAD_DEBOUNCE_MS = '150';
      expect(getDbtToolsReloadDebounceMs()).toBe(150);
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('uses 300 for invalid canonical', () => {
      process.env.DBT_TOOLS_RELOAD_DEBOUNCE_MS = 'nope';
      expect(getDbtToolsReloadDebounceMs()).toBe(300);
    });
  });

  describe('getDbtToolsMaxRemoteObjectBytesFromEnv', () => {
    let prev: Record<string, string | undefined>;

    beforeEach(() => {
      prev = clearKeys(MAX_REMOTE_OBJECT_KEYS);
    });

    afterEach(() => {
      restoreKeys(prev);
    });

    it('defaults to 512 MiB when unset', () => {
      expect(getDbtToolsMaxRemoteObjectBytesFromEnv()).toBe(512 * 1024 * 1024);
    });

    it('parses a positive integer', () => {
      process.env.DBT_TOOLS_MAX_REMOTE_OBJECT_BYTES = '1048576';
      expect(getDbtToolsMaxRemoteObjectBytesFromEnv()).toBe(1048576);
    });

    it('falls back to default for invalid values', () => {
      process.env.DBT_TOOLS_MAX_REMOTE_OBJECT_BYTES = 'nope';
      expect(getDbtToolsMaxRemoteObjectBytesFromEnv()).toBe(512 * 1024 * 1024);
      process.env.DBT_TOOLS_MAX_REMOTE_OBJECT_BYTES = '0';
      expect(getDbtToolsMaxRemoteObjectBytesFromEnv()).toBe(512 * 1024 * 1024);
    });

    it('clamps to the hard ceiling', () => {
      process.env.DBT_TOOLS_MAX_REMOTE_OBJECT_BYTES = String(3 * 1024 * 1024 * 1024);
      expect(getDbtToolsMaxRemoteObjectBytesFromEnv()).toBe(2 * 1024 * 1024 * 1024);
    });
  });

  describe('getDbtToolsMaxRemoteListingObjectsFromEnv', () => {
    let prev: Record<string, string | undefined>;

    beforeEach(() => {
      prev = clearKeys(MAX_REMOTE_LISTING_KEYS);
    });

    afterEach(() => {
      restoreKeys(prev);
    });

    it('defaults to 50_000 when unset', () => {
      expect(getDbtToolsMaxRemoteListingObjectsFromEnv()).toBe(50_000);
    });

    it('parses a positive integer', () => {
      process.env.DBT_TOOLS_MAX_REMOTE_LISTING_OBJECTS = '12345';
      expect(getDbtToolsMaxRemoteListingObjectsFromEnv()).toBe(12_345);
    });

    it('falls back to default for invalid values', () => {
      process.env.DBT_TOOLS_MAX_REMOTE_LISTING_OBJECTS = 'nope';
      expect(getDbtToolsMaxRemoteListingObjectsFromEnv()).toBe(50_000);
      process.env.DBT_TOOLS_MAX_REMOTE_LISTING_OBJECTS = '0';
      expect(getDbtToolsMaxRemoteListingObjectsFromEnv()).toBe(50_000);
    });

    it('clamps to the hard ceiling', () => {
      process.env.DBT_TOOLS_MAX_REMOTE_LISTING_OBJECTS = '9999999';
      expect(getDbtToolsMaxRemoteListingObjectsFromEnv()).toBe(500_000);
    });
  });

  describe('normalizeGcsAuthOverrides', () => {
    it('returns undefined when both fields are empty or whitespace', () => {
      expect(normalizeGcsAuthOverrides({})).toBeUndefined();
      expect(
        normalizeGcsAuthOverrides({ projectId: '  ', impersonateServiceAccount: '' }),
      ).toBeUndefined();
    });

    it('trims and returns only set fields', () => {
      expect(
        normalizeGcsAuthOverrides({
          projectId: ' my-proj ',
          impersonateServiceAccount: ' svc@x.iam.gserviceaccount.com ',
        }),
      ).toEqual({
        projectId: 'my-proj',
        impersonateServiceAccount: 'svc@x.iam.gserviceaccount.com',
      });
    });

    it('allows project id only', () => {
      expect(normalizeGcsAuthOverrides({ projectId: 'p' })).toEqual({ projectId: 'p' });
    });
  });

  describe('parseDbtToolsRemoteSourceConfigJson', () => {
    it('parses the same shape as env-backed happy path', () => {
      const json = JSON.stringify({
        provider: 's3',
        bucket: 'dbt-artifacts',
        prefix: '/prod/runs/',
        pollIntervalMs: 15000,
        region: 'ap-northeast-1',
      });
      expect(parseDbtToolsRemoteSourceConfigJson(json)).toEqual({
        provider: 's3',
        bucket: 'dbt-artifacts',
        prefix: 'prod/runs',
        pollIntervalMs: 15000,
        region: 'ap-northeast-1',
        endpoint: undefined,
        forcePathStyle: false,
        projectId: undefined,
        impersonateServiceAccount: undefined,
      });
    });

    it('normalizes many leading and trailing slashes without regex backtracking risk', () => {
      const json = JSON.stringify({
        provider: 'gcs',
        bucket: 'b',
        prefix: `${'/'.repeat(200)}runs${'/'.repeat(200)}`,
      });
      expect(parseDbtToolsRemoteSourceConfigJson(json)?.prefix).toBe('runs');
    });

    it('returns undefined for invalid JSON without reading env', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(parseDbtToolsRemoteSourceConfigJson('{nope')).toBeUndefined();
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('parses impersonateServiceAccount for gcs', () => {
      const json = JSON.stringify({
        provider: 'gcs',
        bucket: 'b',
        prefix: 'runs',
        projectId: 'proj-1',
        impersonateServiceAccount: 'other@proj.iam.gserviceaccount.com',
      });
      expect(parseDbtToolsRemoteSourceConfigJson(json)).toMatchObject({
        provider: 'gcs',
        bucket: 'b',
        prefix: 'runs',
        projectId: 'proj-1',
        impersonateServiceAccount: 'other@proj.iam.gserviceaccount.com',
      });
    });
  });

  describe('getDbtToolsRemoteSourceConfigFromEnv', () => {
    let prev: Record<string, string | undefined>;

    beforeEach(() => {
      prev = clearKeys(REMOTE_KEYS);
    });

    afterEach(() => {
      restoreKeys(prev);
    });

    it('returns undefined when unset', () => {
      expect(getDbtToolsRemoteSourceConfigFromEnv()).toBeUndefined();
    });

    it('parses a canonical s3 config', () => {
      process.env.DBT_TOOLS_REMOTE_SOURCE = JSON.stringify({
        provider: 's3',
        bucket: 'dbt-artifacts',
        prefix: '/prod/runs/',
        pollIntervalMs: 15000,
        region: 'ap-northeast-1',
      });

      expect(getDbtToolsRemoteSourceConfigFromEnv()).toEqual({
        provider: 's3',
        bucket: 'dbt-artifacts',
        prefix: 'prod/runs',
        pollIntervalMs: 15000,
        region: 'ap-northeast-1',
        endpoint: undefined,
        forcePathStyle: false,
        projectId: undefined,
        impersonateServiceAccount: undefined,
      });
    });

    it('defaults the poll interval when omitted', () => {
      process.env.DBT_TOOLS_REMOTE_SOURCE = JSON.stringify({
        provider: 'gcs',
        bucket: 'analytics',
        prefix: 'scheduled/dbt',
      });

      expect(getDbtToolsRemoteSourceConfigFromEnv()).toMatchObject({
        provider: 'gcs',
        bucket: 'analytics',
        prefix: 'scheduled/dbt',
        pollIntervalMs: 30000,
      });
    });

    it('returns undefined for invalid JSON', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      process.env.DBT_TOOLS_REMOTE_SOURCE = '{nope';

      expect(getDbtToolsRemoteSourceConfigFromEnv()).toBeUndefined();
      expect(warn).toHaveBeenCalled();

      warn.mockRestore();
    });

    it('returns undefined for incomplete configs', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      process.env.DBT_TOOLS_REMOTE_SOURCE = JSON.stringify({
        provider: 's3',
        bucket: '',
        prefix: 'runs',
      });

      expect(getDbtToolsRemoteSourceConfigFromEnv()).toBeUndefined();
      expect(warn).toHaveBeenCalled();

      warn.mockRestore();
    });
  });

  describe('resolveDbtToolsDbtTargetFromFlagOrEnv', () => {
    let prev: Record<string, string | undefined>;

    beforeEach(() => {
      prev = clearKeys(['DBT_TOOLS_DBT_TARGET'] as const);
    });

    afterEach(() => {
      restoreKeys(prev);
    });

    it('prefers non-empty flag over env', () => {
      process.env.DBT_TOOLS_DBT_TARGET = './env';
      expect(resolveDbtToolsDbtTargetFromFlagOrEnv(' ./flag ')).toBe('./flag');
    });

    it('uses env when flag omitted', () => {
      process.env.DBT_TOOLS_DBT_TARGET = './from-env';
      expect(resolveDbtToolsDbtTargetFromFlagOrEnv(undefined)).toBe('./from-env');
    });

    it('throws with shared hint when unset', () => {
      expect(() => resolveDbtToolsDbtTargetFromFlagOrEnv(undefined)).toThrow(
        DBT_TOOLS_DBT_TARGET_REQUIRED_HINT,
      );
    });
  });
});
