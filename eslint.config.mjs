import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import sonarjs from 'eslint-plugin-sonarjs';
import importPlugin from 'eslint-plugin-import';
import playwrightPlugin from 'eslint-plugin-playwright';
import eslintCommentsPlugin from '@eslint-community/eslint-plugin-eslint-comments';
import vitestPlugin from '@vitest/eslint-plugin';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

/** @type {import("@typescript-eslint/parser").ParserOptions} */
const tsProjectOptions = {
  ecmaVersion: 2022,
  sourceType: 'module',
  project: [
    './tsconfig.eslint.json',
    './packages/core/tsconfig.eslint.json',
    './packages/cli/tsconfig.eslint.json',
    './packages/mcp/tsconfig.eslint.json',
    './packages/web/tsconfig.eslint.json',
    './packages/web/tsconfig.node.json',
    './packages/web/tsconfig.e2e.json',
    './packages/test-fixtures/tsconfig.eslint.json',
  ],
};

const importResolverSettings = {
  'import/resolver': {
    typescript: {
      project: tsProjectOptions.project,
      alwaysTryTypes: true,
    },
    node: true,
  },
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
  // Security
  'no-eval': 'error',
  'no-implied-eval': 'error',
  'no-new-func': 'error',
  'prefer-const': 'error',
  'max-lines-per-function': ['error', { max: 280 }],
  'max-depth': ['error', { max: 6 }],
  'max-params': ['error', { max: 8 }],
  'max-nested-callbacks': ['error', { max: 4 }],
  // SonarJS
  'sonarjs/cyclomatic-complexity': ['error', { threshold: 15 }],
  'sonarjs/cognitive-complexity': ['error', 15],
  'sonarjs/no-duplicate-string': 'error',
  'sonarjs/prefer-immediate-return': 'error',
  'no-unreachable': 'error',
});

const sharedImportRules = {
  'import/no-cycle': 'error',
  // eslint-plugin-import does not understand the MCP SDK wildcard ESM exports with .js subpaths.
  'import/no-unresolved': ['error', { ignore: ['^@modelcontextprotocol/sdk/'] }],
  'import/no-useless-path-segments': 'error',
};

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-serve/**',
      '**/codeql-db/**',
      '**/resources/**',
      '.claude/**',
      '.cursor/**',
      '.serena/**',
      '.trunk/**',
      '**/*.generated.ts',
      '**/playwright-report/**',
      '**/test-results/**',
    ],
  },
  {
    plugins: {
      'eslint-comments': eslintCommentsPlugin,
    },
    rules: {
      'eslint-comments/no-unused-disable': 'error',
      'eslint-comments/disable-enable-pair': 'error',
    },
  },
  {
    files: [
      'packages/**/*.ts',
      'packages/**/*.tsx',
      'vitest.config.ts',
      'vitest.coverage.ts',
      'vitest.shared.ts',
    ],
    ignores: ['**/dist/**', '**/*.test.ts', '**/*.test.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ...tsProjectOptions,
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      sonarjs,
      import: importPlugin,
    },
    settings: importResolverSettings,
    rules: {
      ...sharedTsRules,
      ...sharedImportRules,
      '@typescript-eslint/no-unused-private-class-members': 'error',
    },
  },
  {
    files: ['packages/**/*.test.ts', 'packages/**/*.test.tsx'],
    ignores: ['**/dist/**'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ...tsProjectOptions,
        ecmaFeatures: { jsx: true },
      },
      globals: vitestPlugin.environments.env.globals,
    },
    plugins: {
      '@typescript-eslint': tseslint,
      sonarjs,
      import: importPlugin,
      ...vitestPlugin.configs.recommended.plugins,
    },
    settings: importResolverSettings,
    rules: {
      ...sharedTsRules,
      ...sharedImportRules,
      ...vitestPlugin.configs.recommended.rules,
      // Tests often repeat string literals and use conditional expects; keep signal without noise.
      'vitest/no-conditional-expect': 'off',
      'sonarjs/no-duplicate-string': 'off',
      'max-lines-per-function': ['error', { max: 700 }],
    },
  },
  {
    files: ['packages/web/e2e/**/*.spec.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ...tsProjectOptions,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      sonarjs,
      ...playwrightPlugin.configs['flat/recommended'].plugins,
      import: importPlugin,
    },
    settings: importResolverSettings,
    rules: {
      ...sharedTsRules,
      ...sharedImportRules,
      ...playwrightPlugin.configs['flat/recommended'].rules,
      // Long Playwright flows: relax structural limits without silencing security/type rules
      'playwright/prefer-web-first-assertions': 'off',
      'max-lines-per-function': ['error', { max: 400 }],
      'max-depth': ['error', { max: 10 }],
      'sonarjs/cognitive-complexity': ['error', 35],
      'sonarjs/cyclomatic-complexity': ['error', { threshold: 30 }],
      'max-nested-callbacks': ['error', { max: 8 }],
    },
  },
  {
    files: ['packages/web/**/*.tsx'],
    ignores: ['**/dist/**', '**/*.test.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ...tsProjectOptions,
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    settings: {
      react: { version: '18.3' },
    },
    rules: {
      ...reactPlugin.configs.flat.recommended.rules,
      ...reactPlugin.configs.flat['jsx-runtime'].rules,
      ...reactHooks.configs.flat.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      'react/prop-types': 'off',
      'react-hooks/exhaustive-deps': 'error',
      // Keep the migrated source baseline stable when newer react-hooks releases
      // add React Compiler rules beyond the source repository's lint contract.
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'max-lines': ['error', { max: 1200, skipBlankLines: true, skipComments: true }],
    },
  },
  /** @dbt-tools/web: cap non-test .ts modules (services, lib, workers, etc.) */
  {
    files: ['packages/web/src/**/*.ts'],
    ignores: ['**/dist/**', '**/*.test.ts'],
    rules: {
      'max-lines': ['error', { max: 1200, skipBlankLines: true, skipComments: true }],
    },
  },
  /** Stricter than web TSX default — agent churn hotspots (must follow looser blocks above) */
  {
    files: ['packages/web/src/components/**/*.{ts,tsx}', 'packages/web/src/hooks/**/*.{ts,tsx}'],
    rules: {
      'max-lines': ['error', { max: 900, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: [
      'packages/web/src/components/**/*.ts',
      'packages/web/src/components/**/*.tsx',
      'packages/web/src/hooks/**/*.ts',
      'packages/web/src/hooks/**/*.tsx',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@dbt-tools/core',
              message:
                'React hooks/components must stay on the web facade side of the boundary. Use web services or @dbt-tools/core/browser only in non-React layers.',
            },
            {
              name: '@dbt-tools/core/browser',
              importNames: [
                'ManifestGraph',
                'ExecutionAnalyzer',
                'detectBottlenecks',
                'buildAnalysisSnapshotFromArtifacts',
                'buildAnalysisSnapshotFromParsedArtifacts',
              ],
              message:
                'React hooks/components must not import graph/engine primitives directly. Go through the worker-backed analysis service.',
            },
          ],
        },
      ],
    },
  },
  /** @dbt-tools/web: keep analysis-workspace lib free of UI and worker graphs */
  {
    files: ['packages/web/src/lib/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@web/components/*', '@web/components/**/*'],
              message:
                'lib/analysis-workspace must not import UI components; keep domain logic UI-agnostic.',
            },
            {
              group: ['@web/workers/*', '@web/workers/**/*'],
              message: 'lib must not import Vite worker entrypoints.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/web/src/workers/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react',
              message: 'Workers must not import React.',
            },
            {
              name: 'react-dom',
              message: 'Workers must not import react-dom.',
            },
            {
              name: 'react/jsx-runtime',
              message: 'Workers must not import the JSX runtime.',
            },
            {
              name: '@dbt-tools/core',
              message:
                'Workers must import @dbt-tools/core/browser only (Node/fs APIs must not enter the worker bundle).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.js'],
    ignores: ['**/dist/**', '**/dist-serve/**', '**/node_modules/**'],
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
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
