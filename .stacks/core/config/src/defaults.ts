import type { StacksConfig } from '@stacksjs/types'
import { path as p } from '@stacksjs/path'
// import { userConfig as overrides } from './overrides'

const nav = [
  { text: 'Config', link: '/config', activeMatch: '/config' },
  {
    text: 'Changelog',
    link: 'https://github.com/stacksjs/stacks/blob/main/CHANGELOG.md',
  },
  { text: 'Blog', link: 'https://updates.ow3.org' },
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

export const defaults: StacksConfig = {
  app: {
    name: 'Stacks',
    env: 'local',
    url: 'stacks.test',
    subdomains: {
      docs: 'docs',
      api: 'api',
    },
    debug: true,
    key: '',
    timezone: 'UTC',
    locale: 'en',
    fallbackLocale: 'en',
    cipher: 'AES-256-CBC',
    docMode: false,
  },

  binary: {
    name: 'buddy',
    command: 'buddy',
    description: 'Stacks is a full-stack framework for TypeScript.',
    source: p.appPath('commands'),
  },

  cache: {
    driver: 'redis',
    prefix: 'stx',
    ttl: 3600,

    drivers: {
      redis: {
        connection: 'default',
        host: 'localhost',
        port: 6379,
      },
    },
  },

  cloud: {
    driver: 'aws',

    storage: {
      useFileSystem: true,
    },

    firewall: {
      immunity: 0,
      challenge: {
        captcha: {
          duration: 60,
          headerName: 'X-Captcha',
          headerValue: 'true',
        },
      },
      rules: [
        {
          name: 'default',
          priority: 0,
          action: { block: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'default',
          },
          statement: {
            rateBasedStatement: {
              limit: 1000,
              aggregateKeyType: 'IP',
            },
          },
        },
      ],
    },

    cdn: {
      enableLogging: true,
      allowedMethods: 'GET_HEAD',
      cachedMethods: 'GET_HEAD',
      minTtl: 0,
      defaultTtl: 86400,
      maxTtl: 31536000,
      compress: true,
      priceClass: 'PriceClass_All',
      originShieldRegion: 'us-east-1',
      cookieBehavior: 'none',
      allowList: {
        cookies: [],
        headers: [],
        queryStrings: [],
      },
    },
  },

  database: {
    default: 'sqlite',

    name: 'stacks',

    connections: {
      sqlite: {
        database: p.projectStoragePath('framework/database/stacks.sqlite'),
        prefix: '',
      }
    },
  },

  dns: {
    driver: 'aws',
    a: [],
    aaaa: [],
    cname: [],
    mx: [],
    txt: [],
  },

  docs: {
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

      // socialLinks: [
      //   { icon: 'twitter', link: 'https://twitter.com/stacksjs' },
      //   { icon: 'github', link: 'https://github.com/stacksjs/stacks' },
      //   { icon: 'discord', link: 'https://discord.gg/stacksjs' },
      // ],

      // algolia: services.algolia,

      // carbonAds: {
      //   code: '',
      //   placement: '',
      // },
    },
  },

  email: {
    from: {
      name: 'Stacks',
      address: 'no-reply@stacksjs.com',
    },

    mailboxes: {}
  },

  git: {
    hooks: {
      'pre-commit': 'lint-staged',
    },

    scopes: [
      '', 'ci', 'deps', 'dx', 'release', 'docs', 'test', 'core',
      'actions', 'arrays', 'auth', 'build', 'cache', 'cli', 'cloud', 'collections', 'config',
      'database', 'datetime', 'docs', 'errors', 'git', 'lint', 'x-ray', 'modules', 'notifications',
      'objects', 'path', 'realtime', 'router', 'buddy', 'security', 'server', 'storage', 'strings',
      'tests', 'types', 'ui', 'utils',
    ],

    messages: {
      type: 'Select the type of change that you\'re committing:',
      scope: 'Select the SCOPE of this change (optional):',
      customScope: 'Select the SCOPE of this change:',
      subject: 'Write a SHORT, IMPERATIVE tense description of the change:\n',
      body: 'Provide a LONGER description of the change (optional). Use "|" to break new line:\n',
      breaking: 'List any BREAKING CHANGES (optional). Use "|" to break new line:\n',
      footerPrefixesSelect: 'Select the ISSUES type of the change list by this change (optional):',
      customFooterPrefixes: 'Input ISSUES prefix:',
      footer: 'List any ISSUES by this change. E.g.: #31, #34:\n',
      confirmCommit: 'Are you sure you want to proceed with the commit above?',
    },

    types: [
      { value: 'feat', name: 'feat:     ✨  A new feature', emoji: ':sparkles:' },
      { value: 'fix', name: 'fix:      🐛  A bug fix', emoji: ':bug:' },
      { value: 'docs', name: 'docs:     📝  Documentation only changes', emoji: ':memo:' },
      { value: 'style', name: 'style:    💄  Changes that do not affect the meaning of the code', emoji: ':lipstick:' },
      { value: 'refactor', name: 'refactor: ♻️   A code change that neither fixes a bug nor adds a feature', emoji: ':recycle:' },
      { value: 'perf', name: 'perf:     ⚡️  A code change that improves performance', emoji: ':zap:' },
      { value: 'test', name: 'test:     ✅  Adding missing tests or adjusting existing tests', emoji: ':white_check_mark:' },
      { value: 'build', name: 'build:    📦️  Changes that affect the build system or external dependencies', emoji: ':package:' },
      { value: 'ci', name: 'ci:       🎡  Changes to our CI configuration files and scripts', emoji: ':ferris_wheel:' },
      { value: 'chore', name: 'chore:    🔨  Other changes that don\'t modify src or test files', emoji: ':hammer:' },
      { value: 'revert', name: 'revert:   ⏪️  Reverts a previous commit', emoji: ':rewind:' },
    ],
  },

  hashing: {
    driver: 'argon2',

    bcrypt: {
      rounds: 10,
      cost: 4, // number between 4-31
    },

    argon2: {
      memory: 65536, // memory usage in kibibytes
      threads: 1,
      time: 1, // the number of iterations
    },
  },

  library: {
    name: 'hello-world',
    owner: '@stacksjs', // you may or may not add the @ prefix here (it is added automatically)
    repository: 'stacksjs/stacks',
    license: 'MIT',
    author: 'Chris Breuer',
    contributors: ['Chris Breuer <chris@stacksjs.com>'],
    defaultLanguage: 'en',

    vueComponents: {
      name: 'hello-world-vue',
      description: 'Your Vue component library description',
      keywords: ['component', 'library', 'vue', 'vite', 'typescript', 'javascript'],
      tags: [{
        name: ['HelloWorld', 'AppHelloWorld'],
        description: 'The Hello World custom element, built via this framework.',
        attributes: [{
          name: 'greeting',
          description: 'The greeting.',
        }],
      }],
    },

    webComponents: {
      name: 'hello-world-elements',
      description: 'Your framework agnostic web component library description.',
      keywords: ['custom-elements', 'web-components', 'library', 'framework-agnostic', 'typescript', 'javascript'],
      tags: [{
        name: ['HelloWorld', 'AppHelloWorld'],
        description: 'The Hello World custom element, built via this framework.',
        attributes: [{
          name: 'greeting',
          description: 'The greeting.',
        }],
      }],
    },

    functions: {
      name: 'hello-world-fx',
      description: 'Your function library description.',
      keywords: ['functions', 'composables', 'library', 'typescript', 'javascript'],
      shouldGenerateSourcemap: false,
      functions: [
        'counter',
        'dark',
      ],
    },
  },

  notification: {
    default: 'email',
  },

  // wip
  payment: {},

  queue: {},
  searchEngine: {},
  security: {},
  services: {},
  storage: {},
  ui: {},
}

// export {
//   userConfig,
//   defaults,
// }
