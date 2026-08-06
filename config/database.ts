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

      /**
       * Connection pool. Omit any knob to leave the driver on its default.
       */
      pool: {
        max: env.DB_POOL_MAX || 10,
        idleTimeoutMs: env.DB_POOL_IDLE_TIMEOUT_MS || 30_000,
        acquireTimeoutMs: env.DB_POOL_ACQUIRE_TIMEOUT_MS || 10_000,
      },

      /**
       * Read replicas. Each entry inherits the port, credentials, and
       * database name above, so usually only `host` is needed. Reads reach
       * them through `db.read`, or through every read once `reads.autoRoute`
       * below is enabled.
       */
      replicas: env.DB_READ_HOSTS
        ? env.DB_READ_HOSTS.split(',').map((host: string) => ({ host: host.trim() }))
        : [],
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

    /**
     * Vitess shards MySQL behind vtgate, which speaks the MySQL wire
     * protocol. `name` is a KEYSPACE, and the port is vtgate's 15306 - not
     * mysqld's 3306, which would reach a single tablet and bypass sharding.
     *
     * Unsharded keyspaces retain ordinary MySQL foreign keys and
     * AUTO_INCREMENT. Set DB_VITESS_SHARDED=true only when the keyspace is
     * actually split, then use application-generated IDs and a VSchema.
     */
    vitess: {
      name: env.DB_DATABASE || 'stacks',
      host: env.DB_HOST || '127.0.0.1',
      port: env.DB_PORT || 15306,
      username: env.DB_USERNAME || 'root',
      password: env.DB_PASSWORD || '',
      prefix: '',
      sharded: !['0', 'false', 'no', 'off'].includes(String(env.DB_VITESS_SHARDED ?? 'true').toLowerCase()),
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
   * **Model Discovery**
   *
   * Which model definitions the migration generator treats as yours.
   */
  models: {
    /**
     * Generate migrations for the framework's own models in
     * `storage/framework/defaults/app/Models` on top of your `app/Models`.
     *
     * Leave this off unless your app uses built-in models without publishing
     * them; the defaults already stand in on their own when `app/Models` is
     * empty. `./buddy publish model <Name>` copies a single one into your app.
     *
     * Override for one run with `STACKS_INCLUDE_FRAMEWORK_MODELS=1`.
     */
    includeFrameworkDefaults: false,
  },

  /**
   * **Read Routing**
   *
   * How reads are distributed across the replicas declared on the active
   * connection above.
   */
  reads: {
    /**
     * Send plain reads to a replica without the caller asking for it.
     *
     * Off by default, deliberately. Replication is asynchronous, so a row
     * just written to the primary may not be on a replica yet - flipping
     * this on turns every `Model.find()` into a potential stale read. The
     * router still keeps reads on the primary inside a transaction and
     * after a write in the same request, which covers the common
     * read-your-writes case, but anything outside that window can be stale.
     *
     * Leave it off and use `db.read` for the specific queries that tolerate
     * lag (dashboards, reports, search) unless you have decided the whole
     * app can.
     */
    autoRoute: env.DB_READ_AUTO_ROUTE ?? false,

    /** 'round-robin' (default), 'weighted', or 'random'. */
    strategy: 'round-robin',
  },

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
