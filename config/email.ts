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

    /**
     * Automatic email categorization (Gmail-style folders)
     * Emails are automatically sorted into Social, Forums, Updates, Promotions folders
     * based on sender patterns. You can customize the patterns below.
     */
    categorization: {
      enabled: true,

      // Social networks - Facebook, Twitter, LinkedIn, etc.
      social: {
        domains: [
          'facebookmail.com', 'facebook.com', 'fb.com',
          'twitter.com', 'x.com',
          'linkedin.com', 'linkedinmail.com',
          'instagram.com',
          'pinterest.com',
          'snapchat.com',
          'tiktok.com',
          'reddit.com', 'redditmail.com',
          'tumblr.com',
          'whatsapp.com',
          'telegram.org',
          'discord.com', 'discordapp.com',
          'slack.com',
          'meetup.com',
          'nextdoor.com',
          'quora.com',
          'medium.com',
          'mastodon.social',
          'threads.net',
          'bluesky.social',
        ],
        substrings: [
          'notification@', 'notifications@',
          'noreply@', 'no-reply@',
          '@social.', '@notifications.',
          'updates@', 'info@',
        ],
        headers: {
          'x-mailer': ['facebook', 'twitter', 'linkedin'],
        },
      },

      // Forums & mailing lists - Google Groups, Discourse, etc.
      forums: {
        domains: [
          'googlegroups.com', 'groups.google.com',
          'discourse.org',
          'stackoverflow.com', 'stackexchange.com',
          'freelancer.com',
          'upwork.com',
          'mailman.org',
          'listserv.net',
          'sympa.org',
          'yahoogroups.com',
          'topica.com',
          'gnu.org',
          'sourceforge.net',
          'launchpad.net',
        ],
        substrings: [
          '-list@', '-users@', '-dev@', '-announce@',
          'forum@', 'discuss@', 'community@',
          '@lists.', '@mailman.', '@groups.',
          'reply+', // GitHub discussion replies
        ],
        headers: {
          'list-unsubscribe': [''],
          'list-id': [''],
          'precedence': ['list', 'bulk'],
          'x-mailing-list': [''],
        },
      },

      // Updates & transactional - GitHub, Stripe, shipping, etc.
      updates: {
        domains: [
          'github.com', 'gitlab.com', 'bitbucket.org',
          'stripe.com', 'paypal.com', 'square.com', 'venmo.com',
          'ups.com', 'fedex.com', 'usps.com', 'dhl.com',
          'amazon.com', 'amazonses.com',
          'google.com', 'accounts.google.com',
          'apple.com', 'id.apple.com',
          'microsoft.com', 'live.com', 'outlook.com',
          'dropbox.com', 'box.com',
          'atlassian.com', 'jira.com', 'trello.com',
          'notion.so', 'airtable.com', 'asana.com',
          'vercel.com', 'netlify.com', 'heroku.com',
          'cloudflare.com', 'digitalocean.com',
          'twilio.com', 'sendgrid.com',
          'intercom.io', 'zendesk.com', 'freshdesk.com',
          'calendly.com', 'cal.com',
          'zoom.us', 'zoom.com',
          'doordash.com', 'ubereats.com', 'grubhub.com',
          'airbnb.com', 'booking.com', 'expedia.com',
          'uber.com', 'lyft.com',
          'netflix.com', 'spotify.com', 'hulu.com',
        ],
        substrings: [
          'alert@', 'alerts@',
          'notification@', 'notifications@',
          'noreply@', 'no-reply@',
          'security@', 'support@',
          'confirm@', 'confirmation@',
          'receipt@', 'invoice@', 'billing@',
          'shipping@', 'delivery@', 'order@', 'orders@',
          'account@', 'password@',
          'verify@', 'verification@',
        ],
        headers: {
          'auto-submitted': ['auto-generated', 'auto-replied'],
          'x-auto-response-suppress': [''],
        },
      },

      // Promotions & marketing - newsletters, sales, etc.
      promotions: {
        domains: [
          'mailchimp.com', 'mail.mailchimp.com',
          'sendgrid.net', 'sendgrid.com',
          'constantcontact.com',
          'mailerlite.com',
          'hubspot.com', 'hubspotmail.com',
          'klaviyo.com',
          'convertkit.com',
          'drip.com',
          'getresponse.com',
          'aweber.com',
          'campaignmonitor.com',
          'sendinblue.com', 'brevo.com',
          'activecampaign.com',
          'emarsys.net',
          'salesforce.com', 'exacttarget.com',
          'amazon.com', 'amazonsellerservices.com',
          'walmart.com',
          'target.com',
          'bestbuy.com',
          'ebay.com',
          'etsy.com',
          'shopify.com',
          'wish.com',
          'aliexpress.com',
          'wayfair.com',
          'homedepot.com',
          'lowes.com',
          'kohls.com',
          'macys.com',
          'nordstrom.com',
          'gap.com',
          'nike.com',
          'adidas.com',
          'lululemon.com',
          'uniqlo.com',
          'zara.com',
          'hm.com',
          'sephora.com',
          'ulta.com',
          'groupon.com',
          'retailmenot.com',
        ],
        substrings: [
          'promo@', 'promotions@',
          'marketing@', 'newsletter@', 'news@',
          'deals@', 'offers@', 'sale@', 'sales@',
          'shop@', 'store@',
          'rewards@', 'loyalty@',
          'unsubscribe', // common in promotional emails
          'campaign', 'blast@',
        ],
        headers: {
          'x-campaign': [''],
          'x-mailchimp-id': [''],
          'x-mc-user': [''],
          'x-sg-eid': [''], // SendGrid
          'x-ses-outgoing': [''], // AWS SES promotional
        },
      },
    },
  },

  notifications: {
    newEmail: true,
    bounces: true,
    complaints: true,
  },

  default: (envVars.MAIL_DRIVER || 'ses') as 'ses' | 'sendgrid' | 'mailgun' | 'mailtrap' | 'smtp' | 'postmark',
} satisfies EmailConfig
