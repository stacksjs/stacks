import type { AppConfig } from '@stacksjs/types'
import { env } from '@stacksjs/env'

/**
 * **Application Configuration**
 *
 * This configuration defines all of your application options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  name: env.APP_NAME || 'Stacks',
  env: env.APP_ENV || 'development',
  url: env.APP_URL || 'stacks.test',
  redirectUrls: ['stacksjs.com'],
  debug: env.DEBUG || false,
  key: env.APP_KEY,

  ports: {
    frontend: env.APP_PORT || 3333,
    backend: env.APP_PORT + 1,
    admin: env.APP_PORT + 2,
    library: env.APP_PORT + 3,
    desktop: env.APP_PORT + 4,
    email: env.APP_PORT + 5,
    docs: env.APP_PORT + 6,
    inspect: env.APP_PORT + 7,
  },

  timezone: 'UTC',
  locale: 'en',
  fallbackLocale: 'en',
  cipher: 'aes-256-cbc',
  docMode: true, // instead of example.com/docs, deploys example.com as main entry point for docs
} satisfies AppConfig
