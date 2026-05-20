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
          { text: 'Agents (plugins)', link: '/guide/agents/' },
        ],
      },
    ],
    sidebar: [
      {
        text: 'Start',
        items: [{ text: 'Choose your interface', link: '/guide/overview' }],
      },
      {
        text: 'CLI',
        items: [{ text: 'Getting started', link: '/guide/cli/getting-started' }],
      },
      {
        text: 'MCP',
        items: [{ text: 'Getting started', link: '/guide/mcp/getting-started' }],
      },
      {
        text: 'Web',
        items: [{ text: 'Getting started', link: '/guide/web/getting-started' }],
      },
      {
        text: 'Agents',
        items: [{ text: 'Plugins (coming soon)', link: '/guide/agents/' }],
      },
      {
        text: 'Concepts',
        items: [
          { text: 'dbt Artifacts', link: '/concepts/dbt-artifacts' },
          {
            text: 'Operational Intelligence',
            link: '/concepts/operational-intelligence',
          },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'Configuration', link: '/reference/configuration' },
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
