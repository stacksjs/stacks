import type { StacksOptions } from '@stacksjs/types'
import { commandsPath, projectPath, userDatabasePath } from '@stacksjs/path'

/**
 * Derive sane app defaults (name, url) from the project's package.json so
 * a fresh project gets `Drivly` / `drivly.localhost` instead of the
 * generic `Stacks` / `stacks.localhost` placeholders.
 *
 * Falls back to "Stacks"/"stacks.localhost" when package.json is absent
 * or unreadable — `.env` and `config/app.ts` always win over both.
 */
function deriveAppDefaults(): { name: string, url: string } {
  try {
    const pkgPath = projectPath('package.json')
    // eslint-disable-next-line ts/no-require-imports
    const pkg = require(pkgPath) as { name?: string }
    const raw = (pkg.name ?? '').trim()
    if (!raw) return { name: 'Stacks', url: 'stacks.localhost' }
    // Strip @scope/, replace separators, capitalise.
    const slug = raw.replace(/^@[^/]+\//, '').toLowerCase()
    const name = slug.replace(/[-_]+/g, ' ').replace(/(^|\s)\w/g, c => c.toUpperCase())
    return { name, url: `${slug}.localhost` }
  }
  catch {
    return { name: 'Stacks', url: 'stacks.localhost' }
  }
}

const appDefaults = deriveAppDefaults()

export const defaults: StacksOptions = {
  ai: {
    deploy: false,
    models: [
      'anthropic.claude-sonnet-4-20250514-v1:0',
      'anthropic.claude-haiku-4-20250514-v1:0',
      'anthropic.claude-3-5-sonnet-20241022-v2:0',
      'amazon.titan-embed-text-v2:0',
      'amazon.titan-text-premier-v1:0',
      'amazon.titan-image-generator-v2:0',
      'meta.llama3-1-70b-instruct-v1:0',
      'meta.llama3-1-8b-instruct-v1:0',
    ],
  },

  auth: {
    username: 'email',
    password: 'password',
    defaultTokenName: 'auth-token',
    tokenExpiry: 30 * 24 * 60 * 60 * 1000, // 30 days
    defaultAbilities: ['*'],
  },

  realtime: {
    driver: 'pusher',
  },

  analytics: {
    driver: undefined,
  },

  // api: {
  //   // version: 'v1',
  //   prefix: 'api',
  //   middleware: ['Api'],
  //   routes: {
  //     index: true,
  //     show: true,
  //     store: true,
  //     update: true,
  //     destroy: true,
  //   },
  // },

  app: {
    name: appDefaults.name,
    description: 'A Stacks application.',
    env: 'local',
    url: appDefaults.url,
    debug: true,
    key: '',
    timezone: 'UTC',
    locale: 'en',
    fallbackLocale: 'en',
    cipher: 'AES-256-CBC',
    docMode: false,
    redirectUrls: [],
    maintenanceMode: false,
  },

  cli: {
    name: 'My Custom CLI',
    command: 'my-custom-cli',
    description: 'Stacks is a full-stack framework for TypeScript.',
    source: commandsPath(),
    deploy: false,
  },

  cache: {
    driver: 'memory',
    prefix: 'stx',
    ttl: 3600,
    maxKeys: -1,
    useClones: true,

    drivers: {
      redis: {
        host: 'localhost',
        port: 6379,
        username: '',
        password: '',
        database: 0,
        tls: false,
      },
      memory: {
        maxKeys: -1,
        checkPeriod: 600,
        deleteOnExpire: true,
      },
    },
  },

  cloud: {
    infrastructure: {
      type: 'serverless',
      driver: 'aws',
      environments: ['production', 'staging', 'development'],

      firewall: {
        enabled: true,
        countryCodes: [],
        ipAddresses: [],
        queryString: [],
        httpHeaders: [],
        // ipSets: [],
        rateLimitPerMinute: 1000,
        useIpReputationLists: true,
        useKnownBadInputsRuleSet: true,
      },

      cdn: {
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
        realtimeLogs: {
          enabled: true,
          samplingRate: 2,
        },
      },

      fileSystem: false,
      storage: {},
    },

    // Default site configuration
    sites: {
      root: '',
      path: '',
    },
  },

  dashboard: {
    sections: {
      library: { enabled: true },
      content: { enabled: true },
      commerce: { enabled: true },
      marketing: { enabled: true },
      analytics: { enabled: true },
      management: { enabled: true },
      utilities: { enabled: true },
    },
  },

  database: {
    default: 'sqlite',
    logging: false,
    connections: {
      sqlite: {
        database: userDatabasePath('stacks.sqlite'),
        prefix: '',
      },
    },

    migrations: 'migrations',
    migrationLocks: 'migration_locks',
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
    deploy: false,

    themeConfig: {
      editLink: {
        pattern: 'https://github.com/stacksjs/stacks/edit/main/docs/docs/:path',
        text: 'Edit this page on GitHub',
      },

      footer: {
        message: 'Released under the MIT License.',
        copyright: 'Copyright © 2024-present Stacks.js, Inc.',
      },

      // algolia: services.algolia,

      // carbonAds: {
      //   code: '',
      //   placement: '',
      // },
    } as any,
  } as any,

  email: {
    from: {
      name: 'Stacks',
      address: 'no-reply@stacksjs.com',
    },

    mailboxes: [],

    server: {
      enabled: true,
      scan: true,
    },
  },

  errors: {
    messages: {
      'string': 'The {{ field }} field must be a string',
      'email': 'The {{ field }} field must be a valid email address',
      'regex': 'The {{ field }} field format is invalid',
      'url': 'The {{ field }} field must be a valid URL',
      'activeUrl': 'The {{ field }} field must be a valid URL',
      'alpha': 'The {{ field }} field must contain only letters',
      'alphaNumeric': 'The {{ field }} field must contain only letters and numbers',
      'min(': 'The {{ field }} field must have at least {{ min }} characters',
      'maxLength': 'The {{ field }} field must not be greater than {{ max }} characters',
      'fixedLength': 'The {{ field }} field must be {{ size }} characters long',
      'confirmed': 'The {{ field }} field and {{ otherField }} field must be the same',
      'endsWith': 'The {{ field }} field must end with {{ substring }}',
      'startsWith': 'The {{ field }} field must start with {{ substring }}',
      'sameAs': 'The {{ field }} field and {{ otherField }} field must be the same',
      'notSameAs': 'The {{ field }} field and {{ otherField }} field must be different',
      'in': 'The selected {{ field }} is invalid',
      'notIn': 'The selected {{ field }} is invalid',
      'ipAddress': 'The {{ field }} field must be a valid IP address',
      'uuid': 'The {{ field }} field must be a valid UUID',
      'ascii': 'The {{ field }} field must only contain ASCII characters',
      'creditCard': 'The {{ field }} field must be a valid {{ providersList }} card number',
      'hexCode': 'The {{ field }} field must be a valid hex color code',
      'iban': 'The {{ field }} field must be a valid IBAN number',
      'jwt': 'The {{ field }} field must be a valid JWT token',
      'coordinates': 'The {{ field }} field must contain latitude and longitude coordinates',
      'mobile': 'The {{ field }} field must be a valid mobile phone number',
      'passport': 'The {{ field }} field must be a valid passport number',
      'postalCode': 'The {{ field }} field must be a valid postal code',

      // boolean
      'boolean': 'The value must be a boolean',

      // number
      'number': 'The {{ field }} field must be a number',
      'min': 'The {{ field }} field must be at least {{ min }}',
      'max': 'The {{ field }} field must not be greater than {{ max }}',
      'range': 'The {{ field }} field must be between {{ min }} and {{ max }}',
      'positive': 'The {{ field }} field must be positive',
      'negative': 'The {{ field }} field must be negative',
      'decimal': 'The {{ field }} field must have {{ digits }} decimal places',
      'withoutDecimals': 'The {{ field }} field must not have decimal places',

      // date
      'date': 'The {{ field }} field must be a datetime value',
      'date.equals': 'The {{ field }} field must be a date equal to {{ expectedValue }}',
      'date.after': 'The {{ field }} field must be a date after {{ expectedValue }}',
      'date.before': 'The {{ field }} field must be a date before {{ expectedValue }}',
      'date.afterOrEqual': 'The {{ field }} field must be a date after or equal to {{ expectedValue }}',
      'date.beforeOrEqual': 'The {{ field }} field must be a date before or equal to {{ expectedValue }}',
      'date.sameAs': 'The {{ field }} field and {{ otherField }} field must be the same',
      'date.notSameAs': 'The {{ field }} field and {{ otherField }} field must be different',
      'date.afterField': 'The {{ field }} field must be a date after {{ otherField }}',

      // accepted
      'accepted': 'The {{ field }} field must be accepted',

      // enum
      'enum': 'The selected {{ field }} is invalid',

      // literal
      'literal': 'The {{ field }} field must be {{ expectedValue }}',

      // object
      'object': 'The {{ field }} field must be an object',

      // record
      'record': 'The {{ field }} field must be an object',
      'record.min(': 'The {{ field }} field must have at least {{ min }} items',
      'record.maxLength': 'The {{ field }} field must not have more than {{ max }} items',
      'record.fixedLength': 'The {{ field }} field must contain {{ size }} items',

      // array
      'array': 'The {{ field }} field must be an array',
      'array.min(': 'The {{ field }} field must have at least {{ min }} items',
      'array.maxLength': 'The {{ field }} field must not have more than {{ max }} items',
      'array.fixedLength': 'The {{ field }} field must contain {{ size }} items',
      'notEmpty': 'The {{ field }} field must not be empty',
      'distinct': 'The {{ field }} field has duplicate values',

      // tuple
      'tuple': 'The {{ field }} field must be an array',

      // union
      'union': 'Invalid value provided for {{ field }} field',
      'unionGroup': 'Invalid value provided for {{ field }} field',
      'unionOfTypes': 'Invalid value provided for {{ field }} field',
    } as any,
  },

  git: {
    hooks: {
      'pre-commit': 'lint-staged',
    },

    scopes: [
      '',
      'ci',
      'deps',
      'dx',
      'release',
      'docs',
      'test',
      'core',
      'actions',
      'arrays',
      'auth',
      'build',
      'cache',
      'cli',
      'cloud',
      'collections',
      'config',
      'database',
      'datetime',
      'docs',
      'errors',
      'git',
      'lint',
      'x-ray',
      'modules',
      'notifications',
      'objects',
      'path',
      'realtime',
      'router',
      'buddy',
      'security',
      'server',
      'storage',
      'strings',
      'tests',
      'types',
      'ui',
      'utils',
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
      {
        value: 'feat',
        name: 'feat:     ✨  A new feature',
        emoji: ':sparkles:',
      },
      { value: 'fix', name: 'fix:      🐛  A bug fix', emoji: ':bug:' },
      {
        value: 'docs',
        name: 'docs:     📝  Documentation only changes',
        emoji: ':memo:',
      },
      {
        value: 'style',
        name: 'style:    💄  Changes that do not affect the meaning of the code',
        emoji: ':lipstick:',
      },
      {
        value: 'refactor',
        name: 'refactor: ♻️   A code change that neither fixes a bug nor adds a feature',
        emoji: ':recycle:',
      },
      {
        value: 'perf',
        name: 'perf:     ⚡️  A code change that improves performance',
        emoji: ':zap:',
      },
      {
        value: 'test',
        name: 'test:     ✅  Adding missing tests or adjusting existing tests',
        emoji: ':white_check_mark:',
      },
      {
        value: 'build',
        name: 'build:    📦️  Changes that affect the build system or external dependencies',
        emoji: ':package:',
      },
      {
        value: 'ci',
        name: 'ci:       🎡  Changes to our CI configuration files and scripts',
        emoji: ':ferris_wheel:',
      },
      {
        value: 'chore',
        name: 'chore:    🔨  Other changes that don\'t modify src or test files',
        emoji: ':hammer:',
      },
      {
        value: 'revert',
        name: 'revert:   ⏪️  Reverts a previous commit',
        emoji: ':rewind:',
      },
    ],
  },

  hashing: {
    driver: 'bcrypt', // Laravel default

    bcrypt: {
      rounds: 12, // Laravel default is 10-12, higher = more secure but slower
    },

    argon2: {
      memory: 65536, // memory usage in kibibytes
      // threads: 1,
      time: 2, // the number of iterations
    },
  },

  library: {
    name: 'hello-world',
    owner: '@stacksjs', // you may or may not add the @ prefix here (it is added automatically)
    repository: 'stacksjs/stacks',
    license: 'MIT',
    author: '',
    contributors: [],
    defaultLanguage: 'en',

    webComponents: {
      name: 'hello-world-elements',
      description: 'Your framework agnostic web component library description.',
      keywords: ['custom-elements', 'web-components', 'library', 'framework-agnostic', 'typescript', 'javascript'],
      tags: [
        {
          name: ['HelloWorld', 'AppHelloWorld'],
          description: 'The Hello World custom element, built via this framework.',
          attributes: [
            {
              name: 'greeting',
              description: 'The greeting.',
            },
          ],
        },
      ],
    },

    functions: {
      name: 'hello-world-fx',
      description: 'Your function library description.',
      keywords: ['functions', 'composables', 'library', 'typescript', 'javascript'],
      shouldGenerateSourcemap: false,
      files: ['counter', 'dark'],
    },
  },

  logging: {
    logsPath: 'storage/logs/stacks.log',
    deploymentsPath: 'storage/logs/deployments.log',
  },

  notification: {
    default: 'email',
  },

  payment: {
    driver: 'stripe',
  },

  ports: {
    frontend: 3000,
    backend: 3001,
    admin: 3002,
    library: 3003,
    desktop: 3004,
    email: 3005,
    docs: 3006,
    inspect: 3007,
    api: 3008,
    systemTray: 3009,
    database: 3010,
    // mobile: 3010,
  },

  queue: {
    default: 'sync',

    connections: {
      sync: {
        driver: 'sync',
      },

      database: {
        driver: 'database',
        table: 'jobs',
        queue: 'default',
        retryAfter: 90,
      },

      redis: {
        driver: 'redis',
        queue: 'default',
        retryAfter: 90,
      },

      sqs: {
        driver: 'sqs',
        key: '',
        secret: '',
        prefix: '',
        suffix: '',
        queue: 'default',
        region: 'us-east-1',
      },
    },
  } as any,

  saas: {
    plans: [
      {
        productName: 'Stacks Hobby',
        description: 'All the Stacks features.',
        pricing: [
          {
            key: 'stacks_hobby_monthly',
            price: 3900,
            interval: 'month',
            currency: 'usd',
          },
          {
            key: 'stacks_hobby_yearly',
            price: 37900,
            interval: 'year',
            currency: 'usd',
          },
        ],
        metadata: {
          createdBy: 'admin',
          version: '1.0.0',
        },
      },
      {
        productName: 'Stacks Pro',
        description: 'All the Stacks features, including being able to invite team members.',
        pricing: [
          {
            key: 'stacks_pro_monthly',
            price: 5900,
            interval: 'month',
            currency: 'usd',
          },
          {
            key: 'stacks_pro_yearly',
            price: 57900,
            interval: 'year',
            currency: 'usd',
          },
        ],
        metadata: {
          createdBy: 'admin',
          version: '1.0.0',
        },
      },
    ],

    webhook: {
      endpoint: '/webhooks/stripe',
      secret: '',
    },

    currencies: ['usd'],

    coupons: [
      {
        code: 'SUMMER2024',
        amountOff: 500,
        duration: 'once',
      },
    ],

    products: [
      {
        name: 'Stacks Pro',
        description: 'All the Stacks features.',
        images: ['url_to_image'],
      },
    ],
  },

  searchEngine: {
    driver: 'opensearch',
  },

  security: {
    firewall: {
      enabled: true,
      countryCodes: [],
      ipAddresses: [],
      queryString: [],
      httpHeaders: [],
      // ipSets: [],
      rateLimitPerMinute: 1000,
      useIpReputationLists: true,
      useKnownBadInputsRuleSet: true,
    },
  },

  services: {
    aws: {
      accountId: '',
      appId: '',
      apiKey: '',
      region: 'us-east-1',
    },

    algolia: {
      appId: '',
      apiKey: '',
    },

    meilisearch: {
      appId: '',
      apiKey: '',
    },

    stripe: {
      appId: '',
      apiKey: '',
    },
  } as any,

  filesystems: {
    driver: 's3',
  },

  team: {
    name: '',
    members: {},
  },

  ui: {
    shortcuts: [
      [
        'btn',
        'inline-flex items-center px-4 py-2 ml-2 border border-transparent shadow-sm text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 cursor-pointer',
      ],
    ],

    safelist: 'prose prose-sm m-auto text-left',

    trigger: ':stx:',
    classPrefix: 'stx-',
    reset: 'tailwind',

    icons: ['hugeicons'],

    fonts: {
      email: {
        title: 'Mona',
        text: 'Hubot',
      },

      desktop: {
        title: 'Mona',
        text: 'Hubot',
      },

      mobile: {
        title: 'Mona',
        text: 'Hubot',
      },

      web: {
        title: 'Mona',
        text: 'Hubot',
      },
    },
  },
}

export default defaults
