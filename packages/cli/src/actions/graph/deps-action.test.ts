import { rmValidated } from '@dbt-tools/core';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  createJaffleArtifactBundleDir,
  createJaffleManifestOnlyDir,
} from '../../internal/cli-test-bundle-dir.js';

import { depsAction } from './deps-action.js';

describe('depsAction', () => {
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

  it('outputs upstream deps for a model with tree format', async () => {
    await depsAction(
      'model.jaffle_shop.stg_products',
      {
        dbtTarget: dbtTargetDir,
        direction: 'upstream',
        format: 'tree',
      },
      handleError,
    );

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('model.jaffle_shop.stg_products');
    expect(output).toMatch(/source\.jaffle_shop\.ecom\.raw_products|stg_products/);
  });

  it('works when only manifest.json is present', async () => {
    const manifestOnlyDir = await createJaffleManifestOnlyDir();
    try {
      await depsAction(
        'model.jaffle_shop.stg_products',
        {
          dbtTarget: manifestOnlyDir,
          direction: 'upstream',
          format: 'tree',
          json: true,
        },
        handleError,
      );

      const output = consoleLogSpy.mock.calls.at(-1)?.[0] as string;
      const parsed = JSON.parse(output) as { resource_id: string };
      expect(parsed.resource_id).toBe('model.jaffle_shop.stg_products');
    } finally {
      await rmValidated(manifestOnlyDir, { recursive: true, force: true });
    }
  });

  it('outputs upstream deps with flat format', async () => {
    await depsAction(
      'model.jaffle_shop.stg_products',
      {
        dbtTarget: dbtTargetDir,
        direction: 'upstream',
        format: 'flat',
      },
      handleError,
    );

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('model.jaffle_shop.stg_products');
  });

  it('outputs downstream deps for a model', async () => {
    await depsAction(
      'model.jaffle_shop.stg_products',
      {
        dbtTarget: dbtTargetDir,
        direction: 'downstream',
        format: 'tree',
      },
      handleError,
    );

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('model.jaffle_shop.stg_products');
  });

  it('outputs JSON when json option is true', async () => {
    await depsAction(
      'model.jaffle_shop.stg_products',
      {
        dbtTarget: dbtTargetDir,
        direction: 'upstream',
        format: 'tree',
        json: true,
      },
      handleError,
    );

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls.flat().join('');
    expect(() => JSON.parse(output)).not.toThrow();
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty('resource_id', 'model.jaffle_shop.stg_products');
  });

  it('respects depth option', async () => {
    await depsAction(
      'model.jaffle_shop.customers',
      {
        dbtTarget: dbtTargetDir,
        direction: 'upstream',
        format: 'tree',
        depth: 1,
      },
      handleError,
    );

    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it('throws for invalid direction', async () => {
    await expect(
      depsAction(
        'model.jaffle_shop.stg_products',
        {
          dbtTarget: dbtTargetDir,
          direction: 'invalid',
          format: 'tree',
        },
        handleError,
      ),
    ).rejects.toThrow(/Invalid direction/);
  });

  it('throws for invalid resource id', async () => {
    await expect(
      depsAction(
        '',
        {
          dbtTarget: dbtTargetDir,
          direction: 'upstream',
          format: 'tree',
        },
        handleError,
      ),
    ).rejects.toThrow();
  });
});
