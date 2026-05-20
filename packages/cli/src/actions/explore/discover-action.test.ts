import { rmValidated } from '@dbt-tools/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createJaffleArtifactBundleDir,
  createJaffleManifestOnlyDir,
} from '../../internal/cli-test-bundle-dir';

import { discoverAction, formatDiscoverHuman } from './discover-action';

describe('discoverAction', () => {
  const handleError = (error: unknown) => {
    throw error;
  };

  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let dbtTargetDir: string;

  beforeEach(async () => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    dbtTargetDir = await createJaffleArtifactBundleDir();
  });

  afterEach(async () => {
    consoleLogSpy.mockRestore();
    await rmValidated(dbtTargetDir, { recursive: true, force: true });
  });

  it('reports missing query and filters via handleError', async () => {
    const handleError = vi.fn();
    await discoverAction(undefined, { dbtTarget: dbtTargetDir, json: true }, handleError);
    expect(handleError).toHaveBeenCalledTimes(1);
    const err = handleError.mock.calls[0][0] as Error;
    expect(err.message).toMatch(/query or at least one filter/i);
  });

  it('allows filter-only discover with empty query string', async () => {
    await discoverAction('', { dbtTarget: dbtTargetDir, type: 'model', json: true }, handleError);
    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as { matches: unknown[] };
    expect(parsed.matches.length).toBeGreaterThan(0);
  });

  it('returns JSON with discover_schema_version and matches', async () => {
    await discoverAction('customers', { dbtTarget: dbtTargetDir, json: true }, handleError);

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as {
      discover_schema_version: number;
      query: string;
      matches: Array<{ unique_id: string; reasons: string[]; score: number }>;
    };
    expect(parsed.discover_schema_version).toBe(1);
    expect(parsed.query).toBe('customers');
    expect(parsed.matches.length).toBeGreaterThan(0);
    expect(parsed.matches[0]).toHaveProperty('score');
    expect(Array.isArray(parsed.matches[0].reasons)).toBe(true);
  });

  it('adds web_url and transcript when env and --trace are set', async () => {
    vi.stubEnv('DBT_TOOLS_WEB_BASE_URL', 'http://127.0.0.1:5173');
    try {
      await discoverAction(
        'customers',
        { dbtTarget: dbtTargetDir, json: true, trace: true },
        handleError,
      );
      const raw = consoleLogSpy.mock.calls.at(-1)?.[0] as string;
      const parsed = JSON.parse(raw) as {
        web_url?: string;
        investigation_transcript?: { steps: unknown[] };
      };
      expect(parsed.web_url).toMatch(/^http:\/\/127\.0\.0\.1:5173\/\?/);
      expect(parsed.web_url).toContain('view=inventory');
      expect(parsed.investigation_transcript?.steps?.length).toBeGreaterThan(0);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('works with manifest-only bundle', async () => {
    const manifestOnlyDir = await createJaffleManifestOnlyDir();
    try {
      await discoverAction('orders', { dbtTarget: manifestOnlyDir, json: true }, handleError);
      const output = consoleLogSpy.mock.calls.at(-1)?.[0] as string;
      const parsed = JSON.parse(output) as { matches: unknown[] };
      expect(parsed.matches.length).toBeGreaterThan(0);
    } finally {
      await rmValidated(manifestOnlyDir, { recursive: true, force: true });
    }
  });

  it('emits runnable primitive commands for discover matches', async () => {
    await discoverAction('customers', { dbtTarget: dbtTargetDir, json: true }, handleError);
    const raw = consoleLogSpy.mock.calls.at(-1)?.[0] as string;
    const parsed = JSON.parse(raw) as {
      matches: Array<{ primitive_commands?: string[] }>;
    };
    expect(parsed.matches[0]?.primitive_commands).toContain(
      'dbt-tools deps "model.jaffle_shop.customers" --direction downstream',
    );
    expect(parsed.matches[0]?.primitive_commands).toContain(
      'dbt-tools search "model.jaffle_shop.customers"',
    );
  });

  it('preserves discover filters in web_url', async () => {
    vi.stubEnv('DBT_TOOLS_WEB_BASE_URL', 'http://127.0.0.1:5173');
    try {
      await discoverAction(
        'customers',
        {
          dbtTarget: dbtTargetDir,
          json: true,
          type: 'model',
          package: 'jaffle_shop',
          tag: 'nightly',
          path: 'models/staging',
        },
        handleError,
      );
      const raw = consoleLogSpy.mock.calls.at(-1)?.[0] as string;
      const parsed = JSON.parse(raw) as { web_url?: string };
      expect(parsed.web_url).toContain(
        'q=customers+type%3Amodel+package%3Ajaffle_shop+tag%3Anightly+path%3Amodels%2Fstaging',
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('omits q for filter-only web_url', async () => {
    vi.stubEnv('DBT_TOOLS_WEB_BASE_URL', 'http://127.0.0.1:5173');
    try {
      await discoverAction(
        '',
        {
          dbtTarget: dbtTargetDir,
          json: true,
          type: 'model',
        },
        handleError,
      );
      const raw = consoleLogSpy.mock.calls.at(-1)?.[0] as string;
      const parsed = JSON.parse(raw) as { web_url?: string };
      expect(parsed.web_url).toContain('view=inventory');
      expect(parsed.web_url).toContain('q=type%3Amodel');
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe('formatDiscoverHuman', () => {
  it('formats empty matches', () => {
    const text = formatDiscoverHuman({
      discover_schema_version: 1,
      query: 'zzznone',
      matches: [],
    });
    expect(text).toContain('0 matches');
  });
});
