import { join } from 'node:path';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import { flatConfigs as importXFlatConfigs } from 'eslint-plugin-import-x';
import sonarjs from 'eslint-plugin-sonarjs';
import security from 'eslint-plugin-security';
import unicorn from 'eslint-plugin-unicorn';
import playwrightPlugin from 'eslint-plugin-playwright';
import eslintCommentsPlugin from '@eslint-community/eslint-plugin-eslint-comments';
import vitestPlugin from '@vitest/eslint-plugin';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

const repoRoot = import.meta.dirname;

/** @type {import("@typescript-eslint/parser").ParserOptions} */
const tsParserOptions = {
  ecmaVersion: 2022,
  sourceType: 'module',
  projectService: {
    allowDefaultProject: ['packages/*/coverage.policy.ts', 'packages/core/coverage.policy.d.ts'],
  },
  tsconfigRootDir: repoRoot,
};

const webPackageRoot = join(repoRoot, 'packages/web');

const webImportXSettings = {
  ...importXFlatConfigs.typescript.settings,
  'import-x/resolver': {
    typescript: {
      alwaysTryTypes: true,
      project: [
        join(webPackageRoot, 'tsconfig.json'),
        join(webPackageRoot, 'tsconfig.node.json'),
        join(webPackageRoot, 'tsconfig.e2e.json'),
        join(webPackageRoot, 'tsconfig.eslint.json'),
      ],
    },
    node: true,
  },
};

/** Flat-config fragment from eslint-plugin-security (code-level patterns; complements Trivy/OSV). */
const securityRecommended = security.configs.recommended;

const importXPlugins = {
  ...importXFlatConfigs.recommended.plugins,
  ...importXFlatConfigs.typescript.plugins,
};

const importXSettings = {
  ...importXFlatConfigs.typescript.settings,
  'import-x/resolver': {
    typescript: {
      alwaysTryTypes: true,
      project: [
        'packages/*/tsconfig.json',
        'packages/*/tsconfig.eslint.json',
        'packages/web/tsconfig.node.json',
        'packages/web/tsconfig.e2e.json',
        'packages/test-fixtures/tsconfig.json',
      ],
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
      pathGroups: [
        {
          pattern: '@web/**',
          group: 'internal',
          position: 'after',
        },
      ],
      pathGroupsExcludedImportTypes: ['type'],
      'newlines-between': 'always',
      alphabetize: { order: 'asc', caseInsensitive: true },
    },
  ],
  'import-x/no-cycle': ['error', { maxDepth: 3 }],
  // import-x does not understand MCP SDK wildcard ESM exports (v1 subpaths and v2 package roots).
  'import-x/no-unresolved': [
    'error',
    {
      ignore: ['^@modelcontextprotocol/(sdk|server|client|core)(/|$)', '\\.js$'],
    },
  ],
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
    // inline-type-imports keeps one import per module (import-x/no-duplicates).
    { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
  ],
  '@typescript-eslint/explicit-module-boundary-types': 'error',
  '@typescript-eslint/sort-type-constituents': 'error',
  // Security (core + plugin; Trunk still runs Trivy/OSV)
  'no-eval': 'error',
  'no-implied-eval': 'error',
  'no-new-func': 'error',
  'prefer-const': 'error',
  'max-lines-per-function': ['error', { max: 280 }],
  'max-depth': ['error', { max: 6 }],
  'max-params': ['error', { max: 8 }],
  'max-nested-callbacks': ['error', { max: 4 }],
  // SonarJS (stricter than google-cloud-tools baseline: 15 vs 20)
  'sonarjs/cyclomatic-complexity': ['error', { threshold: 15 }],
  'sonarjs/cognitive-complexity': ['error', 15],
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

const tsProductionPlugins = {
  ...importXPlugins,
  ...securityRecommended.plugins,
  '@typescript-eslint': tseslint,
  sonarjs,
  unicorn,
};

const tsProductionRules = {
  ...importXRules,
  ...securityRecommended.rules,
  ...sharedTsRules,
  '@typescript-eslint/no-unused-private-class-members': 'error',
  'unicorn/filename-case': unicornFilenameCase,
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
      'docs/site/.vitepress/cache/**',
      'docs/site/.vitepress/dist/**',
      '**/vitest.config.ts',
      'vitest.config.ts',
      'vitest.coverage.ts',
      'vitest.shared.ts',
      '**/coverage.policy.ts',
      '**/coverage.policy.d.ts',
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
    files: ['docs/site/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    plugins: {
      ...securityRecommended.plugins,
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...securityRecommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
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
    plugins: tsProductionPlugins,
    settings: importXSettings,
    rules: tsProductionRules,
  },
  {
    files: ['packages/web/**/*.ts', 'packages/web/**/*.tsx'],
    ignores: ['**/dist/**', '**/*.test.ts', '**/*.test.tsx'],
    languageOptions: {
      parserOptions: {
        ...tsParserOptions,
        tsconfigRootDir: webPackageRoot,
        ecmaFeatures: { jsx: true },
      },
    },
    settings: webImportXSettings,
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
      ...tsProductionPlugins,
      ...vitestPlugin.configs.recommended.plugins,
    },
    settings: importXSettings,
    rules: {
      ...tsProductionRules,
      ...vitestPlugin.configs.recommended.rules,
      // Tests often repeat string literals and use conditional expects; keep signal without noise.
      'vitest/no-conditional-expect': 'off',
      'sonarjs/no-duplicate-string': 'off',
      'max-lines-per-function': ['error', { max: 700 }],
    },
  },
  {
    files: ['packages/web/**/*.test.ts', 'packages/web/**/*.test.tsx'],
    languageOptions: {
      parserOptions: {
        ...tsParserOptions,
        tsconfigRootDir: webPackageRoot,
        ecmaFeatures: { jsx: true },
      },
    },
    settings: webImportXSettings,
  },
  {
    files: ['packages/web/e2e/**/*.spec.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ...tsParserOptions,
        tsconfigRootDir: webPackageRoot,
      },
    },
    plugins: {
      ...tsProductionPlugins,
      ...playwrightPlugin.configs['flat/recommended'].plugins,
    },
    settings: webImportXSettings,
    rules: {
      ...tsProductionRules,
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
        ...tsParserOptions,
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
  /** @dbt-tools/core: pure input contracts (RFC-0001 §4.2) */
  {
    files: [
      'packages/core/src/contracts/search-resources-input.ts',
      'packages/core/src/contracts/get-resource-input.ts',
      'packages/core/src/contracts/dependency-query-input.ts',
      'packages/core/src/contracts/empty-input.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*', '../**/*', '@dbt-tools/core', '@dbt-tools/core/*'],
              message: 'contracts/ must depend on zod only; no domain or node imports.',
            },
            {
              group: ['node:*'],
              message: 'contracts/ must not import Node built-ins.',
            },
          ],
        },
      ],
    },
  },
  /** @dbt-tools/core: usecases/ pure layer — no node I/O */
  {
    files: ['packages/core/src/usecases/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['node:*', '../io/*', '../io/**', '../config/*', '../config/**'],
              message: 'usecases/ must stay pure; import domain and contracts only.',
            },
          ],
        },
      ],
    },
  },
  /** @dbt-tools/core: browser facade must not pull Node I/O */
  {
    files: ['packages/core/src/browser.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                './io/*',
                './io/**',
                './config/*',
                './config/**',
                './artifact-workspace/*',
                './node/*',
                './node/**',
              ],
              message: 'browser entry must not import Node I/O or workspace modules.',
            },
            {
              group: ['node:*'],
              message: 'browser entry must not import Node built-ins.',
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
    plugins: {
      ...securityRecommended.plugins,
    },
    rules: {
      ...securityRecommended.rules,
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
