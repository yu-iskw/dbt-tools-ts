import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  deleteProcessEnv,
  getObjectProperty,
  getProcessEnv,
  setObjectProperty,
  setProcessEnv,
} from '../util/typed-map';

import {
  getDbtToolsCacheTtlMsFromEnv,
  getDbtToolsMaxCachedTargetsFromEnv,
  optionalCacheTtlMsFromEnv,
  optionalMaxCachedTargetsFromEnv,
  getDbtToolsReloadDebounceMs,
  getDbtToolsRemoteClientEnvFromEnv,
  getDbtToolsTargetDirFromEnv,
  isDbtToolsDebugEnabled,
  isDbtToolsWatchEnabled,
  resetDbtToolsEnvDeprecationWarningsForTests,
} from './dbt-tools-env';

const CACHE_KEYS = ['DBT_TOOLS_MAX_CACHED_TARGETS', 'DBT_TOOLS_CACHE_TTL_MS'] as const;

const TARGET_KEYS = ['DBT_TOOLS_TARGET_DIR', 'DBT_TARGET_DIR', 'DBT_TARGET'] as const;
const DEBUG_KEYS = ['DBT_TOOLS_DEBUG', 'DBT_DEBUG'] as const;
const WATCH_KEYS = ['DBT_TOOLS_WATCH', 'DBT_WATCH'] as const;
const DEBOUNCE_KEYS = ['DBT_TOOLS_RELOAD_DEBOUNCE_MS', 'DBT_RELOAD_DEBOUNCE_MS'] as const;

function clearKeys(keys: readonly string[]): Record<string, string | undefined> {
  const prev: Record<string, string | undefined> = {};
  for (const k of keys) {
    setObjectProperty(prev, k, getProcessEnv(k));
    deleteProcessEnv(k);
  }
  return prev;
}

function restoreKeys(prev: Record<string, string | undefined>): void {
  for (const k of Object.keys(prev)) {
    const v = getObjectProperty(prev, k) as string | undefined;
    if (v === undefined) deleteProcessEnv(k);
    else setProcessEnv(k, v);
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

  describe('getDbtToolsRemoteClientEnvFromEnv', () => {
    let prev: Record<string, string | undefined>;

    beforeEach(() => {
      prev = clearKeys([
        'DBT_TOOLS_GCS_PROJECT_ID',
        'DBT_TOOLS_GCS_IMPERSONATE_SERVICE_ACCOUNT',
        'DBT_TOOLS_S3_REGION',
        'DBT_TOOLS_S3_ENDPOINT',
      ] as const);
    });

    afterEach(() => {
      restoreKeys(prev);
    });

    it('returns empty when unset', () => {
      expect(getDbtToolsRemoteClientEnvFromEnv()).toEqual({});
    });

    it('reads GCS and S3 granular env vars', () => {
      process.env.DBT_TOOLS_GCS_PROJECT_ID = 'my-proj';
      process.env.DBT_TOOLS_GCS_IMPERSONATE_SERVICE_ACCOUNT = 'sa@my-proj.iam.gserviceaccount.com';
      process.env.DBT_TOOLS_S3_REGION = 'ap-northeast-1';
      process.env.DBT_TOOLS_S3_ENDPOINT = 'https://s3.local';

      expect(getDbtToolsRemoteClientEnvFromEnv()).toEqual({
        gcsRequestOptions: { impersonatedServiceAccount: 'sa@my-proj.iam.gserviceaccount.com' },
        remoteClientOverrides: {
          projectId: 'my-proj',
          region: 'ap-northeast-1',
          endpoint: 'https://s3.local',
        },
      });
    });
  });

  describe('artifact workspace cache env', () => {
    let prev: Record<string, string | undefined>;

    beforeEach(() => {
      prev = clearKeys(CACHE_KEYS);
    });

    afterEach(() => {
      restoreKeys(prev);
    });

    it('defaults max cached targets to 3', () => {
      expect(getDbtToolsMaxCachedTargetsFromEnv()).toBe(3);
    });

    it('reads max cached targets from env', () => {
      process.env.DBT_TOOLS_MAX_CACHED_TARGETS = '0';
      expect(getDbtToolsMaxCachedTargetsFromEnv()).toBe(0);
    });

    it('defaults cache TTL to 0', () => {
      expect(getDbtToolsCacheTtlMsFromEnv()).toBe(0);
    });

    it('reads cache TTL from env', () => {
      process.env.DBT_TOOLS_CACHE_TTL_MS = '60000';
      expect(getDbtToolsCacheTtlMsFromEnv()).toBe(60000);
    });

    it('optional readers return undefined when env is unset', () => {
      expect(optionalMaxCachedTargetsFromEnv({})).toBeUndefined();
      expect(optionalCacheTtlMsFromEnv({})).toBeUndefined();
    });

    it('optional readers parse explicit env records', () => {
      expect(optionalMaxCachedTargetsFromEnv({ DBT_TOOLS_MAX_CACHED_TARGETS: '5' })).toBe(5);
      expect(optionalCacheTtlMsFromEnv({ DBT_TOOLS_CACHE_TTL_MS: '120000' })).toBe(120000);
    });
  });
});
