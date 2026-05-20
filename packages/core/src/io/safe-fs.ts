/* eslint-disable security/detect-non-literal-fs-filename -- All paths validated via resolveSafePath before any fs syscall. */
import * as fs from 'node:fs';
import { createReadStream } from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';

import { resolveSafePath, validateSafePath } from '../validation/input-validator';

import type { Dirent, PathLike, Stats } from 'node:fs';

function resolved(pathInput: string): string {
  return resolveSafePath(pathInput);
}

export function existsValidated(pathInput: string): boolean {
  return fs.existsSync(resolved(pathInput));
}

export function statValidatedSync(pathInput: string): Stats {
  return fs.statSync(resolved(pathInput));
}

export function realpathValidatedSync(pathInput: string): string {
  return fs.realpathSync(resolved(pathInput));
}

export function readValidatedUtf8Sync(pathInput: string): string {
  return fs.readFileSync(resolved(pathInput), 'utf-8');
}

export function writeValidatedUtf8Sync(pathInput: string, data: string): void {
  fs.writeFileSync(resolved(pathInput), data, 'utf-8');
}

export async function readValidatedUtf8(pathInput: string): Promise<string> {
  return fsp.readFile(resolved(pathInput), 'utf-8');
}

export async function writeValidatedUtf8(pathInput: string, data: string): Promise<void> {
  await fsp.writeFile(resolved(pathInput), data, 'utf-8');
}

export async function mkdirValidated(
  pathInput: string,
  options?: Parameters<typeof fsp.mkdir>[1],
): Promise<string | undefined> {
  return fsp.mkdir(resolved(pathInput), options);
}

export async function mkdtempValidated(prefixPath: string): Promise<string> {
  return fsp.mkdtemp(resolved(prefixPath));
}

export function mkdtempSyncValidated(prefixPath: string): string {
  return fs.mkdtempSync(resolved(prefixPath));
}

export async function rmValidated(
  pathInput: string,
  options?: Parameters<typeof fsp.rm>[1],
): Promise<void> {
  await fsp.rm(resolved(pathInput), options);
}

export function rmSyncValidated(
  pathInput: string,
  options?: Parameters<typeof fs.rmSync>[1],
): void {
  fs.rmSync(resolved(pathInput), options);
}

export async function readdirValidated(pathInput: string): Promise<Dirent[]> {
  return fsp.readdir(resolved(pathInput), { withFileTypes: true });
}

export async function statValidated(pathInput: string): Promise<Stats> {
  return fsp.stat(resolved(pathInput));
}

export function createReadStreamValidated(pathInput: string): ReturnType<typeof createReadStream> {
  return createReadStream(resolved(pathInput));
}

export function watchValidated(
  pathInput: string,
  listener: (eventType: string, filename: string | null) => void,
): fs.FSWatcher {
  return fs.watch(resolved(pathInput), listener);
}

/** For path.join after resolveSafePath on base; validates each segment before join. */
export function resolveJoinedSafe(basePath: string, ...segments: string[]): string {
  const base = resolved(basePath);
  for (const segment of segments) {
    validateSafePath(segment);
  }
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
  return path.join(base, ...segments);
}

export type { PathLike };
/* eslint-enable security/detect-non-literal-fs-filename -- end safe-fs boundary */
