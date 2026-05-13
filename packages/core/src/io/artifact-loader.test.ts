import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  resolveArtifactPaths,
  loadCatalog,
  loadManifest,
  loadRunResults,
  loadSources,
} from './artifact-loader';
import { resetDbtToolsEnvDeprecationWarningsForTests } from '../config/dbt-tools-env';
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import {
  loadTestCatalog,
  loadTestManifest,
  loadTestRunResults,
} from 'dbt-artifacts-parser/test-utils';

const TARGET_ENV_KEYS = ['DBT_TOOLS_TARGET_DIR', 'DBT_TARGET_DIR', 'DBT_TARGET'] as const;

describe('ArtifactLoader', () => {
  let tempDir: string;
  let savedTargetEnv: Record<string, string | undefined>;

  beforeEach(() => {
    resetDbtToolsEnvDeprecationWarningsForTests();
    savedTargetEnv = {};
    for (const k of TARGET_ENV_KEYS) {
      savedTargetEnv[k] = process.env[k];
      delete process.env[k];
    }
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dbt-tools-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    for (const k of TARGET_ENV_KEYS) {
      const v = savedTargetEnv[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  describe('resolveArtifactPaths', () => {
    it('should default to ./target directory', () => {
      const result = resolveArtifactPaths();
      expect(result.manifest).toContain('target');
      expect(result.manifest).toContain('manifest.json');
      expect(result.runResults).toContain('target');
      expect(result.runResults).toContain('run_results.json');
    });

    it('should use custom target directory', () => {
      const result = resolveArtifactPaths(undefined, undefined, tempDir);
      expect(result.manifest).toBe(path.join(tempDir, 'manifest.json'));
      expect(result.runResults).toBe(path.join(tempDir, 'run_results.json'));
    });

    it('should use DBT_TOOLS_TARGET_DIR environment variable', () => {
      process.env.DBT_TOOLS_TARGET_DIR = tempDir;
      const result = resolveArtifactPaths();
      expect(result.manifest).toBe(path.join(tempDir, 'manifest.json'));
    });

    it('should use DBT_TARGET_DIR environment variable', () => {
      process.env.DBT_TARGET_DIR = tempDir;
      const result = resolveArtifactPaths();
      expect(result.manifest).toBe(path.join(tempDir, 'manifest.json'));
    });

    it('should use DBT_TARGET environment variable', () => {
      process.env.DBT_TARGET = tempDir;
      const result = resolveArtifactPaths();
      expect(result.manifest).toBe(path.join(tempDir, 'manifest.json'));
    });

    it('should prefer DBT_TOOLS_TARGET_DIR over DBT_TARGET_DIR', () => {
      process.env.DBT_TOOLS_TARGET_DIR = tempDir;
      process.env.DBT_TARGET_DIR = path.join(tempDir, 'other');
      const result = resolveArtifactPaths();
      expect(result.manifest).toBe(path.join(tempDir, 'manifest.json'));
    });

    it('should handle explicit manifest path', () => {
      const manifestPath = path.join(tempDir, 'custom-manifest.json');
      const result = resolveArtifactPaths(manifestPath);
      expect(result.manifest).toBe(path.resolve(manifestPath));
    });

    it('should handle directory path for manifest', () => {
      const result = resolveArtifactPaths(tempDir);
      expect(result.manifest).toBe(path.join(tempDir, 'manifest.json'));
    });

    it('should resolve run results path', () => {
      const result = resolveArtifactPaths(undefined, tempDir, undefined);
      expect(result.runResults).toBe(path.join(tempDir, 'run_results.json'));
    });

    it('should handle absolute paths', () => {
      const absPath = path.resolve(tempDir, 'manifest.json');
      const result = resolveArtifactPaths(absPath);
      expect(result.manifest).toBe(absPath);
    });

    it('should default catalog to target/catalog.json when catalogPath omitted', () => {
      const result = resolveArtifactPaths(undefined, undefined, tempDir);
      expect(result.catalog).toBe(path.join(tempDir, 'catalog.json'));
    });

    it('should use explicit catalog path when provided', () => {
      const catalogPath = path.join(tempDir, 'custom-catalog.json');
      const result = resolveArtifactPaths(undefined, undefined, undefined, catalogPath);
      expect(result.catalog).toBe(path.resolve(catalogPath));
    });

    it('should default sources to target/sources.json when sourcesPath omitted', () => {
      const result = resolveArtifactPaths(undefined, undefined, tempDir);
      expect(result.sources).toBe(path.join(tempDir, 'sources.json'));
    });

    it('should use explicit sources path when provided', () => {
      const sourcesPath = path.join(tempDir, 'custom-sources.json');
      const result = resolveArtifactPaths(undefined, undefined, undefined, undefined, sourcesPath);
      expect(result.sources).toBe(path.resolve(sourcesPath));
    });
  });

  describe('loadManifest', () => {
    it('should load and parse valid manifest', () => {
      const manifestJson = loadTestManifest('v12', 'manifest_1.10.json');
      const manifestPath = path.join(tempDir, 'manifest.json');
      fs.writeFileSync(manifestPath, JSON.stringify(manifestJson), 'utf-8');

      const manifest = loadManifest(manifestPath);
      expect(manifest).toBeDefined();
      expect(manifest.metadata).toBeDefined();
    });

    it('should throw error for missing file', () => {
      const missingPath = path.join(tempDir, 'nonexistent.json');
      expect(() => loadManifest(missingPath)).toThrow('Manifest file not found');
    });

    it('should throw error for invalid JSON', () => {
      const invalidPath = path.join(tempDir, 'manifest.json');
      fs.writeFileSync(invalidPath, 'invalid json', 'utf-8');

      expect(() => loadManifest(invalidPath)).toThrow('Failed to parse manifest file');
    });
  });

  describe('loadRunResults', () => {
    it('should load and parse valid run results', () => {
      const runResultsJson = loadTestRunResults('v6', 'run_results.json');
      const runResultsPath = path.join(tempDir, 'run_results.json');
      fs.writeFileSync(runResultsPath, JSON.stringify(runResultsJson), 'utf-8');

      const parsed = loadRunResults(runResultsPath);
      expect(parsed).toBeDefined();
      expect(parsed.metadata).toBeDefined();
    });

    it('should throw error for missing file', () => {
      const missingPath = path.join(tempDir, 'nonexistent.json');
      expect(() => loadRunResults(missingPath)).toThrow('Run results file not found');
    });

    it('should throw error for invalid JSON', () => {
      const invalidPath = path.join(tempDir, 'run_results.json');
      fs.writeFileSync(invalidPath, 'invalid json', 'utf-8');

      expect(() => loadRunResults(invalidPath)).toThrow('Failed to parse run results file');
    });
  });

  describe('loadCatalog', () => {
    it('should load and parse valid catalog', () => {
      const catalogJson = loadTestCatalog('v1', 'catalog.json');
      const catalogPath = path.join(tempDir, 'catalog.json');
      fs.writeFileSync(catalogPath, JSON.stringify(catalogJson), 'utf-8');

      const parsed = loadCatalog(catalogPath);
      expect(parsed).toBeDefined();
      expect(parsed.metadata).toBeDefined();
    });
  });

  describe('loadSources', () => {
    it('should load and parse valid sources', () => {
      const sourcesJson = {
        metadata: {
          dbt_schema_version: 'https://schemas.getdbt.com/dbt/sources/v3.json',
          dbt_version: '1.11.0',
        },
        results: [
          {
            unique_id: 'source.test.raw.customers',
            status: 'pass',
            max_loaded_at: '2026-01-01T00:00:00.000Z',
            snapshotted_at: '2026-01-01T01:00:00.000Z',
            max_loaded_at_time_ago_in_s: 3600,
            criteria: {
              warn_after: { count: 12, period: 'hour' },
              error_after: { count: 24, period: 'hour' },
            },
          },
        ],
      };
      const sourcesPath = path.join(tempDir, 'sources.json');
      fs.writeFileSync(sourcesPath, JSON.stringify(sourcesJson), 'utf-8');

      const parsed = loadSources(sourcesPath);
      expect(parsed).toBeDefined();
      expect(parsed.metadata).toBeDefined();
    });

    it('should throw error for missing file', () => {
      const missingPath = path.join(tempDir, 'nonexistent-sources.json');
      expect(() => loadSources(missingPath)).toThrow('Sources file not found');
    });
  });
});
