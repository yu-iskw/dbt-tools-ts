/**
 * Status / freshness CLI action handler.
 * Reports artifact presence, modification times, and analysis readiness.
 */
import * as fs from 'fs';
import * as path from 'path';

import {
  DBT_CATALOG_JSON,
  DBT_MANIFEST_JSON,
  DBT_RUN_RESULTS_JSON,
  DBT_SOURCES_JSON,
  formatOutput,
  parseDbtToolsArtifactTarget,
  shouldOutputJSON,
  validateSafePath,
} from '@dbt-tools/core';

import {
  resolveCliArtifactPaths,
  resolveEffectiveDbtTarget,
  type ArtifactRootCliOptions,
} from '../../internal/cli-artifact-resolve';

export type StatusOptions = ArtifactRootCliOptions & {
  json?: boolean;
  noJson?: boolean;
};

export type ArtifactFileStatus = {
  path: string;
  exists: boolean;
  modified_at?: string;
  age_seconds?: number;
};

export type StatusResult = {
  target_dir: string;
  manifest: ArtifactFileStatus;
  run_results: ArtifactFileStatus;
  catalog: ArtifactFileStatus;
  sources: ArtifactFileStatus;
  readiness: 'full' | 'manifest-only' | 'unavailable';
  latest_modified_at?: string;
  age_seconds?: number;
  summary: string;
};

function pushArtifactStatus(lines: string[], label: string, status: ArtifactFileStatus): void {
  const icon = status.exists ? '✓' : '✗';
  lines.push(`${icon} ${label}`);
  lines.push(`    path:     ${status.path}`);
  if (status.exists) {
    lines.push(`    modified: ${status.modified_at}`);
    if (status.age_seconds !== undefined) {
      lines.push(`    age:      ${humanAge(status.age_seconds)}`);
    }
  } else {
    lines.push('    (not found)');
  }
}

function getFileStatus(filePath: string): ArtifactFileStatus {
  try {
    const stat = fs.statSync(filePath);
    const modifiedAt = stat.mtime.toISOString();
    const ageSeconds = Math.floor((Date.now() - stat.mtime.getTime()) / 1000);
    return {
      path: filePath,
      exists: true,
      modified_at: modifiedAt,
      age_seconds: ageSeconds,
    };
  } catch {
    return { path: filePath, exists: false };
  }
}

function humanAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/**
 * Format status as human-readable output.
 */
export function formatStatus(result: StatusResult): string {
  const lines: string[] = [];
  lines.push('dbt Artifact Status');
  lines.push('===================');
  lines.push(`Target:       ${result.target_dir}`);
  lines.push(`Readiness:    ${result.readiness}`);
  lines.push('');

  pushArtifactStatus(lines, 'manifest.json', result.manifest);

  lines.push('');
  pushArtifactStatus(lines, 'run_results.json', result.run_results);

  lines.push('');
  pushArtifactStatus(lines, 'catalog.json', result.catalog);

  lines.push('');
  pushArtifactStatus(lines, 'sources.json', result.sources);

  if (result.latest_modified_at) {
    lines.push('');
    lines.push(`Latest artifact: ${result.latest_modified_at}`);
    if (result.age_seconds !== undefined) {
      lines.push(`Age:             ${humanAge(result.age_seconds)}`);
    }
  }

  lines.push('');
  lines.push(`Summary: ${result.summary}`);

  return lines.join('\n');
}

/**
 * Status / freshness action handler
 */
export async function statusAction(
  options: StatusOptions,
  handleError: (error: unknown, preferStructuredErrors: boolean) => void,
): Promise<void> {
  try {
    const raw = resolveEffectiveDbtTarget(options.dbtTarget);
    const parsed = parseDbtToolsArtifactTarget(raw, process.cwd());

    let manifestStatus: ArtifactFileStatus;
    let runResultsStatus: ArtifactFileStatus;
    let catalogStatus: ArtifactFileStatus;
    let sourcesStatus: ArtifactFileStatus;
    let targetDir: string;

    if (parsed.kind === 'local') {
      const dir = parsed.resolvedPath;
      validateSafePath(dir);
      targetDir = dir;
      manifestStatus = getFileStatus(path.join(dir, DBT_MANIFEST_JSON));
      runResultsStatus = getFileStatus(path.join(dir, DBT_RUN_RESULTS_JSON));
      catalogStatus = getFileStatus(path.join(dir, DBT_CATALOG_JSON));
      sourcesStatus = getFileStatus(path.join(dir, DBT_SOURCES_JSON));
    } else {
      const paths = await resolveCliArtifactPaths({
        dbtTarget: options.dbtTarget,
      });
      validateSafePath(paths.manifest);
      validateSafePath(paths.runResults);
      if (paths.catalog) validateSafePath(paths.catalog);
      if (paths.sources) validateSafePath(paths.sources);
      manifestStatus = getFileStatus(paths.manifest);
      runResultsStatus = getFileStatus(paths.runResults);
      catalogStatus = getFileStatus(paths.catalog ?? '');
      sourcesStatus = getFileStatus(paths.sources ?? '');
      targetDir = path.dirname(paths.manifest) || '.';
    }

    let readiness: StatusResult['readiness'];
    if (!manifestStatus.exists) {
      readiness = 'unavailable';
    } else if (!runResultsStatus.exists) {
      readiness = 'manifest-only';
    } else {
      readiness = 'full';
    }

    // Latest modified artifact
    let latestModifiedAt: string | undefined;
    let latestAgeSeconds: number | undefined;

    const candidates: ArtifactFileStatus[] = [
      manifestStatus,
      runResultsStatus,
      catalogStatus,
      sourcesStatus,
    ].filter((f) => f.exists);

    if (candidates.length > 0) {
      const latest = candidates.reduce((prev, cur) => {
        if (!prev.modified_at) return cur;
        if (!cur.modified_at) return prev;
        return cur.modified_at > prev.modified_at ? cur : prev;
      });
      latestModifiedAt = latest.modified_at;
      latestAgeSeconds = latest.age_seconds;
    }

    const summaryMap: Record<StatusResult['readiness'], string> = {
      full: 'Required artifacts present. Manifest and execution analysis available; catalog.json and sources.json remain optional enrichments.',
      'manifest-only':
        'manifest.json found; run_results.json missing. Execution analysis unavailable.',
      unavailable: 'manifest.json not found. Most commands require manifest.json.',
    };

    const result: StatusResult = {
      target_dir: targetDir,
      manifest: manifestStatus,
      run_results: runResultsStatus,
      catalog: catalogStatus,
      sources: sourcesStatus,
      readiness,
      latest_modified_at: latestModifiedAt,
      age_seconds: latestAgeSeconds,
      summary: summaryMap[readiness],
    };

    const useJson = shouldOutputJSON(options.json, options.noJson);

    if (useJson) {
      console.log(formatOutput(result, true));
    } else {
      console.log(formatStatus(result));
    }
  } catch (error) {
    handleError(error, shouldOutputJSON(options.json, options.noJson));
  }
}
