import { existsValidated, readValidatedUtf8 } from '@dbt-tools/core';
import { describe, expect, it } from 'vitest';

import {
  createJaffleArtifactBundleDir,
  createJaffleManifestOnlyDir,
  createJaffleRunResultsOnlyDir,
} from './cli-test-bundle-dir';

describe('cli-test-bundle-dir', () => {
  it('creates a bundle dir with manifest and run_results', async () => {
    const dir = await createJaffleArtifactBundleDir();
    expect(existsValidated(`${dir}/manifest.json`)).toBe(true);
    expect(existsValidated(`${dir}/run_results.json`)).toBe(true);
    const manifest = await readValidatedUtf8(`${dir}/manifest.json`);
    expect(manifest).toContain('metadata');
  });

  it('creates manifest-only dir', async () => {
    const dir = await createJaffleManifestOnlyDir();
    expect(existsValidated(`${dir}/manifest.json`)).toBe(true);
    expect(existsValidated(`${dir}/run_results.json`)).toBe(false);
  });

  it('creates run-results-only dir', async () => {
    const dir = await createJaffleRunResultsOnlyDir();
    expect(existsValidated(`${dir}/manifest.json`)).toBe(false);
    expect(existsValidated(`${dir}/run_results.json`)).toBe(true);
  });
});
