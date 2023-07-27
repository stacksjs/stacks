import type { AppConfig, AppOptions } from '@stacksjs/types'
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
  debug: env.APP_DEBUG || false,
  key: env.APP_KEY,

  timezone: 'UTC',
  locale: 'en',
  fallbackLocale: 'en',
  cipher: 'aes-256-cbc',
} satisfies AppConfig as AppOptions
