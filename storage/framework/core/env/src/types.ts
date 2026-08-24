import type { BooleanValidatorType, NumberValidatorType, StringValidatorType } from '@stacksjs/ts-validation'
import type { EnvKey } from '../../../env'

interface EnumObject {
  [key: string]: string[]
}

export const envEnum: EnumObject = {
  APP_ENV: ['local', 'dev', 'development', 'staging', 'prod', 'production'],
  DB_CONNECTION: ['mysql', 'sqlite', 'postgres', 'singlestore', 'vitess', 'dynamodb'],
  DB_MIGRATE_FRESH: ['allow', 'confirm', 'disabled'],
  // MAIL_MAILER lists the drivers `@stacksjs/email` actually ships
  // (`registerDefaultDrivers()` in src/email.ts). `postmark`,
  // `nodemailer`, and `sendmail` previously appeared here but had no
  // driver implementation — selecting them surfaced as a runtime
  // throw on the first `mail.send()`. Use `smtp` for any SMTP relay
  // (including Postmark over SMTP). See stacksjs/stacks#1871 M-7.
  MAIL_MAILER: ['smtp', 'mailgun', 'ses', 'log', 'sendgrid', 'mailtrap', 'capture'],
  SEARCH_ENGINE_DRIVER: ['opensearch', 'meilisearch', 'algolia', 'typesense'],
  FRONTEND_APP_ENV: ['development', 'staging', 'production'],
}

interface StringEnvConfig {
  validation: StringValidatorType
  default: string
}

interface NumberEnvConfig {
  validation: NumberValidatorType
  default: number
}

interface BooleanEnvConfig {
  validation: BooleanValidatorType
  default: boolean
}

interface EnumEnvConfig {
  validation: {
    readonly name: 'enum'
    getAllowedValues: () => readonly string[]
  }
  default: string
}

type EnvValueConfig = StringEnvConfig | NumberEnvConfig | BooleanEnvConfig | EnumEnvConfig

export type EnvConfig = Partial<Record<EnvKey, EnvValueConfig>>

export interface StacksEnv {
  // App
  APP_NAME: string | undefined
  // Must match `envEnum.APP_ENV` above, which is what the runtime validates
  // against. The type listed only the short forms, so the long ones every
  // deploy actually uses (`APP_ENV=production`, and `development`/`staging`)
  // were type errors against a value the validator accepts, and
  // `env.APP_ENV === 'production'` was reported as an impossible comparison.
  APP_ENV: 'local' | 'dev' | 'development' | 'stage' | 'staging' | 'prod' | 'production' | undefined
  APP_KEY: string | undefined
  APP_URL: string | undefined
  APP_DOMAIN: string | undefined
  APP_MAINTENANCE: boolean | undefined
  APP_MAINTENANCE_SECRET: string | undefined
  APP_COMING_SOON: boolean | undefined
  APP_COMING_SOON_SECRET: string | undefined
  APP_ROOT: string | undefined
  DEBUG: boolean | undefined

  // Ports (proxy auto-converts numeric strings to numbers)
  PORT: number | undefined
  PORT_BACKEND: number | undefined
  PORT_ADMIN: number | undefined
  PORT_LIBRARY: number | undefined
  PORT_DESKTOP: number | undefined
  PORT_EMAIL: number | undefined
  PORT_DOCS: number | undefined
  PORT_INSPECT: number | undefined
  PORT_API: number | undefined
  PORT_SYSTEM_TRAY: number | undefined

  // API
  API_PREFIX: string | undefined
  DOCS_PREFIX: string | undefined

  // Database
  DB_CONNECTION: 'mysql' | 'sqlite' | 'postgres' | 'singlestore' | 'vitess' | undefined
  DB_HOST: string | undefined
  DB_PORT: number | undefined
  DB_DATABASE: string | undefined
  DB_DATABASE_PATH: string | undefined
  DB_USERNAME: string | undefined
  DB_PASSWORD: string | undefined
  DB_PREFIX: string | undefined
  DB_SCHEMA: string | undefined
  DB_POOL_MAX: number | undefined
  DB_VITESS_SHARDED: boolean | undefined
  DB_POOL_IDLE_TIMEOUT_MS: number | undefined
  DB_POOL_ACQUIRE_TIMEOUT_MS: number | undefined
  /** Comma-separated read replica hostnames. */
  DB_READ_HOSTS: string | undefined
  DB_READ_AUTO_ROUTE: boolean | undefined
  DB_QUERY_LOGGING_ENABLED: boolean | undefined
  DB_QUERY_LOGGING_SLOW_THRESHOLD: number | undefined
  DB_QUERY_LOGGING_RETENTION_DAYS: number | undefined
  DB_QUERY_LOGGING_PRUNE_FREQUENCY: number | undefined
  DB_QUERY_LOGGING_ANALYSIS_ENABLED: boolean | undefined
  DB_QUERY_LOGGING_ANALYZE_ALL: boolean | undefined
  DB_QUERY_LOGGING_EXPLAIN_PLAN: boolean | undefined
  DB_QUERY_LOGGING_SUGGESTIONS: boolean | undefined
  DB_MIGRATE_CONFIRM: boolean | undefined
  DB_MIGRATE_FRESH: 'allow' | 'confirm' | 'disabled' | undefined
  DATABASE_URL: string | undefined

  // AWS
  AWS_ACCOUNT_ID: string | undefined
  AWS_ACCESS_KEY_ID: string | undefined
  AWS_SECRET_ACCESS_KEY: string | undefined
  AWS_DEFAULT_REGION: string | undefined
  AWS_DEFAULT_PASSWORD: string | undefined
  AWS_REGION: string | undefined
  AWS_HOSTED_ZONE_ID: string | undefined
  AWS_S3_BUCKET: string | undefined
  AWS_S3_PREFIX: string | undefined
  AWS_SES_REGION: string | undefined

  // Mail
  MAIL_MAILER: string | undefined
  MAIL_HOST: string | undefined
  MAIL_PORT: number | undefined
  MAIL_USERNAME: string | undefined
  MAIL_PASSWORD: string | undefined
  MAIL_ENCRYPTION: string | undefined
  MAIL_FROM_NAME: string | undefined
  MAIL_FROM_ADDRESS: string | undefined
  MAIL_DOMAIN: string | undefined
  MAIL_DRIVER: string | undefined
  MAIL_SERVER_MODE: string | undefined
  MAIL_SERVER_PATH: string | undefined

  // Search
  SEARCH_ENGINE_DRIVER: string | undefined
  MEILISEARCH_HOST: string | undefined
  MEILISEARCH_KEY: string | undefined

  // Stripe
  STRIPE_SECRET_KEY: string | undefined
  STRIPE_PUBLISHABLE_KEY: string | undefined

  // Frontend
  FRONTEND_APP_ENV: 'development' | 'staging' | 'production' | undefined
  FRONTEND_APP_URL: string | undefined

  // Realtime/Broadcast
  REALTIME_MODE: string | undefined
  BROADCAST_DRIVER: string | undefined
  BROADCAST_HOST: string | undefined
  BROADCAST_PORT: number | undefined
  BROADCAST_SCHEME: string | undefined
  BROADCAST_APP_ID: string | undefined
  BROADCAST_APP_KEY: string | undefined
  BROADCAST_APP_SECRET: string | undefined
  BROADCAST_CORS_ORIGIN: string | undefined
  BROADCAST_DEBUG: boolean | undefined
  BROADCAST_REDIS_ENABLED: boolean | undefined
  BROADCAST_REDIS_PREFIX: string | undefined
  BROADCAST_RATE_LIMIT_ENABLED: boolean | undefined
  BROADCAST_METRICS_ENABLED: boolean | undefined

  // Redis
  REDIS_HOST: string | undefined
  REDIS_PORT: number | undefined
  REDIS_PASSWORD: string | undefined

  // Pusher
  PUSHER_APP_ID: string | undefined
  PUSHER_APP_KEY: string | undefined
  PUSHER_APP_SECRET: string | undefined
  PUSHER_APP_CLUSTER: string | undefined
  PUSHER_APP_USE_TLS: boolean | undefined

  // Cloud
  SSL_DOMAINS: string | undefined
  LETSENCRYPT_EMAIL: string | undefined

  // Phone
  CONNECT_INSTANCE_ALIAS: string | undefined
  PHONE_NOTIFY_EMAIL: string | undefined
  PHONE_FORWARD_NUMBER: string | undefined

  // Storage
  STORAGE_DRIVER: string | undefined
  STORAGE_ROOT: string | undefined
  STORAGE_PUBLIC_URL: string | undefined

  // Queue
  QUEUE_DRIVER: string | undefined

  // Auth
  AUTH_USERNAME_FIELD: string | undefined
  AUTH_PASSWORD_FIELD: string | undefined
  AUTH_TOKEN_EXPIRY: number | undefined
  AUTH_REFRESH_TOKEN_EXPIRY: number | undefined
  AUTH_TOKEN_ROTATION: number | undefined
  AUTH_PASSWORD_RESET_EXPIRE: number | undefined
  AUTH_PASSWORD_RESET_THROTTLE: number | undefined

  /*
   * Integration credentials the framework's own `config/` files read.
   *
   * These were reachable only through a catch-all `[key: string]` on this
   * interface, which typed every name - real, misspelled or imaginary - as
   * `string | number | boolean | undefined`. So `env.GITHUB_CLEINT_ID` was a
   * valid read returning undefined, and the set of variables the shipped
   * integrations actually look for was written down nowhere a person could
   * find it. Naming them is what lets the catch-all go.
   */
  ANTHROPIC_API_KEY: string | undefined
  ANTHROPIC_MAX_TOKENS: string | undefined
  ANTHROPIC_MODEL: string | undefined
  APPLE_CLIENT_ID: string | undefined
  APPLE_KEY_ID: string | undefined
  APPLE_PRIVATE_KEY: string | undefined
  APPLE_REDIRECT_URL: string | undefined
  APPLE_TEAM_ID: string | undefined
  AWS_ENDPOINT: string | undefined
  AWS_USE_PATH_STYLE_ENDPOINT: boolean | undefined
  DB_SSL: string | undefined
  DISCORD_BOT_TOKEN: string | undefined
  DISCORD_MAX_RETRIES: string | undefined
  DISCORD_RETRY_TIMEOUT: string | undefined
  DISCORD_WEBHOOK_URL: string | undefined
  EXPO_ACCESS_TOKEN: string | undefined
  FACEBOOK_CLIENT_ID: string | undefined
  FACEBOOK_CLIENT_SECRET: string | undefined
  FACEBOOK_REDIRECT_URL: string | undefined
  FCM_CLIENT_EMAIL: string | undefined
  FCM_PRIVATE_KEY: string | undefined
  FCM_PROJECT_ID: string | undefined
  FCM_SERVER_KEY: string | undefined
  GITHUB_CLIENT_ID: string | undefined
  GITHUB_CLIENT_SECRET: string | undefined
  GITHUB_REDIRECT_URL: string | undefined
  GOOGLE_CLIENT_ID: string | undefined
  GOOGLE_CLIENT_SECRET: string | undefined
  GOOGLE_REDIRECT_URL: string | undefined
  MAILGUN_API_KEY: string | undefined
  MAILGUN_DOMAIN: string | undefined
  MAILGUN_ENDPOINT: string | undefined
  MAILGUN_MAX_RETRIES: string | undefined
  MAILGUN_RETRY_TIMEOUT: string | undefined
  MAILTRAP_HOST: string | undefined
  MAILTRAP_INBOX_ID: string | undefined
  MAILTRAP_MAX_RETRIES: string | undefined
  MAILTRAP_RETRY_TIMEOUT: string | undefined
  MAILTRAP_TOKEN: string | undefined
  MAIL_MAX_RETRIES: string | undefined
  MAIL_RETRY_TIMEOUT: string | undefined
  OLLAMA_EMBEDDING_MODEL: string | undefined
  OLLAMA_HOST: string | undefined
  OLLAMA_MODEL: string | undefined
  OPENAI_API_KEY: string | undefined
  OPENAI_BASE_URL: string | undefined
  OPENAI_EMBEDDING_MODEL: string | undefined
  OPENAI_MODEL: string | undefined
  PREDICTHQ_DB_PASSWORD: string | undefined
  QUEUE_CONCURRENCY: string | undefined
  QUEUE_DLQ_ENABLED: string | undefined
  QUEUE_DLQ_MAX_RETRIES: string | undefined
  QUEUE_FAILED_DRIVER: string | undefined
  QUEUE_HORIZONTAL_SCALING_ENABLED: string | undefined
  QUEUE_JOBS_PER_WORKER: string | undefined
  QUEUE_LOG_LEVEL: string | undefined
  QUEUE_MAX_WORKERS: string | undefined
  QUEUE_METRICS_ENABLED: string | undefined
  QUEUE_PREFIX: string | undefined
  QUEUE_RATE_LIMIT_DURATION: string | undefined
  QUEUE_RATE_LIMIT_ENABLED: string | undefined
  QUEUE_RATE_LIMIT_MAX: string | undefined
  QUEUE_WORKER_CONCURRENCY: string | undefined
  REDIS_DB: string | undefined
  REDIS_URL: string | undefined
  SENDGRID_API_KEY: string | undefined
  SENDGRID_MAX_RETRIES: string | undefined
  SENDGRID_RETRY_TIMEOUT: string | undefined
  SLACK_APP_ID: string | undefined
  SLACK_BOT_TOKEN: string | undefined
  SLACK_CLIENT_ID: string | undefined
  SLACK_MAX_RETRIES: string | undefined
  SLACK_RETRY_TIMEOUT: string | undefined
  SLACK_SECRET_KEY: string | undefined
  SLACK_WEBHOOK_URL: string | undefined
  SMS_FROM_NUMBER: string | undefined
  SMS_ORIGINATION_NUMBER: string | undefined
  SMS_SENDER_ID: string | undefined
  SQS_PREFIX: string | undefined
  SQS_SUFFIX: string | undefined
  TEAMS_MAX_RETRIES: string | undefined
  TEAMS_RETRY_TIMEOUT: string | undefined
  TEAMS_WEBHOOK_URL: string | undefined
  TWILIO_ACCOUNT_SID: string | undefined
  TWILIO_AUTH_TOKEN: string | undefined
  TWILIO_FROM_NUMBER: string | undefined
  TWILIO_MESSAGING_SERVICE_SID: string | undefined
  TWILIO_VERIFY_SERVICE_SID: string | undefined
  TWITTER_CLIENT_ID: string | undefined
  TWITTER_CLIENT_SECRET: string | undefined
  TWITTER_REDIRECT_URL: string | undefined
  VONAGE_API_KEY: string | undefined
  VONAGE_API_SECRET: string | undefined
  VONAGE_FROM_NUMBER: string | undefined
}

export type EnvSchema = EnvConfig

export interface FrontendEnv {
  FRONTEND_APP_ENV: 'local' | 'development' | 'staging' | 'production'
  FRONTEND_APP_URL: string
}
export type FrontendEnvKeys = keyof FrontendEnv
