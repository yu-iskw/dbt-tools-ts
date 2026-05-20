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
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Concepts', link: '/concepts/dbt-artifacts' },
      { text: 'Reference', link: '/reference/configuration' },
      {
        text: 'Packages',
        items: [
          { text: '@dbt-tools/cli', link: '/guide/cli' },
          { text: '@dbt-tools/mcp', link: '/guide/mcp' },
          { text: '@dbt-tools/web', link: '/guide/web' },
        ],
      },
    ],
    sidebar: [
      {
        text: 'Start',
        items: [{ text: 'Getting Started', link: '/guide/getting-started' }],
      },
      {
        text: 'Packages',
        items: [
          { text: 'CLI', link: '/guide/cli' },
          { text: 'MCP', link: '/guide/mcp' },
          { text: 'Web', link: '/guide/web' },
        ],
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
