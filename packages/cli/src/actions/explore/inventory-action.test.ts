import * as os from 'node:os';
import * as path from 'node:path';

import { mkdtempValidated, rmValidated } from '@dbt-tools/core';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  createJaffleArtifactBundleDir,
  createJaffleManifestOnlyDir,
} from '../../internal/cli-test-bundle-dir';

import { inventoryAction, formatInventory } from './inventory-action';

describe('inventoryAction', () => {
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

  it('outputs JSON inventory of all resources', async () => {
    await inventoryAction({ dbtTarget: dbtTargetDir, json: true }, handleError);

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as { total: number; entries: unknown[] };
    expect(parsed).toHaveProperty('total');
    expect(parsed).toHaveProperty('entries');
    expect(Array.isArray(parsed.entries)).toBe(true);
    expect(parsed.total).toBeGreaterThan(0);
    expect(parsed.entries.length).toBe(parsed.total);
  });

  it('pages with --limit and --offset', async () => {
    await inventoryAction({ dbtTarget: dbtTargetDir, type: 'model', json: true }, handleError);
    const full = JSON.parse(consoleLogSpy.mock.calls[0][0] as string) as {
      total: number;
    };
    expect(full.total).toBeGreaterThan(2);

    consoleLogSpy.mockClear();
    await inventoryAction(
      {
        dbtTarget: dbtTargetDir,
        type: 'model',
        json: true,
        limit: 2,
        offset: 0,
      },
      handleError,
    );
    const paged = JSON.parse(consoleLogSpy.mock.calls[0][0] as string) as {
      total: number;
      entries: unknown[];
      limit: number;
      offset: number;
      has_more: boolean;
    };
    expect(paged.entries.length).toBe(2);
    expect(paged.total).toBe(full.total);
    expect(paged.limit).toBe(2);
    expect(paged.offset).toBe(0);
    expect(paged.has_more).toBe(full.total > 2);
  });

  it('works when only manifest.json is present', async () => {
    const manifestOnlyDir = await createJaffleManifestOnlyDir();
    try {
      await inventoryAction({ dbtTarget: manifestOnlyDir, json: true }, handleError);

      const output = consoleLogSpy.mock.calls.at(-1)?.[0] as string;
      const parsed = JSON.parse(output) as { total: number };
      expect(parsed.total).toBeGreaterThan(0);
    } finally {
      await rmValidated(manifestOnlyDir, { recursive: true, force: true });
    }
  });

  it('filters by resource type', async () => {
    await inventoryAction({ dbtTarget: dbtTargetDir, type: 'model', json: true }, handleError);

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as {
      entries: Array<{ resource_type: string }>;
    };
    expect(parsed.entries.every((e) => e.resource_type === 'model')).toBe(true);
    expect(parsed.entries.length).toBeGreaterThan(0);
  });

  it('filters by multiple types comma-separated', async () => {
    await inventoryAction(
      { dbtTarget: dbtTargetDir, type: 'model,source', json: true },
      handleError,
    );

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as {
      entries: Array<{ resource_type: string }>;
    };
    const types = new Set(parsed.entries.map((e) => e.resource_type));
    expect(types.has('field')).toBe(false);
    expect(parsed.entries.every((e) => ['model', 'source'].includes(e.resource_type))).toBe(true);
  });

  it('filters by package name', async () => {
    await inventoryAction(
      { dbtTarget: dbtTargetDir, package: 'jaffle_shop', json: true },
      handleError,
    );

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as {
      entries: Array<{ package_name: string }>;
    };
    expect(parsed.entries.length).toBeGreaterThan(0);
    expect(parsed.entries.every((e) => e.package_name === 'jaffle_shop')).toBe(true);
  });

  it('filters by tag (no match returns empty)', async () => {
    await inventoryAction(
      { dbtTarget: dbtTargetDir, tag: 'nonexistent_tag_xyz', json: true },
      handleError,
    );

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as { total: number };
    expect(parsed.total).toBe(0);
  });

  it('supports --fields to project output fields', async () => {
    await inventoryAction(
      {
        dbtTarget: dbtTargetDir,
        type: 'model',
        fields: 'entries',
        json: true,
      },
      handleError,
    );

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as Record<string, unknown>;
    expect(parsed).toHaveProperty('entries');
    expect(parsed).not.toHaveProperty('total');
  });

  it('outputs human-readable format when noJson is set', async () => {
    await inventoryAction({ dbtTarget: dbtTargetDir, noJson: true }, handleError);

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls[0][0] as string;
    expect(output).toContain('dbt Inventory');
    expect(output).toContain('Total resources:');
  });

  it('rejects --offset without --limit', async () => {
    await expect(
      inventoryAction({ dbtTarget: dbtTargetDir, json: true, offset: 1 }, handleError),
    ).rejects.toThrow(/offset requires --limit/i);
  });

  it('throws when required artifacts are missing', async () => {
    const empty = await mkdtempValidated(path.join(os.tmpdir(), 'dbt-inv-empty-'));
    try {
      await expect(inventoryAction({ dbtTarget: empty, json: true }, handleError)).rejects.toThrow(
        /Missing required dbt artifact/,
      );
    } finally {
      await rmValidated(empty, { recursive: true, force: true });
    }
  });
});

describe('formatInventory', () => {
  it('formats empty result gracefully', () => {
    const result = { total: 0, entries: [] };
    const output = formatInventory(result);
    expect(output).toContain('dbt Inventory');
    expect(output).toContain('Total resources: 0');
    expect(output).toContain('(no matching resources)');
  });

  it('groups entries by type', () => {
    const result = {
      total: 2,
      entries: [
        {
          unique_id: 'model.p.a',
          resource_type: 'model',
          name: 'a',
          package_name: 'p',
        },
        {
          unique_id: 'source.p.b',
          resource_type: 'source',
          name: 'b',
          package_name: 'p',
        },
      ],
    };
    const output = formatInventory(result);
    expect(output).toContain('model (1)');
    expect(output).toContain('source (1)');
    expect(output).toContain('model.p.a');
    expect(output).toContain('source.p.b');
  });

  it('shows tags when present', () => {
    const result = {
      total: 1,
      entries: [
        {
          unique_id: 'model.p.a',
          resource_type: 'model',
          name: 'a',
          package_name: 'p',
          tags: ['finance', 'core'],
        },
      ],
    };
    const output = formatInventory(result);
    expect(output).toContain('[finance, core]');
  });
});
