import type { DocsConfig } from '@stacksjs/types'

const nav = [
  { text: 'Config', link: '/config', activeMatch: '/config' },
  {
    text: 'Changelog',
    link: 'https://github.com/stacksjs/stacks/blob/main/CHANGELOG.md',
  },
  { text: 'Blog', link: 'https://updates.ow3.org' },
  {
    text: 'Resources',
    items: [
      { text: 'Team', link: '/team' },
      { text: 'Releases', link: '/releases' },
      {
        items: [
          {
            text: 'Twitter',
            link: 'https://twitter.com/vite_js',
          },
          {
            text: 'Discord Chat',
            link: 'https://chat.vitejs.dev',
          },
          {
            text: 'Awesome Vite',
            link: 'https://github.com/vitejs/awesome-vite',
          },
          {
            text: 'DEV Community',
            link: 'https://dev.to/t/vite',
          },
          {
            text: 'Rollup Plugins Compat',
            link: 'https://vite-rollup-plugins.patak.dev/',
          },
          {
            text: 'Changelog',
            link: 'https://github.com/vitejs/vite/blob/main/packages/vite/CHANGELOG.md',
          },
          {
            text: 'Contributing',
            link: 'https://github.com/vitejs/vite/blob/main/CONTRIBUTING.md',
          },
        ],
      },
    ],
  },
]

const sidebar = {
  '/guide/': [
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
        { text: 'APIs', link: '/guide/apis' },
        { text: 'Apps', link: '/guide/apps' },
        { text: 'Buddy', link: '/guide/buddy' },
        { text: 'CI / CD', link: '/guide/ci' },
        { text: 'Composability', link: '/guide/composability' },
        { text: 'Cloud', link: '/guide/cloud' },
        { text: 'Libraries', link: '/guide/libraries' },
        { text: 'Testing', link: '/guide/testing' },
      ],
    },
  ],
}

/**
 * **Documentation Options**
 *
 * This configuration defines all of your documentation options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  lang: 'en-US',
  title: 'Stacks',
  description: 'Rapid application, cloud & library framework.',
  lastUpdated: true,

  themeConfig: {
    nav,
    sidebar,

    editLink: {
      pattern: 'https://github.com/stacksjs/stacks/edit/main/docs/docs/:path',
      text: 'Edit this page on GitHub',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2023-present Stacks',
    },

    socialLinks: [
      { icon: 'twitter', link: 'https://twitter.com/stacksjs' },
      { icon: 'github', link: 'https://github.com/stacksjs/stacks' },
      { icon: 'discord', link: 'https://discord.gg/stacksjs' },
    ],

    // algolia: services.algolia,

    // carbonAds: {
    //   code: '',
    //   placement: '',
    // },
  },
} satisfies DocsConfig
