import { env } from '@stacksjs/env'
import type { CloudConfig } from '@stacksjs/types'
import security from './security'

/**
 * **Cloud**
 *
 * This configuration defines your cloud. Because Stacks is fully-typed, you may hover
 * any of the options below and the definitions will be provided. In case you have
 * any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  type: 'serverless',
  driver: 'aws',
  firewall: security.firewall,
  environments: ['production', 'staging', 'development'],

  storage: {},

  api: {
    prefix: env.API_PREFIX || 'api',
    // version: 'v1',
    description: 'My awesome Stacks API',
    deploy: false,
    memorySize: 512,
    prewarm: 10,
    timeout: 30,
  },

  cdn: {
    compress: true,

    allowedMethods: 'ALL',
    cachedMethods: 'GET_HEAD',
    originShieldRegion: 'us-east-1',
    minTtl: 0,
    defaultTtl: 86400,
    maxTtl: 31536000,
    cookieBehavior: 'none',

    allowList: {
      cookies: [],
      headers: [],
      queryStrings: [],
    },

    realtimeLogs: {
      enabled: true,
      samplingRate: 1,
    },
  },

  fileSystem: true, // enables file system

  // compute: {},
  // queues: false,
  // queue-concurrency: 50
} satisfies CloudConfig
