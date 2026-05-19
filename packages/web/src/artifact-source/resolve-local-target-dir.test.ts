import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  expandDbtTargetDirFromEnvValue,
  resolveLocalArtifactTargetDirFromEnv,
} from './resolve-local-target-dir';

describe('expandDbtTargetDirFromEnvValue', () => {
  const home = process.env.HOME;

  afterEach(() => {
    if (home === undefined) delete process.env.HOME;
    else process.env.HOME = home;
  });

  it('expands leading tilde with HOME', () => {
    process.env.HOME = '/Users/test';
    expect(expandDbtTargetDirFromEnvValue('~/target')).toBe('/Users/test/target');
  });

  it('trims whitespace', () => {
    expect(expandDbtTargetDirFromEnvValue('  ./t  ')).toBe('./t');
  });
});

describe('resolveLocalArtifactTargetDirFromEnv', () => {
  it('resolves relative paths against cwd', () => {
    const cwd = '/project/root';
    expect(resolveLocalArtifactTargetDirFromEnv(cwd, './target')).toBe(path.resolve(cwd, 'target'));
  });

  it('uses real temp dir when target exists', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dbt-resolve-'));
    try {
      const resolved = resolveLocalArtifactTargetDirFromEnv(process.cwd(), dir);
      expect(resolved).toBe(path.resolve(process.cwd(), dir));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
