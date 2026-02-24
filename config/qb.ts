import type { QueryBuilderConfig, SupportedDialect } from 'bun-query-builder'
import { env } from '@stacksjs/env'

const dialect = (env.DB_CONNECTION as SupportedDialect) || 'sqlite'

// For SQLite, use file path; for other databases, use connection params
const databaseConfig = dialect === 'sqlite'
  ? { database: env.DB_DATABASE_PATH || 'database/stacks.sqlite' }
  : {
      database: env.DB_DATABASE || 'stacks',
      username: env.DB_USERNAME || '',
      password: env.DB_PASSWORD || '',
      host: env.DB_HOST || 'localhost',
      port: env.DB_PORT || 5432,
    }

export default {
  verbose: true,
  dialect,
  database: databaseConfig,
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    defaultOrderColumn: 'created_at',
  },
  pagination: {
    defaultPerPage: 25,
    cursorColumn: 'id',
  },
  aliasing: {
    relationColumnAliasFormat: 'table_column',
  },
  relations: {
    foreignKeyFormat: 'singularParent_id',
    maxDepth: 10,
    maxEagerLoad: 50,
    detectCycles: true,
  },
  transactionDefaults: {
    retries: 2,
    isolation: 'read committed',
    sqlStates: ['40001', '40P01'],
    backoff: {
      baseMs: 50,
      factor: 2,
      maxMs: 2000,
      jitter: true,
    },
  },
  sql: {
    randomFunction: 'RANDOM()',
    sharedLockSyntax: 'FOR SHARE',
    jsonContainsMode: 'operator',
  },
  features: {
    distinctOn: true,
  },
  debug: {
    captureText: true,
  },
  hooks: {},
  softDeletes: {
    enabled: false,
    column: 'deleted_at',
    defaultFilter: true,
  },
} satisfies QueryBuilderConfig