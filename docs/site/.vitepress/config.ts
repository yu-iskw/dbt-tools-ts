import { defineConfig } from 'vitepress';

export default defineConfig({
  vite: {
    // Monorepo esbuild override targets older browsers; VitePress needs modern output for dev and build.
    esbuild: { target: 'esnext' },
    build: { target: 'esnext' },
    optimizeDeps: {
      esbuildOptions: { target: 'esnext' },
    },
  },
  lang: 'en-US',
  title: 'dbt-tools',
  description:
    'Structured, deterministic operational intelligence for dbt artifacts, operators, and automation.',
  base: '/dbt-tools-ts/',
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ['meta', { name: 'theme-color', content: '#111827' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'dbt-tools' }],
    [
      'meta',
      {
        property: 'og:description',
        content:
          'Structured, deterministic operational intelligence for dbt artifacts, operators, and automation.',
      },
    ],
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
  ],
  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: 'Start Here', link: '/guide/quickstart' },
      { text: 'Recipes', link: '/recipes/' },
      { text: 'Deploy', link: '/deploy/' },
      { text: 'Trust & Safety', link: '/trust/' },
      { text: 'Reference', link: '/reference/configuration' },
      {
        text: 'Packages',
        items: [
          { text: '@dbt-tools/cli', link: '/guide/cli/getting-started' },
          { text: '@dbt-tools/mcp', link: '/guide/mcp/getting-started' },
          { text: '@dbt-tools/web', link: '/guide/web/getting-started' },
          { text: 'Agent skills', link: '/guide/agents/' },
        ],
      },
    ],
    sidebar: [
      {
        text: 'Start Here',
        items: [
          { text: '5-minute quickstart', link: '/guide/quickstart' },
          { text: 'Choose by goal', link: '/guide/choose-by-goal' },
          { text: 'Ecosystem at a glance', link: '/guide/ecosystem' },
          { text: 'Try with a sample project', link: '/guide/try-with-sample-project' },
        ],
      },
      {
        text: 'Foundations',
        items: [
          { text: 'New to dbt?', link: '/guide/foundations/new-to-dbt' },
          { text: 'dbt artifacts & target/', link: '/concepts/dbt-artifacts' },
        ],
      },
      {
        text: 'Recipes',
        collapsed: false,
        items: [
          { text: 'All recipes', link: '/recipes/' },
          { text: 'Debug a failed run', link: '/recipes/debug-failed-run' },
          { text: 'Investigate slow models', link: '/recipes/investigate-slow-models' },
          { text: 'Find model impact', link: '/recipes/find-model-impact' },
          { text: 'Generate CI health summary', link: '/recipes/generate-ci-health-summary' },
          { text: 'Open CLI result in Web', link: '/recipes/open-cli-result-in-web' },
          { text: 'Ask an agent about a dbt run', link: '/recipes/ask-agent-about-dbt-run' },
        ],
      },
      {
        text: 'Interfaces',
        items: [
          { text: 'Choose your interface', link: '/guide/overview' },
          { text: 'Workflows hub', link: '/workflows/' },
          {
            text: 'CLI',
            items: [
              { text: 'Getting started', link: '/guide/cli/getting-started' },
              { text: 'Common tasks', link: '/guide/cli/common-tasks' },
              {
                text: 'Workflows',
                collapsed: true,
                items: [
                  { text: 'Check run health', link: '/workflows/check-run-health' },
                  { text: 'Find a model', link: '/workflows/find-a-model' },
                  { text: 'Explain a failure', link: '/workflows/explain-failure' },
                ],
              },
            ],
          },
          {
            text: 'Web',
            items: [
              { text: 'Getting started', link: '/guide/web/getting-started' },
              { text: 'Investigation tour', link: '/guide/web/investigation-tour' },
              {
                text: 'Workflows',
                collapsed: true,
                items: [
                  { text: 'Investigate slow runs', link: '/workflows/investigate-slow-runs' },
                  { text: 'Open in web', link: '/workflows/open-in-web' },
                ],
              },
            ],
          },
          {
            text: 'MCP',
            items: [
              { text: 'Getting started', link: '/guide/mcp/getting-started' },
              { text: 'Connecting clients', link: '/guide/mcp/connecting-clients' },
            ],
          },
          {
            text: 'Agents',
            items: [
              { text: 'Overview', link: '/guide/agents/' },
              { text: 'Install agent skills', link: '/guide/agents/install' },
              { text: 'CLI vs MCP vs skills', link: '/guide/agents/cli-vs-mcp-vs-skills' },
              { text: 'Skill catalog', link: '/guide/agents/skill-catalog' },
              {
                text: 'Workflows',
                collapsed: true,
                items: [
                  { text: 'Wire your coding agent', link: '/workflows/wire-your-coding-agent' },
                ],
              },
            ],
          },
        ],
      },
      {
        text: 'Deploy',
        items: [
          { text: 'Overview', link: '/deploy/' },
          { text: 'Local target directory', link: '/deploy/local-target' },
          { text: 'S3', link: '/deploy/s3' },
          { text: 'GCS', link: '/deploy/gcs' },
          { text: 'GitHub Actions', link: '/deploy/github-actions' },
          { text: 'Credentials', link: '/deploy/credentials' },
        ],
      },
      {
        text: 'Trust & Safety',
        items: [
          { text: 'Overview', link: '/trust/' },
          { text: 'Data boundaries', link: '/trust/data-boundaries' },
          { text: 'Agent safety', link: '/trust/agent-safety' },
          { text: 'Production hardening', link: '/trust/production-hardening' },
          { text: 'Licensing', link: '/trust/licensing' },
        ],
      },
      {
        text: 'Concepts',
        items: [
          { text: 'Local and remote artifacts', link: '/concepts/local-and-remote-artifacts' },
          { text: 'Discovery parity', link: '/concepts/discovery-parity' },
          { text: 'Operational Intelligence', link: '/concepts/operational-intelligence' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'Configuration', link: '/reference/configuration' },
          { text: 'CLI cheatsheet', link: '/reference/cli-cheatsheet' },
          { text: 'Web server CLI', link: '/reference/web-cli' },
          { text: 'MCP tools', link: '/reference/mcp-tools' },
          { text: 'MCP resources', link: '/reference/mcp-resources' },
          { text: 'MCP prompts', link: '/reference/mcp-prompts' },
          { text: 'Deep links', link: '/reference/deep-links' },
          { text: 'Troubleshooting', link: '/reference/troubleshooting' },
          { text: 'Version compatibility', link: '/reference/version-compatibility' },
        ],
      },
    ],
    socialLinks: [
      {
        icon: 'github',
        link: 'https://github.com/yu-iskw/dbt-tools-ts',
      },
    ],
    search: {
      provider: 'local',
    },
    editLink: {
      pattern: 'https://github.com/yu-iskw/dbt-tools-ts/edit/main/docs/site/:path',
      text: 'Edit this page on GitHub',
    },
    footer: {
      message: 'Released under the repository license terms.',
      copyright: 'Copyright © yu-iskw',
    },
  },
});
