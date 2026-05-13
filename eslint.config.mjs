import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import { flatConfigs as importXFlatConfigs } from 'eslint-plugin-import-x';
import sonarjs from 'eslint-plugin-sonarjs';
import security from 'eslint-plugin-security';
import unicorn from 'eslint-plugin-unicorn';
import vitestPlugin from '@vitest/eslint-plugin';

/** @type {import("@typescript-eslint/parser").ParserOptions} */
const tsParserOptions = {
  ecmaVersion: 2022,
  sourceType: 'module',
  projectService: true,
  tsconfigRootDir: import.meta.dirname,
};

/** Flat-config fragment from eslint-plugin-security (code-level patterns; complements Trivy/OSV). */
const securityRecommended = security.configs.recommended;

/**
 * import-x recommended + typescript resolver (uses `projectService` from parser; eslint-import-resolver-typescript installed for resolution).
 * Prettier stays canonical via Trunk — no @stylistic rules here.
 */
const importXPlugins = {
  ...importXFlatConfigs.recommended.plugins,
  ...importXFlatConfigs.typescript.plugins,
};

const importXSettings = {
  ...importXFlatConfigs.typescript.settings,
  'import-x/resolver': {
    typescript: {
      alwaysTryTypes: true,
      project: ['packages/*/tsconfig.json'],
    },
    node: true,
  },
};

const importXRules = {
  ...importXFlatConfigs.recommended.rules,
  ...importXFlatConfigs.typescript.rules,
  'import-x/order': [
    'error',
    {
      groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
      'newlines-between': 'always',
      alphabetize: { order: 'asc', caseInsensitive: true },
    },
  ],
  'import-x/no-cycle': ['error', { maxDepth: 3 }],
};

/**
 * Shared production + test rules (AI agent feedback).
 * Cyclomatic: only SonarJS (core `complexity` removed — duplicated sonarjs/cyclomatic-complexity).
 * Cognitive: sonarjs/cognitive-complexity (primary “hard to change” signal).
 * Structural: max-depth / max-params / max-nested-callbacks (catch wide APIs / deep nesting).
 */
const sharedTsRules = Object.assign({}, tseslint.configs.recommended.rules, {
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  '@typescript-eslint/no-floating-promises': 'error',
  '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: true } }],
  '@typescript-eslint/consistent-type-imports': [
    'error',
    { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
  ],
  // Security (core + plugin; Trunk still runs Trivy/OSV)
  'no-eval': 'error',
  'no-implied-eval': 'error',
  'no-new-func': 'error',
  'prefer-const': 'error',
  'max-lines-per-function': ['error', { max: 280 }],
  'max-depth': ['error', { max: 6 }],
  'max-params': ['error', { max: 8 }],
  'max-nested-callbacks': ['error', { max: 4 }],
  // SonarJS
  'sonarjs/cyclomatic-complexity': ['error', { threshold: 20 }],
  'sonarjs/cognitive-complexity': ['error', 20],
  'sonarjs/no-duplicate-string': 'error',
  'sonarjs/prefer-immediate-return': 'error',
  'no-unreachable': 'error',
});

const unicornFilenameCase = [
  'error',
  {
    cases: { kebabCase: true, pascalCase: true },
    ignore: [/^[\w-]+\.test\.ts$/],
  },
];

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-serve/**',
      '.claude/**',
      '.cursor/**',
      '.serena/**',
      '.trunk/**',
      '**/*.generated.ts',
    ],
  },
  {
    files: ['packages/**/*.ts', 'packages/**/*.tsx'],
    ignores: ['**/dist/**', '**/*.test.ts', '**/*.test.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ...tsParserOptions,
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      ...importXPlugins,
      ...securityRecommended.plugins,
      '@typescript-eslint': tseslint,
      sonarjs,
      unicorn,
    },
    settings: importXSettings,
    rules: {
      ...importXRules,
      ...securityRecommended.rules,
      ...sharedTsRules,
      '@typescript-eslint/no-unused-private-class-members': 'error',
      'unicorn/filename-case': unicornFilenameCase,
    },
  },
  {
    files: ['packages/**/*.test.ts', 'packages/**/*.test.tsx'],
    ignores: ['**/dist/**'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ...tsParserOptions,
        ecmaFeatures: { jsx: true },
      },
      globals: vitestPlugin.environments.env.globals,
    },
    plugins: {
      ...importXPlugins,
      ...securityRecommended.plugins,
      '@typescript-eslint': tseslint,
      sonarjs,
      unicorn,
      ...vitestPlugin.configs.recommended.plugins,
    },
    settings: importXSettings,
    rules: {
      ...importXRules,
      ...securityRecommended.rules,
      ...sharedTsRules,
      ...vitestPlugin.configs.recommended.rules,
      // Tests often repeat string literals and use conditional expects; keep signal without noise.
      'vitest/no-conditional-expect': 'off',
      'sonarjs/no-duplicate-string': 'off',
      'max-lines-per-function': ['error', { max: 700 }],
      'unicorn/filename-case': unicornFilenameCase,
    },
  },
  {
    files: ['**/*.js'],
    ignores: ['**/dist/**', '**/node_modules/**'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
      },
    },
    plugins: {
      ...securityRecommended.plugins,
    },
    rules: {
      ...securityRecommended.rules,
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
