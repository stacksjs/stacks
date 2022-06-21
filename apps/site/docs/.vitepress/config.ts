import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'en-US',
  title: 'Stacks',
  description: 'Component-First. UI & Build Framework.',

  lastUpdated: true,

  themeConfig: {
    nav: nav(),

    sidebar: {
      '/guide/': sidebarGuide(),
      '/config/': sidebarConfig(),
    },

    editLink: {
      pattern: 'https://github.com/openwebstacks/stacks-framework/edit/main/apps/site/docs/:path',
      text: 'Edit this page on GitHub',
    },

    socialLinks: [
      { icon: 'twitter', link: 'https://twitter.com/ow3org' },
      { icon: 'github', link: 'https://github.com/openwebstacks/stacks-framework' },
      { icon: 'discord', link: 'https://twitter.com/ow3org' },
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2022-present Open Web Foundation',
    },

    algolia: {
      appId: '8J64VVRP8K',
      apiKey: 'a18e2f4cc5665f6602c5631fd868adfd',
      indexName: 'vitepress',
    },

    // carbonAds: {
    //     code: 'CEBDT27Y',
    //     placement: 'vuejsorg'
    // }
  },
})

function nav() {
  return [
    { text: 'Config', link: '/config', activeMatch: '/config' },
    {
      text: 'Changelog',
      link: 'https://github.com/openwebstacks/stacks-framework/blob/main/CHANGELOG.md',
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
        { text: 'Stacks', link: '/guide/stacks' },
        { text: 'Workflows / CI', link: '/guide/ci' },
        { text: 'VS Code', link: '/guide/vs-code' },
        { text: 'Apps', link: '/guide/apps' },
        { text: 'Examples', link: '/guide/examples' },
        { text: 'Packages', link: '/guide/packages' },
        { text: 'Playground', link: '/guide/playground' },
        { text: 'Testing', link: '/guide/testing' },
        { text: 'Single File Components', link: '/guide/sfcs' },
      ],
    },
  ]
}

function sidebarConfig() {
  return [
    {
      text: 'Config',
      items: [
        { text: 'Introduction', link: '/config/introduction' },
        { text: 'App Configs', link: '/config/app-configs' },
        { text: 'Theme Configs', link: '/config/theme-configs' },
        { text: 'Frontmatter Configs', link: '/config/frontmatter-configs' },
      ],
    },
  ]
}
