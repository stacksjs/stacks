import type { BooleanValidatorType, EnumValidatorType, NumberValidatorType, StringValidatorType } from '@stacksjs/ts-validation'
import type { schema } from '@stacksjs/validation'
import type { EnvKey } from '../../../env'

interface EnumObject {
  [key: string]: string[]
}

export const envEnum: EnumObject = {
  APP_ENV: ['local', 'dev', 'development', 'staging', 'prod', 'production'],
  DB_CONNECTION: ['mysql', 'sqlite', 'postgres', 'dynamodb'],
  MAIL_MAILER: ['smtp', 'mailgun', 'ses', 'postmark', 'sendmail', 'log'],
  SEARCH_ENGINE_DRIVER: ['opensearch'],
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
  validation: EnumValidatorType
  default: string
}

type EnvValueConfig = StringEnvConfig | NumberEnvConfig | BooleanEnvConfig | EnumEnvConfig

export type EnvConfig = Partial<Record<EnvKey, EnvValueConfig>>

export interface StacksEnv {
  // App
  APP_NAME: string | undefined
  APP_ENV: 'local' | 'dev' | 'stage' | 'prod' | undefined
  APP_KEY: string | undefined
  APP_URL: string | undefined
  APP_DOMAIN: string | undefined
  APP_MAINTENANCE: boolean | undefined
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
  DB_CONNECTION: 'mysql' | 'sqlite' | 'postgres' | undefined
  DB_HOST: string | undefined
  DB_PORT: number | undefined
  DB_DATABASE: string | undefined
  DB_DATABASE_PATH: string | undefined
  DB_USERNAME: string | undefined
  DB_PASSWORD: string | undefined
  DB_PREFIX: string | undefined
  DB_SCHEMA: string | undefined
  DB_QUERY_LOGGING_ENABLED: boolean | undefined
  DB_QUERY_LOGGING_SLOW_THRESHOLD: number | undefined
  DB_QUERY_LOGGING_RETENTION_DAYS: number | undefined
  DB_QUERY_LOGGING_PRUNE_FREQUENCY: number | undefined
  DB_QUERY_LOGGING_ANALYSIS_ENABLED: boolean | undefined
  DB_QUERY_LOGGING_ANALYZE_ALL: boolean | undefined
  DB_QUERY_LOGGING_EXPLAIN_PLAN: boolean | undefined
  DB_QUERY_LOGGING_SUGGESTIONS: boolean | undefined
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
  AUTH_TOKEN_ROTATION: number | undefined
  AUTH_PASSWORD_RESET_EXPIRE: number | undefined
  AUTH_PASSWORD_RESET_THROTTLE: number | undefined

  // Catch-all for custom env vars
  [key: string]: string | number | boolean | undefined
}

/** @deprecated Use `StacksEnv` instead */
export type Env = StacksEnv

export type EnvSchema = any

export interface FrontendEnv {
  FRONTEND_APP_ENV: 'local' | 'development' | 'staging' | 'production'
  FRONTEND_APP_URL: string
}
export type FrontendEnvKeys = keyof FrontendEnv
