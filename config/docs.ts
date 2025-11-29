import type { BunPressOptions } from '@stacksjs/bunpress'

const config: BunPressOptions = {
  verbose: true,
  docsDir: './docs',
  outDir: './dist/docs',

  // Navigation
  nav: [
    {
      text: 'Changelog',
      link: 'https://github.com/stacksjs/stacks/blob/main/CHANGELOG.md',
    },
    {
      text: 'Resources',
      items: [
        { text: 'Team', link: '/team' },
        { text: 'Sponsors', link: '/sponsors' },
        { text: 'Partners', link: '/partners' },
        { text: 'Postcardware', link: '/postcardware' },
        { text: 'Awesome Stacks', link: 'https://github.com/stacksjs/awesome-stacks' },
        { text: 'Contributing', link: 'https://github.com/stacksjs/stacks/blob/main/.github/CONTRIBUTING.md' },
      ],
    },
  ],

  // Markdown configuration
  markdown: {
    title: 'Stacks Documentation',
    meta: {
      description: 'Rapid application, cloud & library development framework.',
      author: 'Stacks.js',
    },
    syntaxHighlightTheme: 'github-dark',
    toc: {
      enabled: true,
      minDepth: 2,
      maxDepth: 3,
    },
    sidebar: {
      '/': [
        {
          text: 'Prologue',
          collapsed: true,
          items: [
            { text: 'Release Notes', link: '/release-notes' },
            { text: 'Upgrade Guide', link: '/upgrade-guide' },
            { text: 'Contribution Guide', link: '/contribution-guide' },
            { text: 'Sponsors', link: '/sponsors' },
          ],
        },
        {
          text: 'Getting Started',
          collapsed: true,
          items: [
            { text: 'Introduction', link: '/guide/intro' },
            { text: 'Quick Start', link: '/guide/get-started' },
          ],
        },
        {
          text: 'Basics',
          collapsed: true,
          items: [
            { text: 'Routing', link: '/basics/routing' },
            { text: 'Middleware', link: '/basics/middleware' },
            { text: 'Models', link: '/basics/models' },
            { text: 'Views', link: '/basics/views' },
            { text: 'Actions', link: '/basics/actions' },
            { text: 'Commands', link: '/basics/commands' },
            { text: 'Jobs', link: '/basics/jobs' },
            { text: 'Components', link: '/basics/components' },
            { text: 'Functions', link: '/basics/functions' },
            { text: 'Validation', link: '/packages/validation' },
            { text: 'Error Handling', link: '/basics/error-handling' },
            { text: 'Logging', link: '/basics/logging' },
          ],
        },
        {
          text: 'Digging Deeper',
          collapsed: true,
          items: [
            { text: 'Authentication', link: '/guide/auth' },
            { text: 'Database', link: '/packages/database' },
            { text: 'Cache', link: '/packages/cache' },
            { text: 'Events', link: '/packages/events' },
            { text: 'Queue', link: '/packages/queue' },
            { text: 'Notifications', link: '/packages/notifications' },
            { text: 'Payments', link: '/packages/payments' },
            { text: 'Realtime', link: '/packages/realtime' },
            { text: 'Search Engine', link: '/packages/search-engine' },
            { text: 'Storage', link: '/packages/storage' },
          ],
        },
        {
          text: 'Cloud',
          collapsed: true,
          items: [
            { text: 'Deploy', link: '/guide/cloud/deployment' },
            { text: 'Extend Cloud', link: '/guide/cloud/extend' },
          ],
        },
        {
          text: 'CLI (Buddy)',
          collapsed: true,
          items: [
            { text: 'Introduction', link: '/guide/buddy/intro' },
            { text: 'Dev', link: '/guide/buddy/dev' },
            { text: 'Build', link: '/guide/buddy/build' },
            { text: 'Deploy', link: '/guide/buddy/deploy' },
            { text: 'Make', link: '/guide/buddy/make' },
            { text: 'Migrate', link: '/guide/buddy/migrate' },
            { text: 'Test', link: '/guide/buddy/test' },
          ],
        },
        {
          text: 'Packages',
          collapsed: true,
          items: [
            { text: 'Actions', link: '/packages/actions' },
            { text: 'AI', link: '/packages/ai' },
            { text: 'Auth', link: '/packages/auth' },
            { text: 'Cache', link: '/packages/cache' },
            { text: 'CLI', link: '/packages/cli' },
            { text: 'Cloud', link: '/packages/cloud' },
            { text: 'Database', link: '/packages/database' },
            { text: 'ORM', link: '/packages/orm' },
            { text: 'Query Builder', link: '/packages/query-builder' },
            { text: 'Router', link: '/packages/router' },
            { text: 'Testing', link: '/packages/testing' },
            { text: 'Validation', link: '/packages/validation' },
          ],
        },
        {
          text: 'Testing',
          collapsed: true,
          items: [
            { text: 'Getting Started', link: '/testing/getting-started' },
            { text: 'Unit Tests', link: '/testing/unit-tests' },
            { text: 'Feature Tests', link: '/testing/feature-tests' },
            { text: 'Http Tests', link: '/testing/http-tests' },
            { text: 'Browser Tests', link: '/testing/browser-tests' },
          ],
        },
        {
          text: 'Project',
          collapsed: true,
          items: [
            { text: 'Roadmap', link: '/project/roadmap' },
            { text: 'Contributing', link: '/project/contributing' },
            { text: 'License', link: '/project/license' },
          ],
        },
      ],
    },
    themeConfig: {
      logo: '/images/logos/logo-transparent.svg',
      footer: {
        message: 'Released under the MIT License.',
        copyright: 'Copyright 2024-present Stacks.js, Inc.',
      },
      socialLinks: [
        { icon: 'twitter', link: 'https://twitter.com/stacksjs' },
        { icon: 'github', link: 'https://github.com/stacksjs/stacks' },
        { icon: 'discord', link: 'https://discord.gg/stacksjs' },
      ],
    },
  },

  // SEO Configuration
  sitemap: {
    enabled: true,
    baseUrl: 'https://stacksjs.com/docs',
  },

  robots: {
    enabled: true,
  },
}

export default config
