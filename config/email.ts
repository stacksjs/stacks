import type { EmailConfig } from '@stacksjs/types'

// Use direct environment variable access to avoid circular dependencies
const envVars = typeof Bun !== 'undefined' ? Bun.env : process.env

/**
 * **Email Configuration**
 *
 * This configuration defines all of your email options. Because Stacks is fully-typed, you
 * may hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  from: {
    name: envVars.MAIL_FROM_NAME || 'Stacks',
    address: envVars.MAIL_FROM_ADDRESS || 'no-reply@stacksjs.org',
  },

  mailboxes: ['chris@stacksjs.org', 'blake@stacksjs.org', 'glenn@stacksjs.org'],

  url: envVars.APP_URL || 'http://localhost:3000',
  charset: 'UTF-8',

  server: {
    scan: true, // scans for spam and viruses
  },

  default: envVars.MAIL_DRIVER || 'ses',
} satisfies EmailConfig
