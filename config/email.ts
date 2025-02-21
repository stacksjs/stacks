import type { EmailConfig } from '@stacksjs/types'
import { env } from '@stacksjs/env'

/**
 * **Email Configuration**
 *
 * This configuration defines all of your email options. Because Stacks is fully-typed, you
 * may hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  from: {
    name: env.MAIL_FROM_NAME || 'Stacks',
    address: env.MAIL_FROM_ADDRESS || 'no-reply@stacksjs.org',
  },

  mailboxes: ['chris@stacksjs.org', 'blake@stacksjs.org', 'glenn@stacksjs.org'],

  url: env.APP_URL || 'http://localhost:3000',
  charset: 'UTF-8',

  server: {
    scan: true, // scans for spam and viruses
  },

  // Add driver configuration
  default: env.MAIL_DRIVER || 'ses',

  drivers: {
    ses: {
      region: env.AWS_SES_REGION || 'us-east-1',
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      },
    },

    sendgrid: {
      apiKey: env.SENDGRID_API_KEY,
      maxRetries: env.SENDGRID_MAX_RETRIES ? Number.parseInt(env.SENDGRID_MAX_RETRIES) : 3,
      retryTimeout: env.SENDGRID_RETRY_TIMEOUT ? Number.parseInt(env.SENDGRID_RETRY_TIMEOUT) : 1000,
    },

    mailtrap: {
      token: env.MAILTRAP_TOKEN,
      inboxId: env.MAILTRAP_INBOX_ID,
    },
  },
} satisfies EmailConfig
