import * as fs from 'fs';
import * as path from 'path';
import { parseManifest } from 'dbt-artifacts-parser/manifest';
import { resolveSafePath } from '../validation/input-validator';
import { parseRunResults } from 'dbt-artifacts-parser/run_results';
import { parseCatalog } from 'dbt-artifacts-parser/catalog';
import { parseSources } from 'dbt-artifacts-parser/sources';
import type { ParsedManifest } from 'dbt-artifacts-parser/manifest';
import type { ParsedRunResults } from 'dbt-artifacts-parser/run_results';
import type { ParsedCatalog } from 'dbt-artifacts-parser/catalog';
import type { ParsedSources } from 'dbt-artifacts-parser/sources';
import { getDbtToolsTargetDirFromEnv } from '../config/dbt-tools-env';
import {
  DBT_CATALOG_JSON,
  DBT_MANIFEST_JSON,
  DBT_RUN_RESULTS_JSON,
  DBT_SOURCES_JSON,
} from './artifact-filenames';

/**
 * Resolved artifact file paths
 */
export interface ArtifactPaths {
  manifest: string;
  runResults: string;
  catalog?: string;
  sources?: string;
}

const DEFAULT_TARGET_DIR = './target';

function resolveDbtArtifactJsonPath(
  overridePath: string | undefined,
  targetDir: string,
  fileName: string,
): string {
  const basePath = overridePath ?? targetDir;
  if (basePath.endsWith('.json')) {
    return resolveSafePath(basePath);
  }
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal — resolveSafePath validates basePath before join.
  return path.join(resolveSafePath(basePath), fileName);
}

function loadParsedJsonArtifact<T>(
  artifactPath: string,
  missingLabel: string,
  parseFailureLabel: string,
  parse: (json: Record<string, unknown>) => T,
): T {
  const fullPath = resolveSafePath(artifactPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`${missingLabel} not found: ${fullPath}`);
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  try {
    return parse(JSON.parse(content) as Record<string, unknown>);
  } catch (error) {
    throw new Error(
      `Failed to parse ${parseFailureLabel} ${fullPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Resolve artifact paths, defaulting to ./target directory
 */
export function resolveArtifactPaths(
  manifestPath?: string,
  runResultsPath?: string,
  targetDir?: string,
  catalogPath?: string,
  sourcesPath?: string,
): ArtifactPaths {
  const effectiveTargetDir = targetDir || getDbtToolsTargetDirFromEnv() || DEFAULT_TARGET_DIR;

  return {
    manifest: resolveDbtArtifactJsonPath(manifestPath, effectiveTargetDir, DBT_MANIFEST_JSON),
    runResults: resolveDbtArtifactJsonPath(
      runResultsPath,
      effectiveTargetDir,
      DBT_RUN_RESULTS_JSON,
    ),
    catalog: resolveDbtArtifactJsonPath(catalogPath, effectiveTargetDir, DBT_CATALOG_JSON),
    sources: resolveDbtArtifactJsonPath(sourcesPath, effectiveTargetDir, DBT_SOURCES_JSON),
  };
}

/**
 * Load and parse manifest.json file
 */
export function loadManifest(manifestPath: string): ParsedManifest {
  return loadParsedJsonArtifact(manifestPath, 'Manifest file', 'manifest file', parseManifest);
}

/**
 * Load and parse run_results.json file
 */
export function loadRunResults(runResultsPath: string): ParsedRunResults {
  return loadParsedJsonArtifact(
    runResultsPath,
    'Run results file',
    'run results file',
    parseRunResults,
  );
}

/**
 * Load and parse catalog.json file
 */
export function loadCatalog(catalogPath: string): ParsedCatalog {
  return loadParsedJsonArtifact(catalogPath, 'Catalog file', 'catalog file', parseCatalog);
}

/**
 * Load and parse sources.json file
 */
export function loadSources(sourcesPath: string): ParsedSources {
  return loadParsedJsonArtifact(sourcesPath, 'Sources file', 'sources file', parseSources);
}
