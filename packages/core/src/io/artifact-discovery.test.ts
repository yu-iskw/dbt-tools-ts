import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ARTIFACT_RUN_ID_CURRENT,
  discoverArtifactCandidates,
  isAllowedArtifactRelativePath,
  listLocalArtifactObjects,
  remoteKeysToListedArtifacts,
} from './artifact-discovery';
import { DBT_CATALOG_JSON, DBT_MANIFEST_JSON, DBT_RUN_RESULTS_JSON } from './artifact-filenames';

describe('isAllowedArtifactRelativePath', () => {
  it('allows root-level artifact basenames only', () => {
    expect(isAllowedArtifactRelativePath(DBT_MANIFEST_JSON)).toBe(true);
    expect(isAllowedArtifactRelativePath(DBT_RUN_RESULTS_JSON)).toBe(true);
  });

  it('rejects subdirectory paths', () => {
    expect(isAllowedArtifactRelativePath(`run1/${DBT_MANIFEST_JSON}`)).toBe(false);
    expect(isAllowedArtifactRelativePath(`a/b/${DBT_MANIFEST_JSON}`)).toBe(false);
  });
});

describe('discoverArtifactCandidates', () => {
  it('returns one candidate for required pair only at root', () => {
    const r = discoverArtifactCandidates([
      {
        relativePath: DBT_MANIFEST_JSON,
        updatedAtMs: 10,
      },
      {
        relativePath: DBT_RUN_RESULTS_JSON,
        updatedAtMs: 20,
      },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.candidates).toHaveLength(1);
    expect(r.candidates[0]!.runId).toBe(ARTIFACT_RUN_ID_CURRENT);
    expect(r.candidates[0]!.hasCatalog).toBe(false);
    expect(r.candidates[0]!.hasSources).toBe(false);
  });

  it('returns candidate with optional artifacts and warnings metadata', () => {
    const r = discoverArtifactCandidates([
      { relativePath: DBT_MANIFEST_JSON, updatedAtMs: 1 },
      { relativePath: DBT_RUN_RESULTS_JSON, updatedAtMs: 2 },
      { relativePath: DBT_CATALOG_JSON, updatedAtMs: 3 },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.candidates[0]!.hasCatalog).toBe(true);
    expect(r.candidates[0]!.hasSources).toBe(false);
  });

  it('fails when manifest is missing', () => {
    const r = discoverArtifactCandidates([{ relativePath: DBT_RUN_RESULTS_JSON, updatedAtMs: 1 }]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.failure.missingBasenames).toContain(DBT_MANIFEST_JSON);
  });

  it('fails when run_results is missing', () => {
    const r = discoverArtifactCandidates([{ relativePath: DBT_MANIFEST_JSON, updatedAtMs: 1 }]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.failure.missingBasenames).toContain(DBT_RUN_RESULTS_JSON);
  });

  it('ignores subdirectory artifact paths in input', () => {
    const r = discoverArtifactCandidates([
      { relativePath: `a/${DBT_MANIFEST_JSON}`, updatedAtMs: 1 },
      { relativePath: `a/${DBT_RUN_RESULTS_JSON}`, updatedAtMs: 2 },
      { relativePath: `b/${DBT_MANIFEST_JSON}`, updatedAtMs: 3 },
      { relativePath: `b/${DBT_RUN_RESULTS_JSON}`, updatedAtMs: 4 },
    ]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.failure.code).toBe('MISSING_REQUIRED_PAIR');
  });

  it('ignores too-deep keys in input', () => {
    const r = discoverArtifactCandidates([
      { relativePath: DBT_MANIFEST_JSON, updatedAtMs: 1 },
      { relativePath: DBT_RUN_RESULTS_JSON, updatedAtMs: 2 },
      {
        relativePath: `x/y/${DBT_MANIFEST_JSON}`,
        updatedAtMs: 9,
      },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.candidates).toHaveLength(1);
  });

  it('maps remote keys to relative listings', () => {
    const listed = remoteKeysToListedArtifacts(
      [
        {
          key: 'pref/manifest.json',
          updatedAtMs: 1,
        },
        {
          key: 'pref/run_results.json',
          updatedAtMs: 2,
        },
      ],
      'pref',
    );
    const r = discoverArtifactCandidates(listed);
    expect(r.ok).toBe(true);
  });
});

describe('listLocalArtifactObjects', () => {
  it('lists root artifacts only and ignores subdirectories', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dbt-art-'));
    await fs.writeFile(path.join(root, DBT_MANIFEST_JSON), '{}', 'utf8');
    await fs.writeFile(path.join(root, DBT_RUN_RESULTS_JSON), '{}', 'utf8');
    await fs.mkdir(path.join(root, 'runA'), { recursive: true });
    await fs.writeFile(path.join(root, 'runA', DBT_MANIFEST_JSON), '{}', 'utf8');
    await fs.writeFile(path.join(root, 'runA', DBT_RUN_RESULTS_JSON), '{}', 'utf8');

    const listed = await listLocalArtifactObjects(root);
    const rels = listed.map((x) => x.relativePath).sort();
    expect(rels).toEqual([DBT_MANIFEST_JSON, DBT_RUN_RESULTS_JSON].sort());

    const r = discoverArtifactCandidates(listed);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.candidates).toHaveLength(1);
    expect(r.candidates[0]!.runId).toBe(ARTIFACT_RUN_ID_CURRENT);
  });

  it('subdir-only layout yields missing pair at root', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dbt-art-'));
    await fs.mkdir(path.join(root, 'runA'), { recursive: true });
    await fs.writeFile(path.join(root, 'runA', DBT_MANIFEST_JSON), '{}', 'utf8');
    await fs.writeFile(path.join(root, 'runA', DBT_RUN_RESULTS_JSON), '{}', 'utf8');

    const listed = await listLocalArtifactObjects(root);
    expect(listed).toHaveLength(0);

    const r = discoverArtifactCandidates(listed);
    expect(r.ok).toBe(false);
  });
});
