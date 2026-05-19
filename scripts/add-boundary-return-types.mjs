#!/usr/bin/env node
/**
 * Add explicit return types to exported functions missing them (eslint explicit-module-boundary-types).
 */

import ts from 'typescript';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const formatHost = {
  getCurrentDirectory: () => repoRoot,
  getCanonicalFileName: (f) => f,
  getNewLine: () => '\n',
};

/** @param {string} filePath */
function resolveTsConfigForFile(filePath) {
  const rel = relative(repoRoot, filePath);
  if (rel.startsWith('packages/web/')) {
    return join(repoRoot, 'packages/web/tsconfig.json');
  }
  if (rel.startsWith('packages/core/')) {
    return join(repoRoot, 'packages/core/tsconfig.json');
  }
  if (rel.startsWith('packages/cli/')) {
    return join(repoRoot, 'packages/cli/tsconfig.json');
  }
  if (rel.startsWith('packages/mcp/')) {
    return join(repoRoot, 'packages/mcp/tsconfig.json');
  }
  if (rel.startsWith('packages/test-fixtures/')) {
    return join(repoRoot, 'packages/test-fixtures/tsconfig.json');
  }
  return join(repoRoot, 'tsconfig.eslint.json');
}

/** @param {ts.Node} node */
function isExported(node) {
  if (ts.canHaveModifiers(node)) {
    const mods = ts.getModifiers(node);
    if (mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) return true;
  }
  const parent = node.parent;
  if (parent && ts.isVariableStatement(parent)) {
    const mods = ts.getModifiers(parent);
    return Boolean(mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword));
  }
  return false;
}

/**
 * @param {ts.FunctionLikeDeclaration} node
 * @param {ts.SourceFile} sourceFile
 */
function returnTypeInsertPosition(node, sourceFile) {
  if (ts.isArrowFunction(node)) {
    return node.equalsToken?.pos ?? node.body.pos;
  }
  if (node.body) {
    return node.body.getStart(sourceFile);
  }
  return node.end;
}

/** @param {string} filePath */
function addReturnTypes(filePath) {
  const configPath = resolveTsConfigForFile(filePath);
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error) {
    throw new Error(ts.formatDiagnostic(configFile.error, formatHost));
  }
  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    dirname(configPath),
    undefined,
    configPath,
  );
  const program = ts.createProgram({
    rootNames: [filePath],
    options: { ...parsed.options, noEmit: true },
  });
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(filePath);
  if (!sourceFile) return false;

  const isTsx = filePath.endsWith('.tsx');
  const edits = [];

  /** @param {ts.Node} node */
  function visit(node) {
    const fn = getExportedFunctionLike(node);
    if (
      fn &&
      fn.body &&
      !fn.type &&
      isExported(fn.parent && ts.isVariableDeclaration(fn) ? fn.parent.parent : fn)
    ) {
      const signature = checker.getSignatureFromDeclaration(fn);
      const returnType = signature ? checker.getReturnTypeOfSignature(signature) : undefined;
      let typeText = returnType
        ? checker.typeToString(returnType, fn, ts.TypeFormatFlags.NoTruncation)
        : isTsx
          ? 'ReactElement'
          : 'void';

      if (typeText === 'any' && isTsx) typeText = 'ReactElement';
      if (typeText.includes('\n') || typeText.length > 120) {
        typeText = isTsx ? 'ReactElement' : 'void';
      }

      const pos = returnTypeInsertPosition(fn, sourceFile);
      edits.push({
        pos,
        text: `: ${typeText} `,
        needsReactType: typeText === 'ReactElement' && isTsx,
      });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  if (edits.length === 0) return false;

  edits.sort((a, b) => b.pos - a.pos);
  let content = sourceFile.getFullText();
  for (const { pos, text } of edits) {
    content = content.slice(0, pos) + text + content.slice(pos);
  }

  if (
    edits.some((e) => e.needsReactType) &&
    !/\bReactElement\b/.test(content.split('\n').slice(0, 30).join('\n'))
  ) {
    if (/from ['"]react['"]/.test(content)) {
      content = content.replace(
        /import\s+(\{)([^}]*)(\})\s+from\s+['"]react['"]/,
        (_, open, bindings, close) => {
          if (bindings.includes('ReactElement'))
            return `import ${open}${bindings}${close} from 'react'`;
          return `import ${open}type { ReactElement },${bindings}${close} from 'react'`;
        },
      );
    } else {
      content = `import type { ReactElement } from 'react';\n${content}`;
    }
  }

  writeFileSync(filePath, content);
  return true;
}

/** @param {ts.Node} node */
function getExportedFunctionLike(node) {
  if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
    return node;
  }
  if (ts.isVariableDeclaration(node) && node.initializer) {
    const init = node.initializer;
    if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) return init;
  }
  return undefined;
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: node scripts/add-boundary-return-types.mjs <file>...');
  process.exit(1);
}

let updated = 0;
for (const file of files) {
  const abs = file.startsWith('/') ? file : join(repoRoot, file);
  try {
    if (addReturnTypes(abs)) {
      updated += 1;
      console.log('updated', relative(repoRoot, abs));
    }
  } catch (err) {
    console.error('failed', file, err.message);
  }
}
console.log(`Done: ${updated}/${files.length} files`);
