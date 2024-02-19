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
    frontend: env.APP_PORT ?? 3000,
    backend: env.PORT_BACKEND ?? 3001,
    admin: env.PORT_ADMIN ?? 3002,
    library: env.PORT_LIBRARY ?? 3003,
    desktop: env.PORT_DESKTOP ?? 3004,
    email: env.PORT_EMAIL ?? 3005,
    docs: env.PORT_DOCS ?? 3006,
    inspect: env.PORT_INSPECT ?? 3007,
    api: env.PORT_API ?? 3008,
  },
} satisfies AppConfig
