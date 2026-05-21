/** @type {import('stylelint').Config} */
export default {
  // stylelint-config-prettier targets Stylelint <16 (stylistic rules removed in 16+); Standard v40 aligns with Sl 17.
  extends: ['stylelint-config-standard'],
  plugins: ['stylelint-declaration-strict-value'],
  ignoreFiles: [
    '**/dist/**',
    '**/node_modules/**',
    '**/coverage/**',
    '**/playwright-report/**',
    '**/test-results/**',
    // VitePress theme overrides third-party PascalCase selectors (VPHero, VPFeature, …).
    'docs/site/**',
  ],
  rules: {
    // App uses kebab-case blocks with BEM __element / --modifier; not literal single-segment kebab-case.
    'selector-class-pattern': [
      '^([a-z0-9]+(?:-[a-z0-9]+)*)(?:__[a-z0-9]+(?:-[a-z0-9]+)*)?(?:--[a-z0-9]+(?:-[a-z0-9]+)*)?$',
      { resolveNestedSelectors: true },
    ],
    // Intentional source order for cascade; reordering risks regressions (see src/styles/README.md).
    'no-descending-specificity': null,
    // Enforce design tokens for colors and radii — use var(--*) instead of raw values.
    'scale-unlimited/declaration-strict-value': [
      [
        'color',
        'background-color',
        'border-color',
        'border-top-color',
        'border-right-color',
        'border-bottom-color',
        'border-left-color',
        'outline-color',
        'fill',
        'stroke',
      ],
      {
        ignoreVariables: true,
        ignoreFunctions: true,
        ignoreValues: ['transparent', 'inherit', 'currentColor', 'none', 'initial', 'unset', '0'],
        message:
          'Expected variable or function for "${value}" of "${property}". Use a design token via var(--*). See .cursor/rules/design-tokens.mdc.',
      },
    ],
  },
};
