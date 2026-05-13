import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createJaffleArtifactBundleDir,
  createJaffleManifestOnlyDir,
} from '../../internal/cli-test-bundle-dir';
import { searchAction, formatSearch } from './search-action';

describe('searchAction', () => {
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
    await fs.rm(dbtTargetDir, { recursive: true, force: true });
  });

  it('returns all resources when no query or filters', async () => {
    await searchAction(undefined, { dbtTarget: dbtTargetDir, json: true }, handleError);

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as { total: number; results: unknown[] };
    expect(parsed.total).toBeGreaterThan(0);
    expect(parsed.results.length).toBe(parsed.total);
  });

  it('works when only manifest.json is present', async () => {
    const manifestOnlyDir = await createJaffleManifestOnlyDir();
    try {
      await searchAction('customers', { dbtTarget: manifestOnlyDir, json: true }, handleError);

      const output = consoleLogSpy.mock.calls.at(-1)?.[0] as string;
      const parsed = JSON.parse(output) as { total: number };
      expect(parsed.total).toBeGreaterThan(0);
    } finally {
      await fs.rm(manifestOnlyDir, { recursive: true, force: true });
    }
  });

  it('returns structured result shape', async () => {
    await searchAction('orders', { dbtTarget: dbtTargetDir, json: true }, handleError);

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as {
      query: string;
      total: number;
      results: Array<{
        unique_id: string;
        resource_type: string;
        name: string;
        package_name: string;
      }>;
    };
    expect(parsed).toHaveProperty('query', 'orders');
    expect(parsed).toHaveProperty('total');
    expect(Array.isArray(parsed.results)).toBe(true);
    if (parsed.results.length > 0) {
      const r = parsed.results[0];
      expect(r).toHaveProperty('unique_id');
      expect(r).toHaveProperty('resource_type');
      expect(r).toHaveProperty('name');
      expect(r).toHaveProperty('package_name');
    }
  });

  it('returns results matching a name substring', async () => {
    await searchAction('customers', { dbtTarget: dbtTargetDir, json: true }, handleError);

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as {
      results: Array<{
        name: string;
        unique_id: string;
        path?: string;
        package_name: string;
      }>;
    };
    expect(parsed.results.length).toBeGreaterThan(0);
    expect(
      parsed.results.every(
        (r) =>
          r.name.toLowerCase().includes('customers') ||
          r.unique_id.toLowerCase().includes('customers') ||
          r.package_name.toLowerCase().includes('customers') ||
          (r.path ?? '').toLowerCase().includes('customers'),
      ),
    ).toBe(true);
  });

  it('supports inline type: filter in query', async () => {
    await searchAction('type:model', { dbtTarget: dbtTargetDir, json: true }, handleError);

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as {
      results: Array<{ resource_type: string }>;
    };
    expect(parsed.results.length).toBeGreaterThan(0);
    expect(parsed.results.every((r) => r.resource_type === 'model')).toBe(true);
  });

  it('supports inline path: filter in query', async () => {
    await searchAction('orders path:marts', { dbtTarget: dbtTargetDir, json: true }, handleError);

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as {
      results: Array<{ path?: string }>;
    };
    expect(parsed.results.length).toBeGreaterThan(0);
    expect(parsed.results.every((r) => (r.path ?? '').includes('marts'))).toBe(true);
  });

  it('lets --path override inline path: tokens', async () => {
    await searchAction(
      'orders path:marts',
      { dbtTarget: dbtTargetDir, path: 'staging', json: true },
      handleError,
    );

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as {
      results: Array<{ path?: string }>;
    };
    expect(parsed.results.length).toBeGreaterThan(0);
    expect(parsed.results.every((r) => (r.path ?? '').includes('staging'))).toBe(true);
  });

  it('supports --type flag', async () => {
    await searchAction(
      undefined,
      { dbtTarget: dbtTargetDir, type: 'source', json: true },
      handleError,
    );

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as {
      results: Array<{ resource_type: string }>;
    };
    expect(parsed.results.length).toBeGreaterThan(0);
    expect(parsed.results.every((r) => r.resource_type === 'source')).toBe(true);
  });

  it('supports --package flag', async () => {
    await searchAction(
      undefined,
      { dbtTarget: dbtTargetDir, package: 'jaffle_shop', json: true },
      handleError,
    );

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as {
      results: Array<{ package_name: string }>;
    };
    expect(parsed.results.length).toBeGreaterThan(0);
    expect(parsed.results.every((r) => r.package_name === 'jaffle_shop')).toBe(true);
  });

  it('returns empty results for unmatched query', async () => {
    await searchAction(
      'zzz_no_such_model_xyz',
      { dbtTarget: dbtTargetDir, json: true },
      handleError,
    );

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as { total: number };
    expect(parsed.total).toBe(0);
  });

  it('outputs human-readable format in TTY mode', async () => {
    await searchAction('customers', { dbtTarget: dbtTargetDir, noJson: true }, handleError);

    const output = consoleLogSpy.mock.calls[0][0] as string;
    expect(output).toContain('Search results');
  });

  it('excludes field-type nodes', async () => {
    await searchAction(undefined, { dbtTarget: dbtTargetDir, json: true }, handleError);

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as {
      results: Array<{ resource_type: string }>;
    };
    expect(parsed.results.every((r) => r.resource_type !== 'field')).toBe(true);
  });

  it('pages with --limit on search results', async () => {
    await searchAction('a', { dbtTarget: dbtTargetDir, json: true }, handleError);
    const full = JSON.parse(consoleLogSpy.mock.calls[0][0] as string) as {
      total: number;
    };
    expect(full.total).toBeGreaterThan(2);

    consoleLogSpy.mockClear();
    await searchAction(
      'a',
      { dbtTarget: dbtTargetDir, json: true, limit: 2, offset: 0 },
      handleError,
    );
    const paged = JSON.parse(consoleLogSpy.mock.calls[0][0] as string) as {
      total: number;
      results: unknown[];
      limit: number;
      has_more: boolean;
    };
    expect(paged.results.length).toBe(2);
    expect(paged.total).toBe(full.total);
    expect(paged.has_more).toBe(full.total > 2);
  });

  it('rejects --offset without --limit', async () => {
    await expect(
      searchAction('orders', { dbtTarget: dbtTargetDir, json: true, offset: 1 }, handleError),
    ).rejects.toThrow(/offset requires --limit/i);
  });

  it('throws for control characters in query', async () => {
    await expect(
      searchAction('\x00bad', { dbtTarget: dbtTargetDir }, handleError),
    ).rejects.toThrow();
  });

  it('throws when required artifacts are missing', async () => {
    const empty = await fs.mkdtemp(path.join(os.tmpdir(), 'dbt-search-empty-'));
    try {
      await expect(searchAction('orders', { dbtTarget: empty }, handleError)).rejects.toThrow(
        /Missing required dbt artifact/,
      );
    } finally {
      await fs.rm(empty, { recursive: true, force: true });
    }
  });
});

describe('formatSearch', () => {
  it('formats empty output gracefully', () => {
    const output = formatSearch({ total: 0, results: [] });
    expect(output).toContain('0 results found');
  });

  it('includes query in header when provided', () => {
    const output = formatSearch({
      query: 'orders',
      total: 1,
      results: [
        {
          unique_id: 'model.p.orders',
          resource_type: 'model',
          name: 'orders',
          package_name: 'p',
        },
      ],
    });
    expect(output).toContain('Search results for "orders"');
    expect(output).toContain('model.p.orders');
  });
});
