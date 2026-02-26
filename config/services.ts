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
    accountId: String(env.AWS_ACCOUNT_ID || ''),
    appId: String(env.AWS_ACCESS_KEY_ID || ''),
    apiKey: String(env.AWS_SECRET_ACCESS_KEY || ''),
    region: String(env.AWS_DEFAULT_REGION || 'us-east-1'),
  },

  github: {
    clientId: String(env.GITHUB_CLIENT_ID || ''),
    clientSecret: String(env.GITHUB_CLIENT_SECRET || ''),
    redirectUrl: String(env.GITHUB_REDIRECT_URL || 'http://localhost:3000/auth/github/callback'),
    scopes: ['read:user', 'user:email'],
  },

  google: {
    clientId: String(env.GOOGLE_CLIENT_ID || ''),
    clientSecret: String(env.GOOGLE_CLIENT_SECRET || ''),
    redirectUrl: String(env.GOOGLE_REDIRECT_URL || 'http://localhost:3000/auth/google/callback'),
    scopes: ['profile', 'email'],
  },

  facebook: {
    clientId: String(env.FACEBOOK_CLIENT_ID || ''),
    clientSecret: String(env.FACEBOOK_CLIENT_SECRET || ''),
    redirectUrl: String(env.FACEBOOK_REDIRECT_URL || 'http://localhost:3000/auth/facebook/callback'),
    scopes: ['email', 'public_profile'],
  },

  twitter: {
    clientId: String(env.TWITTER_CLIENT_ID || ''),
    clientSecret: String(env.TWITTER_CLIENT_SECRET || ''),
    redirectUrl: String(env.TWITTER_REDIRECT_URL || 'http://localhost:3000/auth/twitter/callback'),
    scopes: ['tweet.read', 'users.read', 'offline.access'],
  },

  digitalOcean: {
    appId: '',
    apiKey: '',
  },

  mailgun: {
    apiKey: String(env.MAILGUN_API_KEY || ''),
    domain: String(env.MAILGUN_DOMAIN || ''),
    endpoint: String(env.MAILGUN_ENDPOINT || 'api.mailgun.net'),
    maxRetries: Number(env.MAILGUN_MAX_RETRIES || 3),
    retryTimeout: Number(env.MAILGUN_RETRY_TIMEOUT || 1000),
  },

  mailtrap: {
    host: String(env.MAILTRAP_HOST || ''),
    token: String(env.MAILTRAP_TOKEN || ''),
    inboxId: String(env.MAILTRAP_INBOX_ID || ''),
    maxRetries: Number(env.MAILTRAP_MAX_RETRIES || 3),
    retryTimeout: Number(env.MAILTRAP_RETRY_TIMEOUT || 1000),
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
    apiKey: String(env.SENDGRID_API_KEY || ''),
    maxRetries: Number(env.SENDGRID_MAX_RETRIES || 3),
    retryTimeout: Number(env.SENDGRID_RETRY_TIMEOUT || 1000),
  },

  ses: {
    region: String(env.AWS_SES_REGION || 'us-east-1'),
    credentials: {
      accessKeyId: String(env.AWS_ACCESS_KEY_ID || ''),
      secretAccessKey: String(env.AWS_SECRET_ACCESS_KEY || ''),
    },
  },

  /**
   * SMTP Configuration for local development
   * Works with HELO, Mailtrap Desktop, Mailhog, Mailpit, etc.
   */
  smtp: {
    host: String(env.MAIL_HOST || '127.0.0.1'),
    port: Number(env.MAIL_PORT || 2525),
    // Handle "null" string from .env files (Laravel-style)
    username: String((env.MAIL_USERNAME && env.MAIL_USERNAME !== 'null') ? env.MAIL_USERNAME : ''),
    password: String((env.MAIL_PASSWORD && env.MAIL_PASSWORD !== 'null') ? env.MAIL_PASSWORD : ''),
    encryption: (env.MAIL_ENCRYPTION && env.MAIL_ENCRYPTION !== 'null' ? env.MAIL_ENCRYPTION : null) as 'tls' | 'ssl' | null,
    maxRetries: Number(env.MAIL_MAX_RETRIES || 3),
    retryTimeout: Number(env.MAIL_RETRY_TIMEOUT || 1000),
  },

  // lemonSqueezy: {
  //   appId: '',
  //   apiKey: '',
  // },

  slack: {
    appId: String(env.SLACK_APP_ID || ''),
    clientId: String(env.SLACK_CLIENT_ID || ''),
    secretKey: String(env.SLACK_SECRET_KEY || ''),
    webhookUrl: String(env.SLACK_WEBHOOK_URL || ''),
    botToken: String(env.SLACK_BOT_TOKEN || ''),
    maxRetries: Number(env.SLACK_MAX_RETRIES || 3),
    retryTimeout: Number(env.SLACK_RETRY_TIMEOUT || 1000),
  },

  discord: {
    webhookUrl: String(env.DISCORD_WEBHOOK_URL || ''),
    botToken: String(env.DISCORD_BOT_TOKEN || ''),
    maxRetries: Number(env.DISCORD_MAX_RETRIES || 3),
    retryTimeout: Number(env.DISCORD_RETRY_TIMEOUT || 1000),
  },

  teams: {
    webhookUrl: String(env.TEAMS_WEBHOOK_URL || ''),
    maxRetries: Number(env.TEAMS_MAX_RETRIES || 3),
    retryTimeout: Number(env.TEAMS_RETRY_TIMEOUT || 1000),
  },

  // Push Notification Services
  expo: {
    accessToken: String(env.EXPO_ACCESS_TOKEN || ''),
  },

  fcm: {
    serverKey: String(env.FCM_SERVER_KEY || ''),
    projectId: String(env.FCM_PROJECT_ID || ''),
    clientEmail: String(env.FCM_CLIENT_EMAIL || ''),
    privateKey: String(env.FCM_PRIVATE_KEY || ''),
  },

  // AI Services
  openai: {
    apiKey: String(env.OPENAI_API_KEY || ''),
    model: String(env.OPENAI_MODEL || 'gpt-4o'),
    embeddingModel: String(env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'),
    baseUrl: String(env.OPENAI_BASE_URL || 'https://api.openai.com/v1'),
  },

  anthropic: {
    apiKey: String(env.ANTHROPIC_API_KEY || ''),
    model: String(env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'),
    maxTokens: Number(env.ANTHROPIC_MAX_TOKENS || 4096),
  },

  ollama: {
    host: String(env.OLLAMA_HOST || 'http://localhost:11434'),
    model: String(env.OLLAMA_MODEL || 'llama3.2'),
    embeddingModel: String(env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text'),
  },

  stripe: {
    secretKey: String(env.STRIPE_SECRET_KEY || ''),
    publicKey: String(env.STRIPE_PUBLISHABLE_KEY || ''),
  },
} satisfies ServicesConfig
