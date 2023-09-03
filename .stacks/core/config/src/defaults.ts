import type { StacksConfig } from '@stacksjs/types'
import { path as p } from '@stacksjs/path'
// import { userConfig as overrides } from './overrides'

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

  docs: {},

  email: {
    
  },
}

// export {
//   userConfig,
//   defaults,
// }
