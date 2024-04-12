import { SocialLinkIcon } from '@stacksjs/types'
import type { DocsConfig } from '@stacksjs/types'

const nav = [
  {
    text: 'Docs',
    link: '/guide/intro',
  },
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
      text: 'Basics',
      collapsible: true,
      // collapsed: true,
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
        { text: 'Validation', link: '/basics/validation' },
        { text: 'Error Handling', link: '/basics/error-handling' },
        { text: 'Logging', link: '/basics/logging' },
      ],
    },

    {
      text: 'Bootcamp',
      collapsible: true,
      collapsed: true,
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
                { text: 'Team Management', link: '/bootcamp/saas/team-management' },
                { text: 'Payments', link: '/bootcamp/saas/payments' },
                { text: 'Subscriptions', link: '/bootcamp/saas/subscriptions' },
                { text: 'License Key Management', link: '/bootcamp/saas/license-key-management' },
                { text: 'Digital Downloads', link: '/bootcamp/saas/digital-downloads' },
                { text: 'Checkout Form', link: '/bootcamp/saas/checkout-form' },
                { text: 'Affiliates Program', link: '/bootcamp/saas/affiliates-program' },
              ],
            },
            { text: 'Build a Desktop App', link: '/bootcamp/desktop' },
            // { text: 'Build a Mobile App', link: '/bootcamp/mobile' }, 👀
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
            { text: 'Review bun.lockb Diff', link: '/bootcamp/how-to/bun-lockb' },
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
            { text: 'Oh My Zsh', link: '/bootcamp/tips/oh-my-zsh' },
          ],
        },
        { text: 'Conclusion', link: '/bootcamp/conclusion' },
      ],
    },

    {
      text: 'Digging Deeper',
      collapsible: true,
      collapsed: true,
      items: [
        {
          text: 'Frontend Development',
          collapsible: true,
          collapsed: true,
          items: [
            // { text: 'Component Library', link: '/guide/libraries/components' },
            { text: 'Custom Directives', link: '/guide/custom-directives' },
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
            { text: 'Dashboard', link: '/guide/dashboard' },
            { text: 'System Tray', link: '/guide/system-tray' },
          ],
        },

        {
          text: 'Backend Development',
          collapsible: true,
          collapsed: true,
          items: [
            { text: 'Authentication', link: '/guide/auth' },
            { text: 'Cache', link: '/packages/cache' },
            { text: 'Database', link: '/packages/database' },
            { text: 'Error Handling', link: '/packages/error-handling' },
            { text: 'Events', link: '/packages/events' },
            { text: 'Logging', link: '/packages/logging' },
            { text: 'Middleware', link: '/guide/middleware' },
            {
              text: 'Notifications',
              link: '/packages/notifications',
              collapsible: true,
              collapsed: true,
              items: [
                { text: 'Chat', link: '/packages/chat' },
                { text: 'Email', link: '/packages/email' },
                { text: 'SMS', link: '/packages/sms' },
                { text: 'Push', link: '/packages/push' },
              ],
            },
            { text: 'Payments', link: '/packages/payments' },
            // { text: 'Permissions', link: '/packages/permissions' },
            { text: 'Queue', link: '/packages/queue' },
            // { text: 'Realtime', link: '/packages/realtime' },
            { text: 'Router', link: '/packages/router' },
            { text: 'Scheduler', link: '/packages/scheduler' },
            { text: 'Search Engine', link: '/packages/search-engine' },
            { text: 'Storage', link: '/packages/storage' },
            { text: 'Validation', link: '/packages/validation' },
          ],
        },

        {
          text: 'Cloud Development',
          collapsible: true,
          collapsed: true,
          items: [
            { text: 'Deploy', link: '/guide/cloud/deployment' },
            { text: 'Extend Cloud', link: '/guide/cloud/extend' },
          ],
        },

        {
          text: 'Library Development',
          collapsible: true,
          collapsed: true,
          items: [
            { text: 'Component Library', link: '/guide/libraries/components' },
            { text: 'Function Library', link: '/guide/libraries/functions' },
            { text: 'Composability', link: '/guide/libraries/composability' },
            { text: 'Publishing', link: '/guide/libraries/publishing' },
            { text: 'Versioning', link: '/guide/libraries/versioning' },
            { text: 'Testing', link: '/guide/libraries/testing' },
          ],
        },

        {
          text: 'CLI Development',
          collapsible: true,
          collapsed: true,
          items: [
            { text: 'Commands', link: '/guide/cli/commands' },
            { text: 'Binaries', link: '/guide/cli/binaries' },
            { text: 'Listeners', link: '/guide/cli/listeners' },
            { text: 'Logging', link: '/guide/cli/logs' },
            { text: 'Prompts', link: '/guide/cli/prompts' },
            { text: 'Testing', link: '/guide/cli/testing' },
          ],
        },

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
            { text: 'Deploy', link: '/guide/buddy/deploy' },
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

        { text: 'Bootstrap', link: '/guide/bootstrap' },
        { text: 'CI / CD', link: '/guide/ci' },
        { text: 'Model-View-Action', link: '/guide/model-view-action' },

        {
          text: 'Package Manager',
          link: '/guide/package-manager',
          collapsible: true,
          collapsed: true,
          items: [
            { text: '`buddy install`', link: '/guide/package-manager/buddy-install' },
            { text: '`buddy add`', link: '/guide/package-manager/buddy-add' },
            { text: '`buddy remove`', link: '/guide/package-manager/remove' },
            { text: '`buddy upgrade -pm`', link: '/guide/package-manager/upgrade' },
            { text: '`buddy link`', link: '/guide/package-manager/link' },
            { text: 'Global Cache', link: '/guide/package-manager/global-cache' },
            { text: 'Workspaces', link: '/guide/package-manager/workspaces' },
            { text: 'Lifecycle Scripts', link: '/guide/package-manager/lifecycle-scripts' },
            { text: 'Lockfile', link: '/guide/package-manager/lockfile' },
            { text: 'Overrides & Resolutions', link: '/guide/package-manager/overrides-resolutions' },
          ],
        },

        { text: 'Plugins', link: '/guide/plugins' },
        { text: '$ Shell', link: '/guide/$-shell' },
      ],
    },

    {
      text: 'Packages',
      collapsible: true,
      collapsed: true,
      items: [
        { text: 'Actions', link: '/packages/actions' },
        { text: 'AI', link: '/packages/ai' },
        { text: 'Alias', link: '/packages/alias' },
        { text: 'Analytics', link: '/packages/analytics' },
        { text: 'Arrays', link: '/packages/arrays' },
        { text: 'Auth', link: '/packages/auth' },
        { text: 'Buddy', link: '/packages/buddy' },
        { text: 'Build', link: '/packages/build' },
        { text: 'Cache', link: '/packages/cache' },
        { text: 'CLI', link: '/packages/cli' },
        { text: 'Cloud', link: '/packages/cloud' },
        { text: 'Collections', link: '/packages/collections' },
        { text: 'Config', link: '/packages/config' },
        { text: 'Database', link: '/packages/database' },
        { text: 'Datetime', link: '/packages/datetime' },
        { text: 'Desktop', link: '/packages/desktop' },
        { text: 'Development', link: '/packages/development' },
        { text: 'DNS', link: '/packages/dns' },
        { text: 'Docs', link: '/packages/docs' },
        { text: 'Env', link: '/packages/env' },
        { text: 'Error Handling', link: '/packages/error-handling' },
        { text: 'ESLint Config', link: '/packages/eslint-config' },
        { text: 'Events', link: '/packages/events' },
        { text: 'Faker', link: '/packages/faker' },
        { text: 'Git', link: '/packages/git' },
        { text: 'Glob', link: '/packages/glob' },
        { text: 'Health', link: '/packages/health' },
        { text: 'Http', link: '/packages/http' },
        { text: 'Lint', link: '/packages/lint' },
        { text: 'Logging', link: '/packages/logging' },
        { text: 'Modules', link: '/packages/modules' },
        {
          text: 'Notifications',
          link: '/packages/notifications',
          collapsible: true,
          collapsed: true,
          items: [
            { text: 'Chat', link: '/packages/chat' },
            { text: 'Email', link: '/packages/email' },
            { text: 'SMS', link: '/packages/sms' },
            { text: 'Push', link: '/packages/push' },
          ],
        },
        { text: 'Objects', link: '/packages/objects' },
        { text: 'ORM', link: '/packages/orm' },
        { text: 'Path', link: '/packages/path' },
        { text: 'Payments', link: '/packages/payments' },
        { text: 'Permissions', link: '/packages/permissions' },
        {
          text: 'Query Builder',
          link: '/packages/query-builder',
          collapsible: true,
          collapsed: true,
          items: [
            { text: 'Select', link: '/packages/query-builder/select' },
            { text: 'Where', link: '/packages/query-builder/where' },
            { text: 'Join', link: '/packages/query-builder/join' },
            { text: 'Insert', link: '/packages/insert' },
            { text: 'Update', link: '/packages/update' },
            { text: 'Delete', link: '/packages/delete' },
            { text: 'Transactions', link: '/packages/transcations' },
            { text: 'Recipes', link: '/packages/recipes' },
          ],
        },
        { text: 'Queue', link: '/packages/queue' },
        { text: 'Realtime', link: '/packages/realtime' },
        { text: 'REPL', link: '/packages/repl' },
        { text: 'Router', link: '/packages/router' },
        { text: 'Scheduler', link: '/packages/scheduler' },
        { text: 'Search Engine', link: '/packages/search-engine' },
        { text: 'Security', link: '/packages/security' },
        { text: 'Semver', link: '/packages/semver' },
        { text: 'Server', link: '/packages/server' },
        { text: 'Signals', link: '/packages/signals' },
        { text: 'Slug', link: '/packages/slug' },
        { text: 'Storage', link: '/packages/storage' },
        { text: 'Strings', link: '/packages/strings' },
        { text: 'Testing', link: '/packages/testing' },
        { text: 'Tinker', link: '/packages/tinker' },
        { text: 'Tunnel', link: '/packages/tunnel' },
        { text: 'Types', link: '/packages/types' },
        { text: 'UI', link: '/packages/ui' },
        { text: 'Utils', link: '/packages/utils' },
        { text: 'Validation', link: '/packages/validation' },
        { text: 'Vite', link: '/packages/vite' },
      ],
    },

    {
      text: 'Testing',
      collapsible: true,
      collapsed: true,
      items: [
        { text: 'Getting Started', link: '/testing/getting-started' },
        { text: 'Unit Tests', link: '/testing/unit-tests' },
        { text: 'Feature Tests', link: '/testing/feature-tests' },
        { text: 'Http Tests', link: '/testing/http-tests' },
        { text: 'Console Tests', link: '/testing/console-tests' },
        { text: 'Browser Tests', link: '/testing/browser-tests' },
        { text: 'Database', link: '/testing/database' },
        { text: 'Mocking', link: '/testing/mocking' },
      ],
    },

    {
      text: 'Project',
      collapsible: true,
      collapsed: true,
      items: [
        { text: 'Roadmap', link: '/project/roadmap' },
        { text: 'Contributing', link: '/project/contributing' },
        { text: 'Terminology', link: '/project/terminology' },
        { text: 'License', link: '/project/license' },
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
  description: 'Rapid application, cloud & library development framework.',
  lastUpdated: true,
  deploy: true,

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
