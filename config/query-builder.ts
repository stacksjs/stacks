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
  snapshotDir: 'storage/framework/database',
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
    // The process-wide raw query builder has no model definition and cannot
    // know which tables use soft deletes. Model queries scope records from
    // the `useSoftDeletes` trait, while generated REST routes apply the same
    // trait-aware filter explicitly.
    enabled: false,
    column: 'deleted_at',
    defaultFilter: true,
  },
  // `Partial`, not the bare config type. `QueryBuilderConfig` is the RESOLVED
  // shape the library reads after merging its own defaults, so every field on
  // it is required — and declaring an app config against it means any field
  // upstream adds becomes a compile error here until someone restates a value
  // the library already defaults. That is how `migrationDir` and `snapshotDir`
  // ended up hard-coded in this file: not because the app wanted to override
  // them, but to satisfy a type. `setConfig()` has always taken
  // `Partial<QueryBuilderConfig>`, so this matches what the library actually
  // accepts.
} satisfies Partial<QueryBuilderConfig>
