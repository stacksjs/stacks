import { env } from '@stacksjs/env'
import type { ServicesConfig } from '@stacksjs/types'

/**
 * **Services**
 *
 * This configuration defines all of your services. Because Stacks is fully-typed, you may
 * hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  aws: {
    accountId: env.AWS_ACCOUNT_ID || '',
    appId: env.AWS_ACCESS_KEY_ID || '',
    apiKey: env.AWS_SECRET_ACCESS_KEY || '',
    region: env.AWS_DEFAULT_REGION || 'us-east-1',
  },

  algolia: {
    appId: '',
    apiKey: '',
  },

  meilisearch: {
    appId: '',
    apiKey: '',
  },

  lemonSqueezy: {
    appId: '',
    apiKey: '',
  },

  stripe: {
    appId: '',
    apiKey: '',
  },
} satisfies ServicesConfig
