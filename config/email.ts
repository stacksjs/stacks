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
    address: envVars.MAIL_FROM_ADDRESS || 'no-reply@stacksjs.com',
  },

  domain: envVars.MAIL_DOMAIN || 'stacksjs.com',

  mailboxes: ['chris@stacksjs.com', 'blake@stacksjs.com', 'glenn@stacksjs.com'],

  url: envVars.APP_URL || 'https://stacksjs.com',
  charset: 'UTF-8',

  server: {
    enabled: true,
    scan: true, // scans for spam and viruses
    subdomain: 'mail', // mail.stacksjs.com

    storage: {
      retentionDays: 90,
      archiveAfterDays: 30,
    },

    // EC2 instance configuration for IMAP/SMTP server
    instance: {
      type: 't4g.nano', // ~$3/month - sufficient for light use
      spot: false, // set to true for ~$1.50/month (can be interrupted)
      diskSize: 8, // GB
      // keyPair: 'my-key-pair', // optional SSH access
    },

    ports: {
      imap: 993, // IMAP over TLS
      smtp: 465, // SMTP over TLS
      smtpStartTls: 587, // SMTP with STARTTLS
    },
  },

  notifications: {
    newEmail: true,
    bounces: true,
    complaints: true,
  },

  default: envVars.MAIL_DRIVER || 'ses',
} satisfies EmailConfig
