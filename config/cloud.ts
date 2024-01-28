import type { CloudConfig } from '@stacksjs/types'
import { env } from '@stacksjs/env'
import security from './security'

/**
 * **Cloud**
 *
 * This configuration defines your cloud. Because Stacks is fully-typed, you may hover
 * any of the options below and the definitions will be provided. In case you have
 * any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  driver: 'aws',
  firewall: security.firewall,

  storage: {},

  cdn: {
    compress: true,
    allowedMethods: 'ALL',
    cachedMethods: 'GET_HEAD',
    originShieldRegion: 'us-east-1',
    minTtl: 0,
    defaultTtl: 86400,
    maxTtl: 31536000,
    priceClass: 'PriceClass_All',
    cookieBehavior: 'none',
    allowList: {
      cookies: [],
      headers: [],
      queryStrings: [],
    },
  },

  api: {
    prefix: env.API_PREFIX || 'api',
    description: 'Stacks API',
    memorySize: 512,
    prewarm: 10,
    timeout: 30,
  },

  ai: true, // deploys AI endpoints
  cli: true, // deploys CLI setup endpoint (./bootstrap)
  docs: true, // deploys documentation
  fileSystem: true, // enables file system

  // compute: {},
  // queues: false,
  // queue-concurrency: 50
} satisfies CloudConfig
