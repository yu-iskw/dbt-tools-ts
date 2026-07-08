import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';

import { validateSafePath } from '../validation/input-validator.js';

const DEFAULT_MAX_READ_BYTES = 64 * 1024 * 1024;

/* eslint-disable security/detect-non-literal-fs-filename -- Paths validated before realpath/read. */

export interface ArtifactRootEntry {
  name: string;
  isDirectory: boolean;
  isFile: boolean;
}

export interface ArtifactRootReadOptions {
  maxBytes?: number;
}

/**
 * Root-scoped filesystem capability (RFC-0001 §7.2).
 * Paths outside the opened root cannot be represented or read.
 */
export class ArtifactRoot {
  private constructor(private readonly realRoot: string) {}

  static async open(candidate: string, opts?: { cwd?: string }): Promise<ArtifactRoot> {
    const baseDir = opts?.cwd ?? process.cwd();
    validateSafePath(candidate);
    const resolved = path.resolve(baseDir, candidate);
    validateSafePath(resolved);
    const realRoot = await fsp.realpath(resolved);
    return new ArtifactRoot(realRoot);
  }

  static openSync(candidate: string, opts?: { cwd?: string }): ArtifactRoot {
    const baseDir = opts?.cwd ?? process.cwd();
    validateSafePath(candidate);
    const resolved = path.resolve(baseDir, candidate);
    validateSafePath(resolved);
    const realRoot = fs.realpathSync(resolved);
    return new ArtifactRoot(realRoot);
  }

  get rootPath(): string {
    return this.realRoot;
  }

  resolveRelative(rel: string): string {
    validateSafePath(rel);
    const joined = path.join(this.realRoot, rel);
    validateSafePath(joined);
    const normalized = path.normalize(joined);
    if (normalized !== this.realRoot && !normalized.startsWith(`${this.realRoot}${path.sep}`)) {
      throw new Error(`Path escapes artifact root: ${rel}`);
    }
    return normalized;
  }

  async read(rel: string, opts?: ArtifactRootReadOptions): Promise<Uint8Array> {
    const target = this.resolveRelative(rel);
    const maxBytes = opts?.maxBytes ?? DEFAULT_MAX_READ_BYTES;
    const stat = await fsp.stat(target);
    if (!stat.isFile()) {
      throw new Error(`Not a file: ${rel}`);
    }
    if (stat.size > maxBytes) {
      throw new Error(`File exceeds maxBytes (${maxBytes}): ${rel}`);
    }
    return fsp.readFile(target);
  }

  async readUtf8(rel: string, opts?: ArtifactRootReadOptions): Promise<string> {
    const bytes = await this.read(rel, opts);
    return Buffer.from(bytes).toString('utf-8');
  }

  async list(rel: string): Promise<ArtifactRootEntry[]> {
    const target = rel === '.' ? this.realRoot : this.resolveRelative(rel);
    const entries = await fsp.readdir(target, { withFileTypes: true });
    return entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      isFile: entry.isFile(),
    }));
  }
}
/* eslint-enable security/detect-non-literal-fs-filename */
