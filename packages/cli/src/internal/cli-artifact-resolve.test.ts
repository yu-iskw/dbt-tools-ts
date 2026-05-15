import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  resolveCliArtifactPaths,
  resolveEffectiveDbtTarget,
  extractArtifactRootCliOptions,
  type ArtifactRootCliOptions,
} from './cli-artifact-resolve';

describe('cli-artifact-resolve', () => {
  const prevDbtTarget = process.env.DBT_TOOLS_DBT_TARGET;

  afterEach(() => {
    if (prevDbtTarget === undefined) {
      delete process.env.DBT_TOOLS_DBT_TARGET;
    } else {
      process.env.DBT_TOOLS_DBT_TARGET = prevDbtTarget;
    }
  });

  it('resolveEffectiveDbtTarget prefers flag over env', () => {
    process.env.DBT_TOOLS_DBT_TARGET = '/env/path';
    expect(resolveEffectiveDbtTarget('./flag')).toBe('./flag');
  });

  it('resolveEffectiveDbtTarget uses env when flag omitted', () => {
    process.env.DBT_TOOLS_DBT_TARGET = '/from/env';
    expect(resolveEffectiveDbtTarget(undefined)).toBe('/from/env');
  });

  it('resolveEffectiveDbtTarget throws when unset', () => {
    delete process.env.DBT_TOOLS_DBT_TARGET;
    expect(() => resolveEffectiveDbtTarget(undefined)).toThrow(/dbt artifact target is required/i);
  });

  it('extractArtifactRootCliOptions picks only artifact root keys', () => {
    const opts: ArtifactRootCliOptions & { json?: boolean } = {
      dbtTarget: './t',
      gcsProjectId: 'p1',
      gcsImpersonateServiceAccount: 'svc@p1.iam.gserviceaccount.com',
      json: true,
    };
    expect(extractArtifactRootCliOptions(opts)).toEqual({
      dbtTarget: './t',
      gcsProjectId: 'p1',
      gcsImpersonateServiceAccount: 'svc@p1.iam.gserviceaccount.com',
    });
  });

  it('resolveCliArtifactPaths loads fixed files from --dbt-target', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dbt-cli-artifact-'));
    await fs.writeFile(path.join(dir, 'manifest.json'), '{}');
    await fs.writeFile(path.join(dir, 'run_results.json'), '{}');
    const paths = await resolveCliArtifactPaths({ dbtTarget: dir });
    expect(paths.manifest).toBe(path.join(dir, 'manifest.json'));
    expect(paths.runResults).toBe(path.join(dir, 'run_results.json'));
  });

  it('resolveCliArtifactPaths supports manifest-only requirements', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dbt-cli-artifact-'));
    await fs.writeFile(path.join(dir, 'manifest.json'), '{}');

    const paths = await resolveCliArtifactPaths(
      { dbtTarget: dir },
      { manifest: true, runResults: false },
    );
    expect(paths.manifest).toBe(path.join(dir, 'manifest.json'));
  });

  it('resolveCliArtifactPaths supports run-results-only requirements', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dbt-cli-artifact-'));
    await fs.writeFile(path.join(dir, 'run_results.json'), '{}');

    const paths = await resolveCliArtifactPaths(
      { dbtTarget: dir },
      { manifest: false, runResults: true },
    );
    expect(paths.runResults).toBe(path.join(dir, 'run_results.json'));
  });

  it('resolveCliArtifactPaths uses DBT_TOOLS_DBT_TARGET when flag omitted', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dbt-cli-artifact-'));
    await fs.writeFile(path.join(dir, 'manifest.json'), '{}');
    await fs.writeFile(path.join(dir, 'run_results.json'), '{}');
    process.env.DBT_TOOLS_DBT_TARGET = dir;
    const paths = await resolveCliArtifactPaths({});
    expect(paths.manifest).toBe(path.join(dir, 'manifest.json'));
  });
});
