import type { DatabaseConfig } from '@stacksjs/types'
import { env } from '@stacksjs/env'

/**
 * **Database Configuration**
 *
 * This configuration defines all of your database options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  default: env.DB_CONNECTION || 'postgres',

  connections: {
    sqlite: {
      database: env.DB_DATABASE || 'stacks',
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
      port: Number(env.DB_PORT) || 3306,
      username: env.DB_USERNAME || 'root',
      password: env.DB_PASSWORD || '',
      prefix: '',
    },

    postgres: {
      name: env.DB_DATABASE || 'stacks',
      host: env.DB_HOST || '127.0.0.1',
      port: Number(env.DB_PORT) || 3306,
      username: env.DB_USERNAME || '',
      password: env.DB_PASSWORD || '',
      prefix: '',
    },
  },

  migrations: 'migrations',
  migrationLocks: 'migration_locks',

  /**
   * Query Logging Configuration
   *
   * This section configures the database query monitoring system.
   */
  queryLogging: {
    /**
     * Enable query logging to database
     */
    enabled: env.DB_QUERY_LOGGING_ENABLED === 'true' || true,

    /**
     * The threshold in milliseconds to mark a query as slow
     */
    slowThreshold: Number(env.DB_QUERY_LOGGING_SLOW_THRESHOLD || 100),

    /**
     * How many days to keep query logs
     */
    retention: Number(env.DB_QUERY_LOGGING_RETENTION_DAYS || 7),

    /**
     * How often to run the pruning job in hours
     */
    pruneFrequency: Number(env.DB_QUERY_LOGGING_PRUNE_FREQUENCY || 24),

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
      enabled: env.DB_QUERY_LOGGING_ANALYSIS_ENABLED === 'true' || true,

      /**
       * Analyze all queries, not just slow ones
       */
      analyzeAll: env.DB_QUERY_LOGGING_ANALYZE_ALL === 'true' || false,

      /**
       * Collect EXPLAIN plans for SELECT queries
       */
      explainPlan: env.DB_QUERY_LOGGING_EXPLAIN_PLAN === 'true' || true,

      /**
       * Generate optimization suggestions
       */
      suggestions: env.DB_QUERY_LOGGING_SUGGESTIONS === 'true' || true,
    },
  },
} satisfies DatabaseConfig
