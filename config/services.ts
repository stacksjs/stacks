import type { ServicesConfig } from '@stacksjs/types'

// Use direct environment variable access to avoid circular dependencies
const envVars = typeof Bun !== 'undefined' ? Bun.env : process.env

/**
 * **Services**
 *
 * This configuration defines all of your services. Because Stacks is fully-typed, you may
 * hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  algolia: {
    appId: '',
    apiKey: '',
  },

  aws: {
    accountId: envVars.AWS_ACCOUNT_ID || '',
    appId: envVars.AWS_ACCESS_KEY_ID || '',
    apiKey: envVars.AWS_SECRET_ACCESS_KEY || '',
    region: envVars.AWS_DEFAULT_REGION || 'us-east-1',
  },

  github: {
    clientId: envVars.GITHUB_CLIENT_ID || '',
    clientSecret: envVars.GITHUB_CLIENT_SECRET || '',
    redirectUrl: envVars.GITHUB_REDIRECT_URL || 'http://localhost:3000/auth/github/callback',
    scopes: ['read:user', 'user:email'],
  },

  google: {
    clientId: envVars.GOOGLE_CLIENT_ID || '',
    clientSecret: envVars.GOOGLE_CLIENT_SECRET || '',
    redirectUrl: envVars.GOOGLE_REDIRECT_URL || 'http://localhost:3000/auth/google/callback',
    scopes: ['profile', 'email'],
  },

  facebook: {
    clientId: envVars.FACEBOOK_CLIENT_ID || '',
    clientSecret: envVars.FACEBOOK_CLIENT_SECRET || '',
    redirectUrl: envVars.FACEBOOK_REDIRECT_URL || 'http://localhost:3000/auth/facebook/callback',
    scopes: ['email', 'public_profile'],
  },

  twitter: {
    clientId: envVars.TWITTER_CLIENT_ID || '',
    clientSecret: envVars.TWITTER_CLIENT_SECRET || '',
    redirectUrl: envVars.TWITTER_REDIRECT_URL || 'http://localhost:3000/auth/twitter/callback',
    scopes: ['tweet.read', 'users.read', 'offline.access'],
  },

  digitalOcean: {
    appId: '',
    apiKey: '',
  },

  mailgun: {
    apiKey: envVars.MAILGUN_API_KEY,
    domain: envVars.MAILGUN_DOMAIN,
    endpoint: envVars.MAILGUN_ENDPOINT || 'api.mailgun.net',
    maxRetries: envVars.MAILGUN_MAX_RETRIES ? Number.parseInt(envVars.MAILGUN_MAX_RETRIES) : 3,
    retryTimeout: envVars.MAILGUN_RETRY_TIMEOUT ? Number.parseInt(envVars.MAILGUN_RETRY_TIMEOUT) : 1000,
  },

  mailtrap: {
    host: envVars.MAILTRAP_HOST,
    token: envVars.MAILTRAP_TOKEN,
    inboxId: envVars.MAILTRAP_INBOX_ID,
    maxRetries: envVars.MAILTRAP_MAX_RETRIES ? Number.parseInt(envVars.MAILTRAP_MAX_RETRIES) : 3,
    retryTimeout: envVars.MAILTRAP_RETRY_TIMEOUT ? Number.parseInt(envVars.MAILTRAP_RETRY_TIMEOUT) : 1000,
  },

  hetzner: {
    appId: '',
    apiKey: '',
  },

  meilisearch: {
    appId: '',
    apiKey: '',
  },

  sendgrid: {
    apiKey: envVars.SENDGRID_API_KEY,
    maxRetries: envVars.SENDGRID_MAX_RETRIES ? Number.parseInt(envVars.SENDGRID_MAX_RETRIES) : 3,
    retryTimeout: envVars.SENDGRID_RETRY_TIMEOUT ? Number.parseInt(envVars.SENDGRID_RETRY_TIMEOUT) : 1000,
  },

  ses: {
    region: envVars.AWS_SES_REGION || 'us-east-1',
    credentials: {
      accessKeyId: envVars.AWS_ACCESS_KEY_ID,
      secretAccessKey: envVars.AWS_SECRET_ACCESS_KEY,
    },
  },

  /**
   * SMTP Configuration for local development
   * Works with HELO, Mailtrap Desktop, Mailhog, Mailpit, etc.
   */
  smtp: {
    host: envVars.MAIL_HOST || '127.0.0.1',
    port: envVars.MAIL_PORT ? Number.parseInt(envVars.MAIL_PORT) : 2525,
    // Handle "null" string from .env files (Laravel-style)
    username: (envVars.MAIL_USERNAME && envVars.MAIL_USERNAME !== 'null') ? envVars.MAIL_USERNAME : '',
    password: (envVars.MAIL_PASSWORD && envVars.MAIL_PASSWORD !== 'null') ? envVars.MAIL_PASSWORD : '',
    encryption: (envVars.MAIL_ENCRYPTION && envVars.MAIL_ENCRYPTION !== 'null' ? envVars.MAIL_ENCRYPTION : null) as 'tls' | 'ssl' | null,
    maxRetries: envVars.MAIL_MAX_RETRIES ? Number.parseInt(envVars.MAIL_MAX_RETRIES) : 3,
    retryTimeout: envVars.MAIL_RETRY_TIMEOUT ? Number.parseInt(envVars.MAIL_RETRY_TIMEOUT) : 1000,
  },

  // lemonSqueezy: {
  //   appId: '',
  //   apiKey: '',
  // },

  slack: {
    appId: envVars.SLACK_APP_ID,
    clientId: envVars.SLACK_CLIENT_ID,
    secretKey: envVars.SLACK_SECRET_KEY,
    webhookUrl: envVars.SLACK_WEBHOOK_URL,
    botToken: envVars.SLACK_BOT_TOKEN,
    maxRetries: envVars.SLACK_MAX_RETRIES ? Number.parseInt(envVars.SLACK_MAX_RETRIES) : 3,
    retryTimeout: envVars.SLACK_RETRY_TIMEOUT ? Number.parseInt(envVars.SLACK_RETRY_TIMEOUT) : 1000,
  },

  discord: {
    webhookUrl: envVars.DISCORD_WEBHOOK_URL,
    botToken: envVars.DISCORD_BOT_TOKEN,
    maxRetries: envVars.DISCORD_MAX_RETRIES ? Number.parseInt(envVars.DISCORD_MAX_RETRIES) : 3,
    retryTimeout: envVars.DISCORD_RETRY_TIMEOUT ? Number.parseInt(envVars.DISCORD_RETRY_TIMEOUT) : 1000,
  },

  teams: {
    webhookUrl: envVars.TEAMS_WEBHOOK_URL,
    maxRetries: envVars.TEAMS_MAX_RETRIES ? Number.parseInt(envVars.TEAMS_MAX_RETRIES) : 3,
    retryTimeout: envVars.TEAMS_RETRY_TIMEOUT ? Number.parseInt(envVars.TEAMS_RETRY_TIMEOUT) : 1000,
  },

  // Push Notification Services
  expo: {
    accessToken: envVars.EXPO_ACCESS_TOKEN,
  },

  fcm: {
    serverKey: envVars.FCM_SERVER_KEY,
    projectId: envVars.FCM_PROJECT_ID,
    clientEmail: envVars.FCM_CLIENT_EMAIL,
    privateKey: envVars.FCM_PRIVATE_KEY,
  },
  stripe: {
    secretKey: envVars.STRIPE_SECRET_KEY,
    publicKey: envVars.STRIPE_PUBLISHABLE_KEY,
  },
} satisfies ServicesConfig
