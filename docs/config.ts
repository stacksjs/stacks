import type { DocsConfig } from '@stacksjs/types'
import type { HeadConfig } from 'vitepress'
import { SocialLinkIcon } from '@stacksjs/types'
import analytics from '../config/analytics'

export const faviconHead: HeadConfig[] = [
  [
    'link',
    {
      rel: 'icon',
      href: 'https://raw.githubusercontent.com/stacksjs/stacks/main/public/logo-transparent.svg?https://raw.githubusercontent.com/stacksjs/stacks/main/public/logo-transparent.svg?asdas',
    },
  ],
]

export const googleAnalyticsHead: HeadConfig[] = [
  [
    'script',
    {
      async: '',
      src: `https://www.googletagmanager.com/gtag/js?id=${analytics.drivers?.googleAnalytics?.trackingId}`,
    },
  ],
  [
    'script',
    {},
    `window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'TAG_ID');`,
  ],
]

export const fathomAnalyticsHead: HeadConfig[] = [
  [
    'script',
    {
      'src': 'https://cdn.usefathom.com/script.js',
      'data-site': analytics.drivers?.fathom?.siteId || '',
      'defer': '',
    },
  ],
]

export const analyticsHead
  = analytics.driver === 'fathom'
    ? fathomAnalyticsHead
    : analytics.driver === 'google-analytics'
      ? googleAnalyticsHead
      : []

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
      { text: 'Sponsors', link: '/sponsors' },
      { text: 'Partners', link: '/partners' },
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
  '/': [
    {
      text: 'Prologue',
      collapsible: true,
      items: [
        { text: 'Release Notes', link: '/release-notes' },
        { text: 'Upgrade Guide', link: '/upgrade-guide' },
        { text: 'Contribution Guide', link: '/contribution-guide' },
        { text: 'Sponsors', link: '/sponsors' },
      ],
    },

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
        { text: 'Validation', link: '/packages/validation' },
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
          text: 'Let\'s Build',
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
                {
                  text: 'Component Library',
                  link: '/bootcamp/library/components',
                },
                {
                  text: 'Function Library',
                  link: '/bootcamp/library/functions',
                },
              ],
            },
            { text: 'Build a CLI', link: '/bootcamp/cli' },
            {
              text: 'Build a SaaS',
              collapsible: true,
              collapsed: true,
              items: [
                {
                  text: 'Team Management',
                  link: '/bootcamp/saas/team-management',
                },
                { text: 'Payments', link: '/bootcamp/saas/payments' },
                { text: 'Subscriptions', link: '/bootcamp/saas/subscriptions' },
                {
                  text: 'License Key Management',
                  link: '/bootcamp/saas/license-key-management',
                },
                {
                  text: 'Digital Downloads',
                  link: '/bootcamp/saas/digital-downloads',
                },
                { text: 'Checkout Form', link: '/bootcamp/saas/checkout-form' },
                {
                  text: 'Affiliates Program',
                  link: '/bootcamp/saas/affiliates-program',
                },
              ],
            },
            { text: 'Build a Desktop App', link: '/bootcamp/desktop' },
            { text: 'Build a System Tray App', link: '/bootcamp/system-tray' },
            { text: 'Build a Mobile App', link: '/bootcamp/mobile' },
          ],
        },
        {
          text: 'How-To',
          collapsible: true,
          collapsed: true,
          items: [
            { text: 'Authentication', link: '/bootcamp/how-to/authentication' },
            {
              text: 'Create a Mailbox',
              link: '/bootcamp/how-to/create-mailbox',
            },
            {
              text: 'Define env & config values',
              link: '/bootcamp/how-to/env-config',
            },
            { text: 'Error Handling', link: '/bootcamp/how-to/error-handling' },
            { text: 'Extend the Cloud', link: '/bootcamp/how-to/extend-cloud' },
            {
              text: 'Extend the Dashboard',
              link: '/bootcamp/how-to/extend-dashboard',
            },
            { text: 'How to deploy?', link: '/bootcamp/how-to/deploy' },
            { text: 'IDE Setup', link: '/bootcamp/how-to/ide-setup' },
            { text: 'Manage a Team', link: '/bootcamp/how-to/manage-team' },
            {
              text: 'Publish Components & Functions',
              link: '/bootcamp/how-to/publish',
            },
            { text: 'Unit & Feature Tests', link: '/bootcamp/how-to/testing' },
            {
              text: 'Review bun.lock Diff',
              link: '/bootcamp/how-to/bun-lockb',
            },
          ],
        },
        {
          text: 'Tips',
          collapsible: true,
          collapsed: true,
          items: [
            {
              text: 'Cost Optimization',
              link: '/bootcamp/tips/cost-optimization',
            },
            {
              text: 'Email, SMS, Social & Push Notifications',
              link: '/bootcamp/tips/notifications',
            },
            { text: 'Jump Box', link: '/bootcamp/tips/jump-box' },
            { text: 'Limitations', link: '/bootcamp/tips/limitations' },
            {
              text: 'Payment sending, receiving & management',
              link: '/bootcamp/tips/payments',
            },
            { text: 'Remove your Cloud', link: '/bootcamp/tips/undeploy' },
            {
              text: 'Semantic Commits',
              link: '/bootcamp/tips/semantic-commits',
            },
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
          text: 'Frontend',
          collapsible: true,
          collapsed: true,
          items: [
            // { text: 'Component Library', link: '/guide/libraries/components' },
            { text: 'Custom Directives', link: '/guide/custom-directives' },
            {
              text: 'Built-in Components',
              link: '/guide/components',
            },
          ],
        },

        {
          text: 'Backend',
          collapsible: true,
          collapsed: true,
          items: [
            { text: 'Authentication', link: '/guide/auth' },
            {
              text: 'Cache',
              collapsible: true,
              collapsed: true,
              items: [
                { text: 'Drivers', link: '/guide/cache/drivers' },
                { text: 'Build a Custom Driver', link: '/guide/cache/build-custom-driver' },
              ],
            },
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
            { text: 'Permissions', link: '/packages/permissions' },
            { text: 'Queue', link: '/packages/queue' },
            { text: 'Realtime', link: '/packages/realtime' },
            { text: 'Router', link: '/packages/router' },
            { text: 'Scheduler', link: '/packages/scheduler' },
            {
              text: 'Search Engine',
              collapsible: true,
              collapsed: true,
              items: [
                { text: 'Drivers', link: '/guide/search-engine/drivers' },
                { text: 'Build a Custom Driver', link: '/guide/search-engine/build-custom-driver' },
              ],
            },
            {
              text: 'Storage',
              collapsible: true,
              collapsed: true,
              items: [
                { text: 'Drivers', link: '/guide/storage/drivers' },
                { text: 'Build a Custom Driver', link: '/guide/storage/build-custom-driver' },
              ],
            },
            { text: 'Validation', link: '/packages/validation' },
          ],
        },

        {
          text: 'Cloud',
          collapsible: true,
          collapsed: true,
          items: [
            { text: 'Deploy', link: '/guide/cloud/deployment' },
            { text: 'Extend Cloud', link: '/guide/cloud/extend' },
          ],
        },

        {
          text: 'Library',
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
          text: 'CLI',
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
        { text: 'Dashboard', link: '/guide/dashboard' },
        { text: 'Model-View-Action', link: '/guide/model-view-action' },

        {
          text: 'Package Manager',
          link: '/guide/package-manager',
          collapsible: true,
          collapsed: true,
          items: [
            {
              text: '`buddy install`',
              link: '/guide/package-manager/buddy-install',
            },
            { text: '`buddy add`', link: '/guide/package-manager/buddy-add' },
            { text: '`buddy remove`', link: '/guide/package-manager/remove' },
            {
              text: '`buddy upgrade -pm`',
              link: '/guide/package-manager/upgrade',
            },
            { text: '`buddy link`', link: '/guide/package-manager/link' },
            {
              text: 'Global Cache',
              link: '/guide/package-manager/global-cache',
            },
            { text: 'Workspaces', link: '/guide/package-manager/workspaces' },
            {
              text: 'Lifecycle Scripts',
              link: '/guide/package-manager/lifecycle-scripts',
            },
            { text: 'Lockfile', link: '/guide/package-manager/lockfile' },
            {
              text: 'Overrides & Resolutions',
              link: '/guide/package-manager/overrides-resolutions',
            },
          ],
        },

        { text: 'Plugins', link: '/guide/plugins' },
        { text: 'System Tray', link: '/guide/system-tray' },
        { text: '$ Shell', link: '/guide/$-shell' },
      ],
    },

    {
      text: 'Components',
      collapsible: true,
      collapsed: true,
      items: [
        { text: 'Alert', link: '/guide/components/alert' },
        // { text: 'Audio', link: '/components/audio' },
        { text: 'Button', link: '/guide/components/button' },
        { text: 'Calendar', link: '/guide/components/calendar' },
        { text: 'Combobox', link: '/guide/components/combobox' },
        { text: 'Command Palette', link: '/guide/components/command-palette' },
        { text: 'Dialog', link: '/guide/components/dialog' },
        { text: 'Dropdown', link: '/guide/components/dropdown' },
        // { text: 'Image', link: '/components/image' },
        { text: 'Listbox', link: '/guide/components/listbox' },
        { text: 'Notification', link: '/guide/components/notification' },
        { text: 'Payment', link: '/guide/components/payment' },
        { text: 'Popover', link: '/guide/components/popover' },
        { text: 'Radio Group', link: '/guide/components/radio-group' },
        { text: 'Select', link: '/guide/components/select' },
        { text: 'Stepper', link: '/guide/components/stepper' },
        { text: 'Switch', link: '/guide/components/switch' },
        { text: 'Table', link: '/guide/components/table' },
        { text: 'Transition', link: '/guide/components/transition' },
        // { text: 'Video', link: '/components/video' },
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

        {
          text: 'Commerce',
          collapsible: true,
          collapsed: true,
          items: [
            { text: 'Coupons', link: '/guide/commerce/coupons' },
            { text: 'Customers', link: '/guide/commerce/customers' },
            {
              text: 'Deliveries',
              collapsible: true,
              collapsed: true,
              items: [
                { text: 'Delivery Routes', link: '/guide/commerce/deliveries/delivery-routes' },
                { text: 'Digital Deliveries', link: '/guide/commerce/deliveries/digital-deliveries' },
                { text: 'Drivers', link: '/guide/commerce/deliveries/drivers' },
                { text: 'License Keys', link: '/guide/commerce/deliveries/license-keys' },
                { text: 'Shipping Methods', link: '/guide/commerce/deliveries/shipping-methods' },
                { text: 'Shipping Rates', link: '/guide/commerce/deliveries/shipping-rates' },
                { text: 'Shipping Zones', link: '/guide/commerce/deliveries/shipping-zones' },
              ],
            },
            { text: 'Gift Cards', link: '/guide/commerce/gift-cards' },
            { text: 'Orders', link: '/guide/commerce/orders' },
            { text: 'Payments', link: '/guide/commerce/payments' },
            {
              text: 'Printers',
              collapsible: true,
              collapsed: true,
              items: [
                { text: 'Devices', link: '/guide/commerce/printers/devices' },
                { text: 'Receipts', link: '/guide/commerce/printers/receipts' },
              ],
            },
            {
              text: 'Products',
              collapsible: true,
              collapsed: true,
              items: [
                { text: 'Categories', link: '/guide/commerce/products/categories' },
                { text: 'Items', link: '/guide/commerce/products/items' },
                { text: 'Manufacturers', link: '/guide/commerce/products/manufacturers' },
                { text: 'Reviews', link: '/guide/commerce/products/reviews' },
                { text: 'Units', link: '/guide/commerce/products/units' },
                { text: 'Variants', link: '/guide/commerce/products/variants' },
              ],
            },
            { text: 'Taxes', link: '/guide/commerce/taxes' },
            {
              text: 'Waitlists',
              collapsible: true,
              collapsed: true,
              items: [
                { text: 'Products', link: '/guide/commerce/waitlists/products' },
                { text: 'Restaurants', link: '/guide/commerce/waitlists/restaurants' },
              ],
            },
          ],
        },

        {
          text: 'CMS',
          collapsible: true,
          collapsed: true,
          items: [
            { text: 'Dashboard', link: '/guide/cms/dashboard' },
            { text: 'Files', link: '/guide/cms/files' },
            { text: 'Pages', link: '/guide/cms/pages' },
            { text: 'Posts', link: '/guide/cms/posts' },
            { text: 'Categories', link: '/guide/cms/categories' },
            { text: 'Tags', link: '/guide/cms/tags' },
            { text: 'Comments', link: '/guide/cms/comments' },
            { text: 'Authors', link: '/guide/cms/authors' },
            { text: 'SEO', link: '/guide/cms/seo' },
          ],
        },

        { text: 'CLI', link: '/packages/cli' },
        { text: 'Cloud', link: '/packages/cloud' },
        { text: 'Commerce', link: '/packages/commerce' },
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
  'components/combobox': {
    text: 'Get Started',
    collapsed: false,
    items: [
      { text: 'Intro', link: '/components/combobox/' },
      { text: 'Install', link: '/components/combobox/install' },
      { text: 'Usage', link: '/components/combobox/usage' },
      { text: 'Demo', link: '/components/combobox/demo' },
    ],
  },
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
  base: '/',

  metaChunk: true,

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/images/logos/logo-mini.svg' }],
    ['link', { rel: 'icon', type: 'image/png', href: '/images/logos/logo.png' }],
    ['meta', { name: 'theme-color', content: '#1e40af' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:locale', content: 'en' }],
    ['meta', { property: 'og:title', content: 'Stacks | A better developer environment.' }],
    ['meta', { property: 'og:site_name', content: 'Stacks' }],
    ['meta', { property: 'og:image', content: 'https://stacksjs.org/images/og-image.png' }],
    ['meta', { property: 'og:url', content: 'https://stacksjs.org/' }],
    // ['script', { 'src': 'https://cdn.usefathom.com/script.js', 'data-site': '', 'data-spa': 'auto', 'defer': '' }],
    ...analyticsHead,
  ],

  themeConfig: {
    logo: '/images/logos/logo-transparent.svg',

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
      { icon: SocialLinkIcon.Bluesky, link: 'https://bsky.app/profile/chrisbreuer.dev' },
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
