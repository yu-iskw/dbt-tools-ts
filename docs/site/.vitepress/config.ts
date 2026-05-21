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
      { text: 'Guide', link: '/guide/overview' },
      { text: 'Concepts', link: '/concepts/dbt-artifacts' },
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
        text: 'Foundations',
        items: [
          { text: 'Choose your interface', link: '/guide/overview' },
          { text: 'Ecosystem at a glance', link: '/guide/ecosystem' },
          { text: 'dbt Artifacts', link: '/concepts/dbt-artifacts' },
          { text: 'Local and remote artifacts', link: '/concepts/local-and-remote-artifacts' },
          { text: 'Discovery parity', link: '/concepts/discovery-parity' },
          {
            text: 'Operational Intelligence',
            link: '/concepts/operational-intelligence',
          },
        ],
      },
      {
        text: 'CLI',
        items: [
          { text: 'Getting started', link: '/guide/cli/getting-started' },
          { text: 'Common tasks', link: '/guide/cli/common-tasks' },
          {
            text: 'Workflows',
            collapsed: false,
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
            collapsed: false,
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
            collapsed: false,
            items: [{ text: 'Wire your coding agent', link: '/workflows/wire-your-coding-agent' }],
          },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'Configuration', link: '/reference/configuration' },
          { text: 'CLI cheatsheet', link: '/reference/cli-cheatsheet' },
          { text: 'Web server CLI', link: '/reference/web-cli' },
          { text: 'MCP tools', link: '/reference/mcp-tools' },
          { text: 'Deep links', link: '/reference/deep-links' },
          { text: 'Troubleshooting', link: '/reference/troubleshooting' },
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
