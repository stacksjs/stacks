import { defineEnv } from '@stacksjs/env'
import { schema } from '@stacksjs/validation'

/**
 * **Env Configuration & Validations**
 *
 * This configuration defines all of your Env validations. Because Stacks is fully-typed, you
 * may hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 *
 * This file is also where `env` gets its types. Declare a variable here and
 * `env.YOUR_VARIABLE` is typed everywhere, from its validator - `schema.number()`
 * is a `number`, `schema.enum([...])` is the union of those literals. There is
 * nothing to generate and nothing to keep in step: a variable set only in your
 * deploy secrets is typed exactly like one in your local `.env`.
 */
const envSchema = defineEnv({
  APP_NAME: {
    validation: schema.string(),
    default: 'Stacks',
  },

  APP_ENV: {
    validation: schema.enum(['local', 'development', 'dev', 'staging', 'stage', 'production', 'prod', 'test', 'testing']),
    default: 'local',
  },

  APP_KEY: {
    validation: schema.string(),
    default: 'base64:1234567890',
  },

  PORT: {
    validation: schema.number(),
    default: 3000,
  },

  PORT_BACKEND: {
    validation: schema.number(),
    default: 3000,
  },

  PORT_ADMIN: {
    validation: schema.number(),
    default: 3000,
  },

  PORT_LIBRARY: {
    validation: schema.number(),
    default: 3000,
  },

  PORT_DESKTOP: {
    validation: schema.number(),
    default: 3000,
  },

  PORT_EMAIL: {
    validation: schema.number(),
    default: 3000,
  },
  PORT_DOCS: {
    validation: schema.number(),
    default: 3000,
  },

  PORT_INSPECT: {
    validation: schema.number(),
    default: 3000,
  },

  PORT_API: {
    validation: schema.number(),
    default: 3000,
  },

  PORT_SYSTEM_TRAY: {
    validation: schema.number(),
    default: 3000,
  },

  APP_MAINTENANCE: {
    validation: schema.boolean(),
    default: false,
  },

  APP_MAINTENANCE_SECRET: {
    validation: schema.string(),
    default: '',
  },

  APP_COMING_SOON: {
    validation: schema.boolean(),
    default: false,
  },

  APP_COMING_SOON_SECRET: {
    validation: schema.string(),
    default: '',
  },

  DEBUG: {
    validation: schema.boolean(),
    default: false,
  },

  API_PREFIX: {
    validation: schema.string(),
    default: '/api',
  },

  DOCS_PREFIX: {
    validation: schema.string(),
    default: '/docs',
  },

  DB_CONNECTION: {
    validation: schema.enum(['mysql', 'sqlite', 'postgres', 'singlestore', 'vitess']),
    default: 'mysql',
  },

  DB_VITESS_SHARDED: {
    validation: schema.boolean(),
    default: true,
  },

  DB_HOST: {
    validation: schema.string(),
    default: 'localhost',
  },

  DB_PORT: {
    validation: schema.number(),
    default: 3306,
  },

  DB_POOL_MAX: {
    validation: schema.number(),
    default: 10,
  },

  DB_POOL_IDLE_TIMEOUT_MS: {
    validation: schema.number(),
    default: 30_000,
  },

  DB_POOL_ACQUIRE_TIMEOUT_MS: {
    validation: schema.number(),
    default: 10_000,
  },

  /** Comma-separated read replica hostnames, e.g. `replica-a,replica-b`. */
  DB_READ_HOSTS: {
    validation: schema.string(),
    default: '',
  },

  /**
   * Send every read to a replica without the caller asking. Off by default:
   * replication is asynchronous, so this trades read-after-write correctness
   * for primary load. See `config/database.ts` -> `reads.autoRoute`.
   */
  DB_READ_AUTO_ROUTE: {
    validation: schema.boolean(),
    default: false,
  },

  AWS_ACCOUNT_ID: {
    validation: schema.string(),
    default: '',
  },

  AWS_ACCESS_KEY_ID: {
    validation: schema.string(),
    default: '',
  },

  AWS_SECRET_ACCESS_KEY: {
    validation: schema.string(),
    default: '',
  },

  AWS_DEFAULT_REGION: {
    validation: schema.string(),
    default: '',
  },

  AWS_DEFAULT_PASSWORD: {
    validation: schema.string(),
    default: '',
  },

  MAIL_MAILER: {
    validation: schema.enum(['ses', 'sendgrid', 'mailgun', 'mailtrap', 'smtp', 'log', 'capture']),
    default: 'ses',
  },

  MAIL_HOST: {
    validation: schema.string(),
    default: '',
  },

  MAIL_PORT: {
    validation: schema.number(),
    default: 465,
  },

  MAIL_USERNAME: {
    validation: schema.string(),
    default: '',
  },

  MAIL_PASSWORD: {
    validation: schema.string(),
    default: '',
  },

  MAIL_FROM_ADDRESS: {
    validation: schema.string(),
    default: '',
  },

  SEARCH_ENGINE_DRIVER: {
    validation: schema.enum(['meilisearch', 'algolia', 'typesense']),
    default: 'meilisearch',
  },

  STRIPE_SECRET_KEY: {
    validation: schema.string(),
    default: '',
  },

  STRIPE_PUBLISHABLE_KEY: {
    validation: schema.string(),
    default: '',
  },

  MEILISEARCH_HOST: {
    validation: schema.string(),
    default: '',
  },

  MEILISEARCH_KEY: {
    validation: schema.string(),
    default: '',
  },

  FRONTEND_APP_ENV: {
    validation: schema.enum(['development', 'staging', 'production']),
    default: 'development',
  },

  FRONTEND_APP_URL: {
    validation: schema.string(),
    default: '',
  },
})

export default envSchema
