import { defineApp } from '@stacksjs/utils'
import { env } from '@stacksjs/validation'

/**
 * **Application Configuration**
 *
 * This configuration defines all of your application options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */

export default defineApp({
  name: env.APP_NAME || 'Stacks',
  env: env.APP_ENV || 'local',
  key: env.APP_KEY || '',
  debug: env.APP_DEBUG || false,
  url: env.APP_URL || 'https://localhost',

  timezone: 'UTC',
  locale: 'en',
  fallbackLocale: 'en',
  cipher: 'aes-256-cbc',
})
