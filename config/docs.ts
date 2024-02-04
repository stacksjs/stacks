import { SocialLinkIcon } from '@stacksjs/types'
import type { DocsConfig } from '@stacksjs/types'

const nav = [
  {
    text: 'Changelog',
    link: 'https://github.com/stacksjs/stacks/blob/main/CHANGELOG.md',
  },
  // { text: 'Blog', link: 'https://updates.ow3.org' },
  {
    text: 'Resources',
    items: [
      { text: 'Team', link: '/team' },
      { text: 'Postcardware', link: '/postcardware' },
      {
        items: [
          {
            text: 'Awesome Stacks',
            link: 'https://github.com/stacksjs/awesome-stacks',
          },
          {
            text: 'Contributing',
            link: 'https://github.com/stacksjs/stacks/blob/main/.github/CONTRIBUTING.md',
          },
        ],
      },
    ],
  },
]

const sidebar = {
  '/guide/': [
    {
      text: 'Getting Started',
      collapsible: true,
      items: [
        { text: 'Introduction', link: '/guide/intro' },
        { text: 'Quick Start', link: '/guide/get-started' },
      ],
    },

    {
      text: 'Bootcamp',
      collapsible: true,
      items: [
        { text: 'Welcome', link: '/bootcamp/intro' },
        {
          text: 'Let’s Build',
          collapsible: true,
          collapsed: true,
          items: [
            { text: 'Build a Frontend', link: '/bootcamp/frontend' },
            { text: 'Build an API', link: '/bootcamp/api' },
            { text: 'Build a Documentation', link: '/bootcamp/docs' },
            {
              text: 'Build a Library',
              collapsible: true,
              collapsed: true,
              items: [
                { text: 'Component Library', link: '/bootcamp/library/components' },
                { text: 'Function Library', link: '/bootcamp/library/functions' },
              ],
            },
            { text: 'Build a CLI', link: '/bootcamp/cli' },
            {
              text: 'Build a SaaS',
              collapsible: true,
              collapsed: true,
              items: [
                { text: 'Payments', link: '/bootcamp/saas/payments' },
                { text: 'Subscriptions', link: '/bootcamp/saas/subscriptions' },
                { text: 'License Key Management', link: '/bootcamp/saas/license-key-management' },
                { text: 'Digital Downloads', link: '/bootcamp/saas/digital-downloads' },
                { text: 'Checkout Form', link: '/bootcamp/saas/checkout-form' },
                { text: 'Referral Program', link: '/bootcamp/saas/referral-program' },
              ],
            },
            { text: 'Build a Desktop App', link: '/bootcamp/desktop' },
          ],
        },
        {
          text: 'How-To',
          collapsible: true,
          collapsed: true,
          items: [
            { text: 'Authentication', link: '/bootcamp/how-to/authentication' },
            { text: 'Create a Mailbox', link: '/bootcamp/how-to/create-mailbox' },
            { text: 'Define env & config values', link: '/bootcamp/how-to/env-config' },
            { text: 'Error Handling', link: '/bootcamp/how-to/error-handling' },
            { text: 'Extend the Cloud', link: '/bootcamp/how-to/extend-cloud' },
            { text: 'Extend the Dashboard', link: '/bootcamp/how-to/extend-dashboard' },
            { text: 'How to deploy?', link: '/bootcamp/how-to/deploy' },
            { text: 'IDE Setup', link: '/bootcamp/how-to/ide-setup' },
            { text: 'Manage a Team', link: '/bootcamp/how-to/manage-team' },
            { text: 'Publish Components & Functions', link: '/bootcamp/how-to/publish' },
            { text: 'Unit & Feature Tests', link: '/bootcamp/how-to/testing' },
          ],
        },
        {
          text: 'Tips',
          collapsible: true,
          collapsed: true,
          items: [
            { text: 'Cost Optimization', link: '/bootcamp/tips/cost-optimization' },
            { text: 'Email, SMS, Social & Push Notifications', link: '/bootcamp/tips/notifications' },
            { text: 'Jump Box', link: '/bootcamp/tips/jump-box' },
            { text: 'Limitations', link: '/bootcamp/tips/limitations' },
            { text: 'Payment sending, receiving & management', link: '/bootcamp/tips/payments' },
            { text: 'Remove your Cloud', link: '/bootcamp/tips/undeploy' },
            { text: 'Semantic Commits', link: '/bootcamp/tips/semantic-commits' },
            { text: 'Ship your ORM', link: '/bootcamp/tips/orm-usage' },
            { text: 'System Tray App', link: '/bootcamp/tips/system-tray' },
          ],
        },
        { text: 'Conclusion', link: '/bootcamp/conclusion' },
      ],
    },

    {
      text: 'Digging Deeper',
      collapsible: true,
      items: [
        { text: 'APIs', link: '/guide/apis' },
        { text: 'Apps', link: '/guide/apps' },
        { text: 'Authentication', link: '/guide/auth' },
        { text: 'Bootstrap', link: '/guide/bootstrap' },
        {
          text: 'Buddy',
          collapsible: true,
          collapsed: true,
          link: '/guide/buddy',
          items: [
            { text: 'Introduction', link: '/guide/buddy/intro' },
            { text: 'Dev', link: '/guide/buddy/dev' },
            { text: 'Build', link: '/guide/buddy/build' },
            { text: 'Fresh', link: '/guide/buddy/clean' },
            { text: 'Clean', link: '/guide/buddy/clean' },
            { text: 'Make', link: '/guide/buddy/make' },
            { text: 'Migrate', link: '/guide/buddy/migrate' },
            { text: 'Seed', link: '/guide/buddy/seed' },
            { text: 'Cloud', link: '/guide/buddy/cloud' },
            { text: 'Deploy', link: '/guide/buddy/Deploy' },
            { text: 'Commit', link: '/guide/buddy/commit' },
            { text: 'Lint', link: '/guide/buddy/make' },
            { text: 'Release', link: '/guide/buddy/release' },
            { text: 'Changelog', link: '/guide/buddy/changelog' },
            { text: 'HTTP', link: '/guide/buddy/http' },
            { text: 'DNS', link: '/guide/buddy/dns' },
            { text: 'Key', link: '/guide/buddy/key' },
            { text: 'Projects', link: '/guide/buddy/projects' }, // includes `buddy cd`
            { text: 'Domains', link: '/guide/buddy/domains' },
            { text: 'Generate', link: '/guide/buddy/generate' },
            { text: 'Test', link: '/guide/buddy/test' },
            { text: 'Upgrade', link: '/guide/buddy/upgrade' },
            { text: 'Version', link: '/guide/buddy/version' },
          ],
        },
        {
          text: 'Built-in Components',
          collapsible: true,
          collapsed: true,
          items: [
            { text: 'KeepAlive', link: '/guide/components/keep-alive' },
            { text: 'Suspense', link: '/guide/components/suspense' },
            { text: 'Table', link: '/guide/components/table' },
            { text: 'Teleport', link: '/guide/components/teleport' },
            { text: 'Transition', link: '/guide/components/transition' },
            { text: 'TransitionGroup', link: '/guide/components/transition-group' },
            // { text: 'Audio', link: '/guide/components/audio' },
            // { text: 'Calendar', link: '/guide/components/calendar' },
            // { text: 'CommandPalette', link: '/guide/components/command-palette' },
            // { text: 'Audio', link: '/guide/components/date-picker' },
            // { text: 'FileManager', link: '/guide/components/file-manager' },
            // { text: 'Image', link: '/guide/components/image' },
            // { text: 'Video', link: '/guide/components/video' },
          ],
        },
        { text: 'CI / CD', link: '/guide/ci' },
        { text: 'Cloud', link: '/guide/cloud' },
        { text: 'Custom Directives', link: '/guide/custom-directives' },
        { text: 'Dashboard', link: '/guide/dashboard' },
        {
          text: 'Libraries',
          collapsible: true,
          collapsed: true,
          items: [
            { text: 'Component Library', link: '/guide/libraries/components' },
            { text: 'Function Library', link: '/guide/libraries/functions' },
            { text: 'Composability', link: '/guide/libraries/composability' },
          ],
        },
        { text: 'Model-View-Action', link: '/guide/model-view-action' },
        { text: 'Plugins', link: '/guide/plugins' },
        { text: 'Testing', link: '/guide/testing' },
      ],
    },

    {
      text: 'Features',
      collapsible: true,
      collapsed: true,
      items: [
        { text: '$ Shell', link: '/features/$-shell' },
        { text: 'Actions', link: '/features/actions' },
        { text: 'AI', link: '/features/ai' },
        { text: 'Alias', link: '/features/alias' },
        { text: 'Analytics', link: '/features/analytics' },
        { text: 'Arrays', link: '/features/arrays' },
        { text: 'Auth', link: '/features/auth' },
        { text: 'Buddy', link: '/features/buddy' },
        { text: 'Build', link: '/features/build' },
        { text: 'Cache', link: '/features/cache' },
        { text: 'Chat', link: '/features/chat' },
        { text: 'CLI', link: '/features/cli' },
        { text: 'Cloud', link: '/features/cloud' },
        { text: 'Collections', link: '/features/collections' },
        { text: 'Config', link: '/features/config' },
        { text: 'Database', link: '/features/database' },
        { text: 'Datetime', link: '/features/datetime' },
        { text: 'Desktop', link: '/features/desktop' },
        { text: 'Development', link: '/features/development' },
        { text: 'DNS', link: '/features/dns' },
        { text: 'Docs', link: '/features/docs' },
        { text: 'Email', link: '/features/email' },
        { text: 'Env', link: '/features/env' },
        { text: 'Error Handling', link: '/features/error-handling' },
        { text: 'ESlint Config', link: '/features/error-handling' },
        { text: 'Events', link: '/features/events' },
        { text: 'Faker', link: '/features/faker' },
        { text: 'Git', link: '/features/git' },
        { text: 'Glob', link: '/features/glob' },
        { text: 'Health', link: '/features/health' },
        { text: 'Http', link: '/features/http' },
        { text: 'Lint', link: '/features/lint' },
        { text: 'Logging', link: '/features/logging' },
        { text: 'Modules', link: '/features/modules' },
        { text: 'Notifications', link: '/features/notifications' },
        { text: 'Objects', link: '/features/objects' },
        { text: 'ORM', link: '/features/orm' },
        { text: 'Path', link: '/features/path' },
        { text: 'Payments', link: '/features/payments' },
        { text: 'Permissions', link: '/features/permissions' },
        { text: 'Push', link: '/features/push' },
        { text: 'Query Builder', link: '/features/query-builder' },
        { text: 'Queue', link: '/features/queue' },
        { text: 'Realtime', link: '/features/realtime' },
        { text: 'REPL', link: '/features/repl' },
        { text: 'Router', link: '/features/router' },
        { text: 'Scheduler', link: '/features/scheduler' },
        { text: 'Search Engine', link: '/features/search-engine' },
        { text: 'Security', link: '/features/security' },
        { text: 'Semver', link: '/features/semver' },
        { text: 'Server', link: '/features/server' },
        { text: 'Signals', link: '/features/signals' },
        { text: 'Slug', link: '/features/slug' },
        { text: 'SMS', link: '/features/sms' },
        { text: 'Storage', link: '/features/storage' },
        { text: 'Strings', link: '/features/strings' },
        { text: 'Testing', link: '/features/testing' },
        { text: 'Tinker', link: '/features/tinker' },
        { text: 'Tunnel', link: '/features/tunnel' },
        { text: 'Types', link: '/features/types' },
        { text: 'UI', link: '/features/ui' },
        { text: 'Utils', link: '/features/utils' },
        { text: 'Validation', link: '/features/validation' },
        { text: 'Vite', link: '/features/vite' },
      ],
    },

    {
      text: 'Terminology',
      link: '/terminology',
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
  description: 'Rapid application, cloud & library development framework.',
  lastUpdated: true,

  themeConfig: {
    logo: 'https://raw.githubusercontent.com/stacksjs/stacks/main/public/logo-transparent.svg?https://raw.githubusercontent.com/stacksjs/stacks/main/public/logo-transparent.svg?asdas',

    nav,
    sidebar,

    editLink: {
      pattern: 'https://github.com/stacksjs/stacks/edit/main/docs/docs/:path',
      text: 'Edit this page on GitHub',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present Stacks.js, Inc.',
    },

    socialLinks: [
      { icon: SocialLinkIcon.Twitter, link: 'https://twitter.com/stacksjs' },
      { icon: SocialLinkIcon.GitHub, link: 'https://github.com/stacksjs/stacks' },
      { icon: SocialLinkIcon.Discord, link: 'https://discord.gg/stacksjs' },
    ],

    // algolia: services.algolia,

    // carbonAds: {
    //   code: '',
    //   placement: '',
    // },
  },
} satisfies DocsConfig
