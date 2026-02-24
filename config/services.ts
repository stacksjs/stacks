import type { ServicesConfig } from '@stacksjs/types'
import { env } from '@stacksjs/env'

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
    accountId: env.AWS_ACCOUNT_ID || '',
    appId: env.AWS_ACCESS_KEY_ID || '',
    apiKey: env.AWS_SECRET_ACCESS_KEY || '',
    region: env.AWS_DEFAULT_REGION || 'us-east-1',
  },

  github: {
    clientId: env.GITHUB_CLIENT_ID || '',
    clientSecret: env.GITHUB_CLIENT_SECRET || '',
    redirectUrl: env.GITHUB_REDIRECT_URL || 'http://localhost:3000/auth/github/callback',
    scopes: ['read:user', 'user:email'],
  },

  google: {
    clientId: env.GOOGLE_CLIENT_ID || '',
    clientSecret: env.GOOGLE_CLIENT_SECRET || '',
    redirectUrl: env.GOOGLE_REDIRECT_URL || 'http://localhost:3000/auth/google/callback',
    scopes: ['profile', 'email'],
  },

  facebook: {
    clientId: env.FACEBOOK_CLIENT_ID || '',
    clientSecret: env.FACEBOOK_CLIENT_SECRET || '',
    redirectUrl: env.FACEBOOK_REDIRECT_URL || 'http://localhost:3000/auth/facebook/callback',
    scopes: ['email', 'public_profile'],
  },

  twitter: {
    clientId: env.TWITTER_CLIENT_ID || '',
    clientSecret: env.TWITTER_CLIENT_SECRET || '',
    redirectUrl: env.TWITTER_REDIRECT_URL || 'http://localhost:3000/auth/twitter/callback',
    scopes: ['tweet.read', 'users.read', 'offline.access'],
  },

  digitalOcean: {
    appId: '',
    apiKey: '',
  },

  mailgun: {
    apiKey: env.MAILGUN_API_KEY,
    domain: env.MAILGUN_DOMAIN,
    endpoint: env.MAILGUN_ENDPOINT || 'api.mailgun.net',
    maxRetries: env.MAILGUN_MAX_RETRIES || 3,
    retryTimeout: env.MAILGUN_RETRY_TIMEOUT || 1000,
  },

  mailtrap: {
    host: env.MAILTRAP_HOST,
    token: env.MAILTRAP_TOKEN,
    inboxId: env.MAILTRAP_INBOX_ID,
    maxRetries: env.MAILTRAP_MAX_RETRIES || 3,
    retryTimeout: env.MAILTRAP_RETRY_TIMEOUT || 1000,
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
    apiKey: env.SENDGRID_API_KEY,
    maxRetries: env.SENDGRID_MAX_RETRIES || 3,
    retryTimeout: env.SENDGRID_RETRY_TIMEOUT || 1000,
  },

  ses: {
    region: env.AWS_SES_REGION || 'us-east-1',
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  },

  /**
   * SMTP Configuration for local development
   * Works with HELO, Mailtrap Desktop, Mailhog, Mailpit, etc.
   */
  smtp: {
    host: env.MAIL_HOST || '127.0.0.1',
    port: env.MAIL_PORT || 2525,
    // Handle "null" string from .env files (Laravel-style)
    username: (env.MAIL_USERNAME && env.MAIL_USERNAME !== 'null') ? env.MAIL_USERNAME : '',
    password: (env.MAIL_PASSWORD && env.MAIL_PASSWORD !== 'null') ? env.MAIL_PASSWORD : '',
    encryption: (env.MAIL_ENCRYPTION && env.MAIL_ENCRYPTION !== 'null' ? env.MAIL_ENCRYPTION : null) as 'tls' | 'ssl' | null,
    maxRetries: env.MAIL_MAX_RETRIES || 3,
    retryTimeout: env.MAIL_RETRY_TIMEOUT || 1000,
  },

  // lemonSqueezy: {
  //   appId: '',
  //   apiKey: '',
  // },

  slack: {
    appId: env.SLACK_APP_ID,
    clientId: env.SLACK_CLIENT_ID,
    secretKey: env.SLACK_SECRET_KEY,
    webhookUrl: env.SLACK_WEBHOOK_URL,
    botToken: env.SLACK_BOT_TOKEN,
    maxRetries: env.SLACK_MAX_RETRIES || 3,
    retryTimeout: env.SLACK_RETRY_TIMEOUT || 1000,
  },

  discord: {
    webhookUrl: env.DISCORD_WEBHOOK_URL,
    botToken: env.DISCORD_BOT_TOKEN,
    maxRetries: env.DISCORD_MAX_RETRIES || 3,
    retryTimeout: env.DISCORD_RETRY_TIMEOUT || 1000,
  },

  teams: {
    webhookUrl: env.TEAMS_WEBHOOK_URL,
    maxRetries: env.TEAMS_MAX_RETRIES || 3,
    retryTimeout: env.TEAMS_RETRY_TIMEOUT || 1000,
  },

  // Push Notification Services
  expo: {
    accessToken: env.EXPO_ACCESS_TOKEN,
  },

  fcm: {
    serverKey: env.FCM_SERVER_KEY,
    projectId: env.FCM_PROJECT_ID,
    clientEmail: env.FCM_CLIENT_EMAIL,
    privateKey: env.FCM_PRIVATE_KEY,
  },

  // AI Services
  openai: {
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL || 'gpt-4o',
    embeddingModel: env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
    baseUrl: env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  },

  anthropic: {
    apiKey: env.ANTHROPIC_API_KEY,
    model: env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
    maxTokens: env.ANTHROPIC_MAX_TOKENS || 4096,
  },

  ollama: {
    host: env.OLLAMA_HOST || 'http://localhost:11434',
    model: env.OLLAMA_MODEL || 'llama3.2',
    embeddingModel: env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text',
  },

  stripe: {
    secretKey: env.STRIPE_SECRET_KEY,
    publicKey: env.STRIPE_PUBLISHABLE_KEY,
  },
} satisfies ServicesConfig
