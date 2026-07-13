import type { DatabaseConfig } from '@stacksjs/types'
import type { SupportedDialect } from 'bun-query-builder'
import { env } from '@stacksjs/env'
/**
 * **Database Configuration**
 *
 * This configuration defines all of your database options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  default: env.DB_CONNECTION as SupportedDialect || 'sqlite',

  connections: {
    sqlite: {
      // SQLite requires a file path, not a database name
      database: env.DB_DATABASE_PATH || 'database/stacks.sqlite',
      prefix: '',
    },

    dynamodb: {
      key: env.AWS_ACCESS_KEY_ID || '',
      secret: env.AWS_SECRET_ACCESS_KEY || '',
      region: env.AWS_DEFAULT_REGION || 'us-east-1',
      prefix: env.DB_DATABASE || 'stacks',
      endpoint: env.DB_PORT ? `http://localhost:${env.DB_PORT}` : 'http://localhost:8000',
    },

    mysql: {
      name: env.DB_DATABASE || 'stacks',
      host: env.DB_HOST || '127.0.0.1',
      port: env.DB_PORT ||3306,
      username: env.DB_USERNAME || 'root',
      password: env.DB_PASSWORD || '',
      prefix: '',
    },

    // SingleStore speaks the MySQL wire protocol on port 3306. Managed
    // SingleStore (Helios) endpoints require TLS — set DB_SSL=true.
    singlestore: {
      name: env.DB_DATABASE || 'stacks',
      host: env.DB_HOST || '127.0.0.1',
      port: env.DB_PORT || 3306,
      username: env.DB_USERNAME || 'root',
      password: env.DB_PASSWORD || '',
      prefix: '',
    },

    postgres: {
      name: env.DB_DATABASE || 'stacks',
      host: env.DB_HOST || '127.0.0.1',
      port: env.DB_PORT ||5432,
      username: env.DB_USERNAME || '',
      password: env.DB_PASSWORD || '',
      prefix: '',
    },
  },

  migrations: 'migrations',
  migrationLocks: 'migration_locks',

  /**
   * Migration Safety Guards
   *
   * Gate the destructive migration commands behind human confirmation so an
   * accidental command can't wipe a database. Override per-run with the
   * DB_MIGRATE_CONFIRM / DB_MIGRATE_FRESH env vars.
   */
  safety: {
    /**
     * Prompt for confirmation before `buddy migrate` applies changes.
     * `--force` skips it; non-interactive runs (CI) proceed automatically.
     */
    confirmMigrate: env.DB_MIGRATE_CONFIRM ?? true,

    /**
     * Guard for `buddy migrate:fresh` (drops ALL tables):
     * 'allow' | 'confirm' | 'disabled'. Defaults to a hard 'disabled' in
     * production and 'allow' (typed confirmation) everywhere else.
     */
    migrateFresh: env.DB_MIGRATE_FRESH ?? (env.APP_ENV === 'production' || env.APP_ENV === 'prod' ? 'disabled' : 'allow'),
  },

  /**
   * Query Logging Configuration
   *
   * This section configures the database query monitoring system.
   */
  queryLogging: {
    /**
     * Enable query logging to database
     */
    enabled: env.DB_QUERY_LOGGING_ENABLED ?? true,

    /**
     * The threshold in milliseconds to mark a query as slow
     */
    slowThreshold: env.DB_QUERY_LOGGING_SLOW_THRESHOLD || 100,

    /**
     * How many days to keep query logs
     */
    retention: env.DB_QUERY_LOGGING_RETENTION_DAYS || 7,

    /**
     * How often to run the pruning job in hours
     */
    pruneFrequency: env.DB_QUERY_LOGGING_PRUNE_FREQUENCY || 24,

    /**
     * Patterns to exclude from logging
     */
    excludedQueries: [
      // Don't log the query_logs table itself to avoid recursion
      'query_logs',
    ],

    /**
     * Query analysis configuration
     */
    analysis: {
      /**
       * Enable detailed query analysis
       */
      enabled: env.DB_QUERY_LOGGING_ANALYSIS_ENABLED ?? true,

      /**
       * Analyze all queries, not just slow ones
       */
      analyzeAll: env.DB_QUERY_LOGGING_ANALYZE_ALL ?? false,

      /**
       * Collect EXPLAIN plans for SELECT queries
       */
      explainPlan: env.DB_QUERY_LOGGING_EXPLAIN_PLAN ?? true,

      /**
       * Generate optimization suggestions
       */
      suggestions: env.DB_QUERY_LOGGING_SUGGESTIONS ?? true,
    },
  },
} satisfies DatabaseConfig
