import type { StacksConfig } from '@stacksjs/types'
import { path as p } from '@stacksjs/path'
import app from '~/config/app'
import binary from '~/config/binary'
import cache from '~/config/cache'
import cloud from '~/config/cloud'
import database from '~/config/database'
import dns from '~/config/dns'
import docs from '~/config/docs'
import email from '~/config/email'
import git from '~/config/git'
import hashing from '~/config/hashing'
import library from '~/config/library'
import queue from '~/config/queue'
import payment from '~/config/payment'
import notification from '~/config/notification'
import storage from '~/config/storage'
import searchEngine from '~/config/search-engine'
import security from '~/config/security'
import services from '~/config/services'
import ui from '~/config/ui'

export const userConfig: StacksConfig = {
  app,
  binary,
  cache,
  cloud,
  database,
  dns,
  docs,
  email,
  git,
  hashing,
  library,
  queue,
  payment,
  notification,
  storage,
  searchEngine,
  security,
  services,
  ui,
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

  docs: {},

  email: {
    
  },
}

// export {
//   userConfig,
//   defaults,
// }
