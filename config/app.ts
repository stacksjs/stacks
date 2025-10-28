import type { AppConfig } from '@stacksjs/types'

// Use direct environment variable access to avoid circular dependencies
const envVars = typeof Bun !== 'undefined' ? Bun.env : process.env

/**
 * **Application Configuration**
 *
 * This configuration defines all of your application options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  name: envVars.APP_NAME ?? 'Stacks',
  description: 'Stacks is a full-stack framework for building modern web applications.',
  env: envVars.APP_ENV ?? 'local',
  url: envVars.APP_URL ?? 'stacks.localhost',
  redirectUrls: ['stacksjs.com'],
  debug: envVars.DEBUG ? envVars.DEBUG === 'true' : false,
  key: envVars.APP_KEY,

  maintenanceMode: envVars.APP_MAINTENANCE ? envVars.APP_MAINTENANCE === 'true' : false,
  // docMode: true, // instead of example.com/docs, deploys example.com as main entry point for docs
  docMode: false,

  timezone: 'America/Los_Angeles',
  locale: 'en',
  fallbackLocale: 'en',
  cipher: 'aes-256-cbc',
} satisfies AppConfig
