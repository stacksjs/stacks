import { type DocsConfig } from '@stacksjs/types'
import { frameworkPath } from '@stacksjs/path'
import services from './services'

/**
 * **Documentation Options**
 *
 * This configuration defines all of your documentation options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default <DocsConfig> {
  vite: {
    root: frameworkPath('docs'),
  },
  outDir: frameworkPath('docs/dist'),
  lang: 'en-US',
  title: 'Stacks',
  description: 'Composability-First. UI/FX Framework.',
  lastUpdated: true,

  themeConfig: {
    nav: nav(),

    sidebar: {
      '/guide/': sidebarGuide(),
    },

    editLink: {
      pattern: 'https://github.com/stacksjs/stacks/edit/main/docs/docs/:path',
      text: 'Edit this page on GitHub',
    },

    socialLinks: [
      { icon: 'twitter', link: 'https://twitter.com/stacksjs' },
      { icon: 'github', link: 'https://github.com/stacksjs/stacks' },
      { icon: 'discord', link: 'https://discord.com/' },
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2022-present Open Web Foundation',
    },

    algolia: services.algolia,

    carbonAds: {
      code: '',
      placement: '',
    },
  },
}

function nav() {
  return [
    { text: 'Config', link: '/config', activeMatch: '/config' },
    {
      text: 'Changelog',
      link: 'https://github.com/stacksjs/stacks/blob/main/CHANGELOG.md',
    },
    { text: 'Blog', link: 'https://updates.ow3.org' },
  ]
}

function sidebarGuide() {
  return [
    {
      text: 'Introduction',
      collapsible: true,
      items: [
        { text: 'What is Stacks?', link: '/guide/what-is-stacks' },
        { text: 'Getting Started', link: '/guide/getting-started' },
        { text: 'Configuration', link: '/guide/config' },
      ],
    },
    {
      text: 'Digging Deeper',
      collapsible: true,
      items: [
        { text: 'How To?', link: '/guide/stacks' },
        { text: 'Workflows / CI', link: '/guide/ci' },
        { text: 'VS Code', link: '/guide/vs-code' },
        { text: 'Apps', link: '/guide/apps' },
        { text: 'Examples', link: '/guide/examples' },
        { text: 'Packages', link: '/guide/packages' },
        { text: 'Testing', link: '/guide/testing' },
        { text: 'Single File Components', link: '/guide/sfcs' },
      ],
    },
    {
      text: 'Starters',
      collapsible: true,
      items: [
        { text: 'Vue Starter', link: '/starter/vue' },
        { text: 'Web Component Starter', link: '/starter/web-components' },
        { text: 'Composable Starter', link: '/starter/web-components' },
        { text: 'TypeScript Starter', link: '/starter/web-components' },
      ],
    },
  ]
}
