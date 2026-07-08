import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { mkdtempValidated, resolveJoinedSafe, rmValidated, writeValidatedUtf8 } from '../io/safe-fs.js';

import { ArtifactRoot } from './artifact-root.js';

describe('ArtifactRoot', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtempValidated(path.join(os.tmpdir(), 'dbt-tools-artifact-root-'));
  });

  afterEach(async () => {
    await rmValidated(tempDir, { recursive: true, force: true });
  });

  it('reads files under the opened root', async () => {
    await writeValidatedUtf8(resolveJoinedSafe(tempDir, 'manifest.json'), '{"ok":true}');
    const root = await ArtifactRoot.open(tempDir);
    const content = await root.readUtf8('manifest.json');
    expect(content).toContain('"ok"');
  });

  it('rejects reads outside the root', async () => {
    const root = await ArtifactRoot.open(tempDir);
    await expect(root.readUtf8('../outside.json')).rejects.toThrow(/Path traversal|escapes artifact root/);
  });

  it('open rejects path traversal candidates', async () => {
    await expect(ArtifactRoot.open('../../etc/passwd', { cwd: tempDir })).rejects.toThrow();
  });
});
