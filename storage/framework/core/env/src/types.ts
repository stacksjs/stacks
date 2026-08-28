import type { BooleanValidatorType, EnumValidatorType, NumberValidatorType, StringValidatorType, Validator } from '@stacksjs/ts-validation'

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

interface EnumEnvConfig<TValues extends string = string> {
  // The validator itself, rather than a structural stand-in for it. The
  // stand-in had `getAllowedValues(): readonly string[]`, which erased the
  // literals `schema.enum(['local', 'production'])` carries - so an enum
  // variable typed as a bare `string` and `env.APP_ENV === 'production'` was
  // just a string comparison.
  validation: EnumValidatorType<TValues>
  default: TValues | string
}

export type EnvValueConfig = StringEnvConfig | NumberEnvConfig | BooleanEnvConfig | EnumEnvConfig<any>

/**
 * The shape of `config/env.ts`.
 *
 * Keyed by plain string rather than by a generated `EnvKey` union. That union
 * came from `storage/framework/env.ts` - a file this package cannot see from an
 * installed app, so the import resolved to `any` and the constraint silently
 * did nothing anyway. More importantly it had the dependency backwards: an
 * application could not declare its own variable until a generator had scraped
 * that variable out of `.env` first.
 */
export type EnvConfig = Record<string, EnvValueConfig>

/**
 * The variables the framework itself defines.
 *
 * Closed on purpose: `StacksEnv` is what module augmentation extends, and
 * {@link InferEnv} subtracts the keys named here. Were those keys read off
 * `StacksEnv` instead, an augmentation built from `InferEnv` would reference
 * the interface it is augmenting and TypeScript would reject the cycle.
 */
export interface FrameworkEnv {
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

  // Storage
  FILESYSTEM_DISK: string | undefined

  // Hetzner Cloud, read by `buddy mail` and the deploy commands
  HCLOUD_TOKEN: string | undefined
  HETZNER_API_TOKEN: string | undefined

  // dotenvx key material and the sudo escalation used by `buddy setup`
  DOTENV_PRIVATE_KEY: string | undefined
  DOTENV_PUBLIC_KEY: string | undefined
  SUDO_PASSWORD: string | undefined

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
  // Read by the framework itself, in `@stacksjs/storage`'s filesystem config.
  // They used to reach it only through the generated declarations, which are
  // built from whichever `.env` the generator saw - so `bun run typecheck`
  // passed on a machine that had them set and failed on a fresh clone. A
  // variable the framework reads is declared by the framework.
  AWS_BUCKET: string | undefined
  AWS_URL: string | undefined
  AWS_PROFILE: string | undefined
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

/**
 * Every environment variable the application can read through `env`.
 *
 * Extends the framework's own set. An application adds its variables by
 * declaring them in `config/env.ts` and nothing else:
 *
 * ```ts
 * export default defineEnv({
 *   STRIPE_WEBHOOK_SECRET: { validation: schema.string(), default: '' },
 * })
 * ```
 *
 * `storage/framework/types/env.d.ts` reads that schema and augments this
 * interface. It cannot live in this package: a published `.d.ts` naming
 * `../../../config/env` resolves to nothing under `node_modules/`. Applications
 * used to write the augmentation themselves, which is boilerplate with one
 * correct spelling that silently types nothing when omitted.
 *
 * Nothing is generated: the types follow the schema, so they are the same on a
 * fresh clone, in CI, and in production. They used to come from a generated
 * `storage/framework/types/env.d.ts` whose key set was scraped from whichever
 * `.env` happened to be on the machine running the generator, and whose types
 * were read off each variable's live value there - so a production-only
 * variable could never be typed at all, and one that was set locally could be
 * `number` on one machine and `string` on another.
 */
export interface StacksEnv extends FrameworkEnv {}

/**
 * A key that can be written back to an `.env` file.
 *
 * Every declared variable, with autocompletion, without rejecting one the
 * types do not know about yet.
 */
export type EnvKey = keyof StacksEnv | (string & {})

/** The value type a single `config/env.ts` entry describes. */
type EnvValueOf<TEntry> = TEntry extends { validation: Validator<infer TValue> }
  ? TValue
  : TEntry extends { default: infer TDefault }
    ? TDefault
    : string

/**
 * The `StacksEnv` members an application's `config/env.ts` contributes.
 *
 * Each entry is typed by its validator, so `schema.number()` is a `number` and
 * `schema.enum(['a', 'b'])` is `'a' | 'b'`, and every variable is optional
 * because the process may simply not have it set. Keys the framework already
 * declares are dropped: re-stating one with a different type is what makes a
 * merged declaration fail to compile.
 */
export type InferEnv<TSchema> = {
  [K in Exclude<keyof TSchema, keyof FrameworkEnv>]: EnvValueOf<TSchema[K]> | undefined
}

/**
 * Declare the application's environment variables.
 *
 * Returns the schema with its literal type intact, which is what lets
 * {@link InferEnv} read each entry's validator.
 */
export function defineEnv<const TSchema extends EnvConfig>(schema: TSchema): TSchema {
  return schema
}


export type EnvSchema = EnvConfig

export interface FrontendEnv {
  FRONTEND_APP_ENV: 'local' | 'development' | 'staging' | 'production'
  FRONTEND_APP_URL: string
}
export type FrontendEnvKeys = keyof FrontendEnv
