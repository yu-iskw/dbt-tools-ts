import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { statusAction, formatStatus } from './status-action';
import type { StatusResult } from './status-action';

describe('statusAction', () => {
  const handleError = (error: unknown) => {
    throw error;
  };

  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let tmpDir: string;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dbt-tools-status-test-'));
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reports manifest-only readiness when only manifest exists', async () => {
    fs.writeFileSync(path.join(tmpDir, 'manifest.json'), '{}');

    await statusAction({ dbtTarget: tmpDir, json: true }, handleError);

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as StatusResult;
    expect(parsed.manifest.exists).toBe(true);
    expect(parsed.run_results.exists).toBe(false);
    expect(parsed.catalog.exists).toBe(false);
    expect(parsed.sources.exists).toBe(false);
    expect(parsed.readiness).toBe('manifest-only');
  });

  it('reports full readiness when both artifacts exist', async () => {
    fs.writeFileSync(path.join(tmpDir, 'manifest.json'), '{}');
    fs.writeFileSync(path.join(tmpDir, 'run_results.json'), '{}');

    await statusAction({ dbtTarget: tmpDir, json: true }, handleError);

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as StatusResult;
    expect(parsed.manifest.exists).toBe(true);
    expect(parsed.run_results.exists).toBe(true);
    expect(parsed.catalog.exists).toBe(false);
    expect(parsed.sources.exists).toBe(false);
    expect(parsed.readiness).toBe('full');
  });

  it('outputs required JSON fields', async () => {
    fs.writeFileSync(path.join(tmpDir, 'manifest.json'), '{}');
    fs.writeFileSync(path.join(tmpDir, 'run_results.json'), '{}');

    await statusAction({ dbtTarget: tmpDir, json: true }, handleError);

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as StatusResult;
    expect(parsed).toHaveProperty('target_dir');
    expect(parsed).toHaveProperty('manifest');
    expect(parsed).toHaveProperty('run_results');
    expect(parsed).toHaveProperty('catalog');
    expect(parsed).toHaveProperty('sources');
    expect(parsed).toHaveProperty('readiness');
    expect(parsed).toHaveProperty('summary');

    expect(parsed.manifest).toHaveProperty('path');
    expect(parsed.manifest).toHaveProperty('exists');
    expect(parsed.run_results).toHaveProperty('path');
    expect(parsed.run_results).toHaveProperty('exists');
    expect(parsed.catalog).toHaveProperty('path');
    expect(parsed.catalog).toHaveProperty('exists');
    expect(parsed.sources).toHaveProperty('path');
    expect(parsed.sources).toHaveProperty('exists');
  });

  it('reports unavailable when target dir has no artifacts', async () => {
    await statusAction({ dbtTarget: tmpDir, json: true }, handleError);

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as StatusResult;
    expect(parsed.readiness).toBe('unavailable');
    expect(parsed.manifest.exists).toBe(false);
    expect(parsed.run_results.exists).toBe(false);
    expect(parsed.catalog.exists).toBe(false);
    expect(parsed.sources.exists).toBe(false);
  });

  it('outputs human-readable format', async () => {
    await statusAction({ dbtTarget: tmpDir, format: 'text' }, handleError);

    const output = consoleLogSpy.mock.calls[0][0] as string;
    expect(output).toContain('dbt Artifact Status');
    expect(output).toContain('manifest.json');
    expect(output).toContain('run_results.json');
    expect(output).toContain('catalog.json');
    expect(output).toContain('sources.json');
    expect(output).toContain('Readiness:');
  });

  it('rejects path traversal in dbtTarget', async () => {
    await expect(statusAction({ dbtTarget: '../../etc' }, handleError)).rejects.toThrow();
  });

  it('calls handleError with structured flag when format is invalid', async () => {
    const handleErrorSpy = vi.fn((error: unknown) => {
      throw error;
    });

    await expect(
      statusAction({ dbtTarget: tmpDir, format: 'bogus' }, handleErrorSpy),
    ).rejects.toThrow(/Invalid --format/);

    expect(handleErrorSpy).toHaveBeenCalledTimes(1);
    expect(handleErrorSpy).toHaveBeenCalledWith(expect.anything(), true);
  });

  it('includes modification time when artifact exists', async () => {
    fs.writeFileSync(path.join(tmpDir, 'manifest.json'), '{}');

    await statusAction({ dbtTarget: tmpDir, json: true }, handleError);

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as StatusResult;
    expect(parsed.manifest.exists).toBe(true);
    expect(parsed.manifest.modified_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(typeof parsed.manifest.age_seconds).toBe('number');
  });
});

describe('formatStatus', () => {
  it('formats unavailable status clearly', () => {
    const result: StatusResult = {
      target_dir: './target',
      manifest: { path: './target/manifest.json', exists: false },
      run_results: { path: './target/run_results.json', exists: false },
      catalog: { path: './target/catalog.json', exists: false },
      sources: { path: './target/sources.json', exists: false },
      readiness: 'unavailable',
      summary: 'manifest.json not found. Most commands require manifest.json.',
    };
    const output = formatStatus(result);
    expect(output).toContain('dbt Artifact Status');
    expect(output).toContain('unavailable');
    expect(output).toContain('(not found)');
  });

  it('formats full readiness with ages', () => {
    const now = new Date().toISOString();
    const result: StatusResult = {
      target_dir: './target',
      manifest: {
        path: './target/manifest.json',
        exists: true,
        modified_at: now,
        age_seconds: 30,
      },
      run_results: {
        path: './target/run_results.json',
        exists: true,
        modified_at: now,
        age_seconds: 30,
      },
      catalog: { path: './target/catalog.json', exists: false },
      sources: { path: './target/sources.json', exists: false },
      readiness: 'full',
      latest_modified_at: now,
      age_seconds: 30,
      summary: 'All artifacts present.',
    };
    const output = formatStatus(result);
    expect(output).toContain('full');
    expect(output).toContain('30s ago');
  });

  it('formats manifest-only readiness', () => {
    const now = new Date().toISOString();
    const result: StatusResult = {
      target_dir: './target',
      manifest: {
        path: './target/manifest.json',
        exists: true,
        modified_at: now,
        age_seconds: 120,
      },
      run_results: { path: './target/run_results.json', exists: false },
      catalog: { path: './target/catalog.json', exists: false },
      sources: { path: './target/sources.json', exists: false },
      readiness: 'manifest-only',
      latest_modified_at: now,
      age_seconds: 120,
      summary: 'manifest.json found; run_results.json missing.',
    };
    const output = formatStatus(result);
    expect(output).toContain('manifest-only');
    expect(output).toContain('2m ago');
  });

  it('formats optional artifact presence when available', () => {
    const now = new Date().toISOString();
    const result: StatusResult = {
      target_dir: './target',
      manifest: {
        path: './target/manifest.json',
        exists: true,
        modified_at: now,
        age_seconds: 5,
      },
      run_results: {
        path: './target/run_results.json',
        exists: true,
        modified_at: now,
        age_seconds: 5,
      },
      catalog: {
        path: './target/catalog.json',
        exists: true,
        modified_at: now,
        age_seconds: 5,
      },
      sources: {
        path: './target/sources.json',
        exists: true,
        modified_at: now,
        age_seconds: 5,
      },
      readiness: 'full',
      summary: 'All artifacts present.',
    };

    const output = formatStatus(result);
    expect(output).toContain('catalog.json');
    expect(output).toContain('sources.json');
  });
});
