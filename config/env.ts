import type { EnvConfig } from '@stacksjs/env'
import { schema } from '@stacksjs/validation'

/**
 * **Env Configuration & Validations**
 *
 * This configuration defines all of your Env validations. Because Stacks is fully-typed, you
 * may hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  APP_NAME: schema.string(),
  APP_ENV: schema.enum(['local', 'dev', 'stage', 'prod']),
  APP_KEY: schema.string(),
  APP_URL: schema.string(),

  PORT: schema.number(),
  PORT_BACKEND: schema.number(),
  PORT_ADMIN: schema.number(),
  PORT_LIBRARY: schema.number(),
  PORT_DESKTOP: schema.number(),
  PORT_EMAIL: schema.number(),
  PORT_DOCS: schema.number(),
  PORT_INSPECT: schema.number(),
  PORT_API: schema.number(),
  PORT_SYSTEM_TRAY: schema.number(),

  APP_MAINTENANCE: schema.boolean(),
  DEBUG: schema.boolean(),

  API_PREFIX: schema.string(),
  DOCS_PREFIX: schema.string(),

  DB_CONNECTION: schema.enum(['mysql', 'sqlite', 'postgres']),
  DB_HOST: schema.string(),
  DB_PORT: schema.number(),
  DB_DATABASE: schema.string(),
  DB_USERNAME: schema.string(),
  DB_PASSWORD: schema.string(),

  AWS_ACCOUNT_ID: schema.string(),
  AWS_ACCESS_KEY_ID: schema.string(),
  AWS_SECRET_ACCESS_KEY: schema.string(),
  AWS_DEFAULT_REGION: schema.string(),
  AWS_DEFAULT_PASSWORD: schema.string(),

  MAIL_MAILER: schema.enum(['ses', 'sendmail', 'log', 'smtp']),
  MAIL_HOST: schema.string(),
  MAIL_PORT: schema.number(),
  MAIL_USERNAME: schema.string(),
  MAIL_PASSWORD: schema.string(),
  MAIL_ENCRYPTION: schema.string(),
  MAIL_FROM_NAME: schema.string(),
  MAIL_FROM_ADDRESS: schema.string(),

  SEARCH_ENGINE_DRIVER: schema.enum(['meilisearch', 'algolia', 'typesense']),
  MEILISEARCH_HOST: schema.string(),
  MEILISEARCH_KEY: schema.string(),

  FRONTEND_APP_ENV: schema.enum(['development', 'staging', 'production']),
  FRONTEND_APP_URL: schema.string(),
} satisfies EnvConfig
