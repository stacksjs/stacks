import type { DatabaseConfig } from '@stacksjs/types'
import type { SupportedDialect } from 'bun-query-builder'

// Use direct environment variable access to avoid circular dependencies
const envVars = typeof Bun !== 'undefined' ? Bun.env : process.env
/**
 * **Database Configuration**
 *
 * This configuration defines all of your database options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  default: envVars.DB_CONNECTION as SupportedDialect || 'mysql',

  connections: {
    sqlite: {
      database: envVars.DB_DATABASE || 'stacks',
      prefix: '',
    },

    dynamodb: {
      key: envVars.AWS_ACCESS_KEY_ID || '',
      secret: envVars.AWS_SECRET_ACCESS_KEY || '',
      region: envVars.AWS_DEFAULT_REGION || 'us-east-1',
      prefix: envVars.DB_DATABASE || 'stacks',
      endpoint: envVars.DB_PORT ? `http://localhost:${envVars.DB_PORT}` : 'http://localhost:8000',
    },

    mysql: {
      name: envVars.DB_DATABASE || 'stacks',
      host: envVars.DB_HOST || '127.0.0.1',
      port: Number(envVars.DB_PORT) || 3306,
      username: envVars.DB_USERNAME || 'root',
      password: envVars.DB_PASSWORD || '',
      prefix: '',
    },

    postgres: {
      name: envVars.DB_DATABASE || 'stacks',
      host: envVars.DB_HOST || '127.0.0.1',
      port: Number(envVars.DB_PORT) || 5432,
      username: envVars.DB_USERNAME || '',
      password: envVars.DB_PASSWORD || '',
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
    enabled: envVars.DB_QUERY_LOGGING_ENABLED === 'true' || true,

    /**
     * The threshold in milliseconds to mark a query as slow
     */
    slowThreshold: Number(envVars.DB_QUERY_LOGGING_SLOW_THRESHOLD || 100),

    /**
     * How many days to keep query logs
     */
    retention: Number(envVars.DB_QUERY_LOGGING_RETENTION_DAYS || 7),

    /**
     * How often to run the pruning job in hours
     */
    pruneFrequency: Number(envVars.DB_QUERY_LOGGING_PRUNE_FREQUENCY || 24),

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
      enabled: envVars.DB_QUERY_LOGGING_ANALYSIS_ENABLED === 'true' || true,

      /**
       * Analyze all queries, not just slow ones
       */
      analyzeAll: envVars.DB_QUERY_LOGGING_ANALYZE_ALL === 'true' || false,

      /**
       * Collect EXPLAIN plans for SELECT queries
       */
      explainPlan: envVars.DB_QUERY_LOGGING_EXPLAIN_PLAN === 'true' || true,

      /**
       * Generate optimization suggestions
       */
      suggestions: envVars.DB_QUERY_LOGGING_SUGGESTIONS === 'true' || true,
    },
  },
} satisfies DatabaseConfig
