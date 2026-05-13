import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type ArtifactType = 'manifest' | 'run_results' | 'sources' | 'catalog';
export type ResourceLocation = 'tests' | 'resources';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resourcesDir = path.resolve(__dirname, 'resources');

function validatePathComponent(name: string): void {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('Path component must be a non-empty string');
  }
  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    throw new Error(`Path component must not contain traversal or separators: ${name}`);
  }
}

export function getTestResourcePath(
  type: ArtifactType,
  version: string,
  location: ResourceLocation = 'resources',
  project?: string,
  filename?: string,
): string {
  const normalizedVersion = version.startsWith('v') ? version : `v${version}`;

  if (location !== 'tests' && location !== 'resources') {
    throw new Error(`Unknown location: ${location}`);
  }
  if (!project || !filename) {
    throw new Error(`Project and filename are required when location is "${location}"`);
  }

  validatePathComponent(type);
  validatePathComponent(normalizedVersion);
  validatePathComponent(project);
  validatePathComponent(filename);

  const full = path.join(resourcesDir, type, normalizedVersion, project, filename);
  const baseAbs = path.resolve(resourcesDir);
  const resolved = path.resolve(full);
  if (!resolved.startsWith(baseAbs + path.sep) && resolved !== baseAbs) {
    throw new Error(`Path escape detected: ${full}`);
  }
  return full;
}

function sanitizePathComponent(name: string): string {
  return name.replace(/\.\./g, '').replaceAll(/[\\/]/g, '');
}

function findArtifactFiles(dir: string, baseDir: string, nameIncludes: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const sanitizedName = sanitizePathComponent(entry.name);
    const fullPath = path.resolve(dir, sanitizedName);
    if (!fullPath.startsWith(path.resolve(baseDir))) continue;
    if (entry.isDirectory()) {
      files.push(...findArtifactFiles(fullPath, baseDir, nameIncludes));
    } else if (
      entry.isFile() &&
      entry.name.includes(nameIncludes) &&
      entry.name.endsWith('.json')
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

export function discoverManifestFiles(): string[] {
  return findArtifactFiles(path.join(resourcesDir, 'manifest'), resourcesDir, 'manifest');
}

export function discoverRunResultsFiles(): string[] {
  return findArtifactFiles(path.join(resourcesDir, 'run_results'), resourcesDir, 'run_results');
}

export function discoverCatalogFiles(): string[] {
  return findArtifactFiles(path.join(resourcesDir, 'catalog'), resourcesDir, 'catalog');
}

export function discoverSourcesFiles(): string[] {
  return findArtifactFiles(path.join(resourcesDir, 'sources'), resourcesDir, 'sources');
}

export function loadTestManifest(
  version: string,
  filename: string,
  project: string = 'jaffle_shop',
): unknown {
  return JSON.parse(
    fs.readFileSync(getTestResourcePath('manifest', version, 'tests', project, filename), 'utf-8'),
  );
}

export function loadTestRunResults(
  version: string,
  filename: string,
  project: string = 'jaffle_shop',
): unknown {
  return JSON.parse(
    fs.readFileSync(
      getTestResourcePath('run_results', version, 'tests', project, filename),
      'utf-8',
    ),
  );
}

export function loadTestSources(
  version: string,
  filename: string,
  project: string = 'jaffle_shop',
): unknown {
  return JSON.parse(
    fs.readFileSync(getTestResourcePath('sources', version, 'tests', project, filename), 'utf-8'),
  );
}

export function loadTestCatalog(
  version: string,
  filename: string,
  project: string = 'jaffle_shop',
): unknown {
  return JSON.parse(
    fs.readFileSync(getTestResourcePath('catalog', version, 'tests', project, filename), 'utf-8'),
  );
}
