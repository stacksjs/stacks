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
  description: 'Stacks is a full-stack framework for building modern web applications.',
  env: env.APP_ENV || 'local',
  url: env.APP_URL || 'stacks.localhost',
  redirectUrls: ['stacksjs.com'],
  debug: env.DEBUG || false,
  key: env.APP_KEY,

  maintenanceMode: env.APP_MAINTENANCE || false,
  docMode: true, // instead of example.com/docs, deploys example.com as main entry point for docs

  timezone: 'America/Los_Angeles',
  locale: 'en',
  fallbackLocale: 'en',
  cipher: 'aes-256-cbc',

  ports: {
    frontend: env.APP_PORT || 3333,
    backend: env.APP_PORT + 1 || 3334,
    admin: env.APP_PORT + 2 || 3335,
    library: env.APP_PORT + 3 || 3336,
    desktop: env.APP_PORT + 4 || 3337,
    email: env.APP_PORT + 5 || 3338,
    docs: env.APP_PORT + 6 || 3339,
    inspect: env.APP_PORT + 7 || 3340,
    api: 3999,
  },
} satisfies AppConfig
