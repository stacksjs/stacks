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

  /**
   * Mailbox users for IMAP/SMTP access.
   * Passwords are automatically looked up from MAIL_PASSWORD_<USERNAME> env vars.
   * After first deploy, passwords are synced to AWS Secrets Manager.
   *
   * Supported formats:
   * - Simple usernames: ['chris', 'blake'] -> chris@{domain}, blake@{domain}
   * - Full emails: ['chris@stacksjs.com']
   * - Objects: [{ email: 'chris', password: '...' }]
   */
  mailboxes: [
    'chris',
    'blake',
    'glenn',
  ],

  url: envVars.APP_URL || 'https://stacksjs.com',
  charset: 'UTF-8',

  server: {
    enabled: true,
    scan: true, // scans for spam and viruses
    subdomain: 'mail', // mail.stacksjs.com

    /**
     * Server mode:
     * - 'serverless': Lightweight TypeScript/Bun server (default, ~$3/month)
     * - 'server': Full-featured Zig mail server with IMAP, POP3, CalDAV, etc.
     */
    mode: (envVars.MAIL_SERVER_MODE || 'serverless') as 'serverless' | 'server',

    /**
     * Path to the Zig mail server repository (only used when mode is 'server')
     * @default '/Users/chrisbreuer/Code/mail' or process.env.MAIL_SERVER_PATH
     */
    serverPath: envVars.MAIL_SERVER_PATH || '/Users/chrisbreuer/Code/mail',

    storage: {
      retentionDays: 90,
      archiveAfterDays: 30,
    },

    // EC2 instance configuration for IMAP/SMTP server
    instance: {
      // For 'serverless' mode: t4g.nano ARM64 (~$3/month) is sufficient
      // For 'server' mode: t3.small x86_64 required for Zig binary
      type: 't4g.nano',
      spot: false, // set to true for ~50% cost savings (can be interrupted)
      diskSize: 8, // GB
      // keyPair: 'my-key-pair', // optional SSH access
    },

    ports: {
      smtp: 25, // Standard SMTP
      smtps: 465, // SMTP over TLS
      submission: 587, // SMTP with STARTTLS
      imap: 143, // IMAP
      imaps: 993, // IMAP over TLS
      pop3: 110, // POP3
      pop3s: 995, // POP3 over TLS
    },

    // Features (only available in 'server' mode)
    features: {
      imap: true,
      pop3: true,
      webmail: false, // future
      calDAV: false, // calendar sync
      cardDAV: false, // contacts sync
      activeSync: false, // Exchange ActiveSync
    },
  },

  notifications: {
    newEmail: true,
    bounces: true,
    complaints: true,
  },

  default: (envVars.MAIL_DRIVER || 'ses') as 'ses' | 'sendgrid' | 'mailgun' | 'mailtrap' | 'smtp' | 'postmark',
} satisfies EmailConfig
