import type { SupportedDialect } from 'bun-query-builder'

/**
 * Connection pool tuning.
 *
 * Every knob is optional — an omitted pool leaves the driver on its own
 * defaults, which is correct for a single-server app that has never had to
 * think about pooling. Ignored for SQLite, which is embedded and
 * single-connection.
 */
export interface PoolOptions {
  /** Maximum simultaneous connections. */
  max?: number
  /** Minimum idle connections kept warm. */
  min?: number
  /** Close a connection after it has been idle this long. */
  idleTimeoutMs?: number
  /** Give up waiting for a free connection after this long. */
  acquireTimeoutMs?: number
  /** Recycle a connection at this age regardless of health. */
  maxLifetimeMs?: number
  /** Reconnect automatically after the server drops a connection. */
  autoReconnect?: boolean
}

/**
 * A read replica of the connection it is declared on.
 *
 * Only `host` is required: port, credentials, and database name are
 * inherited from the primary, because a replica is the same database on a
 * different host. Requiring them per replica is how host lists drift out
 * of sync with a rotated password.
 */
export interface ReplicaOptions {
  /** Replica hostname. */
  host: string
  /** Defaults to the primary's port. */
  port?: number
  /** Defaults to the primary's username. */
  username?: string
  /** Defaults to the primary's password. */
  password?: string
  /** Relative share of read traffic under the `weighted` strategy. */
  weight?: number
}

/** How reads are distributed across replicas. */
export interface ReadPolicyOptions {
  /**
   * Route plain reads to a replica without the caller asking.
   *
   * Defaults to false. Replication is asynchronous, so enabling this
   * accepts that a read may not see a write that just committed. Reads
   * stay on the primary inside a transaction and after a write in the same
   * async context, which covers read-your-writes for a typical request.
   */
  autoRoute?: boolean
  /** Replica selection strategy. Defaults to `round-robin`. */
  strategy?: 'round-robin' | 'weighted' | 'random'
}

/** Fields shared by every client-server connection. */
export interface NetworkedConnectionOptions {
  pool?: PoolOptions
  replicas?: ReplicaOptions[]
}

/**
 * Where `buddy db:backup` copies a dump so that losing the instance does not
 * lose the data.
 *
 * `managedServices: { postgres: true }` puts the database on the same disk as
 * the web process. A dump written next to it survives a bad migration and
 * nothing else, which is why the deploy warns about it until this is set.
 * stacksjs/stacks#2313.
 */
export interface DatabaseBackupOptions {
  /**
   * `s3://bucket/prefix` or `disk://name/prefix`, naming a disk from
   * `config/filesystems.ts`. The scaffolded `config/cloud.ts` provisions an
   * encrypted, versioned `backups` bucket, so `disk://backups` usually needs
   * no new credentials.
   *
   * A local path is deliberately not accepted: `--out` already writes locally,
   * and a second copy on the same disk is not a backup of the box.
   *
   * `DB_BACKUP_DESTINATION` overrides this, so a deploy can set it without
   * editing config.
   */
  destination?: string
}

export interface DatabaseOptions {
  default: SupportedDialect
  logging?: boolean
  /** Where dumps go so they outlive the instance. Unset means local-only. */
  backups?: DatabaseBackupOptions
  connections: {
    mysql?: NetworkedConnectionOptions & {
      url?: string
      host?: string
      port?: number
      name?: string
      username?: string
      password?: string
      prefix?: string
    }

    // SingleStore is MySQL wire-compatible (port 3306); it shares MySQL's
    // connection shape and adds an optional `ssl` flag for managed (Helios)
    // endpoints, which require TLS.
    singlestore?: NetworkedConnectionOptions & {
      url?: string
      host?: string
      port?: number
      name?: string
      username?: string
      password?: string
      prefix?: string
      ssl?: boolean
    }

    /**
     * Vitess shards MySQL behind vtgate, which speaks the MySQL wire
     * protocol, so this shares MySQL's connection shape. Two differences
     * matter: `name` is a KEYSPACE (Vitess's unit of sharding), and the
     * port is vtgate's 15306 — 3306 would reach one tablet's mysqld and
     * bypass sharding entirely.
     */
    vitess?: NetworkedConnectionOptions & {
      url?: string
      host?: string
      port?: number
      name?: string
      username?: string
      password?: string
      prefix?: string
      ssl?: boolean
      /** Pin this connection to a tablet type, e.g. `keyspace@replica`. */
      tabletType?: 'primary' | 'replica' | 'rdonly'
      /** Whether this keyspace is split across shards. Defaults to true. */
      sharded?: boolean
    }

    sqlite: {
      url?: string
      database?: string
      prefix?: string
    }

    dynamodb?: {
      key?: string
      secret?: string
      region?: string
      prefix?: string
      endpoint?: string
    }

    postgres?: NetworkedConnectionOptions & {
      url?: string
      host?: string
      port?: number
      name?: string
      username?: string
      password?: string
      prefix?: string
    }
  }

  migrations: string
  migrationLocks: string

  /** How the migration generator decides which model definitions are in scope. */
  models?: {
    /**
     * Also generate migrations for the framework's own models in
     * `storage/framework/defaults/app/Models`, on top of your `app/Models`.
     *
     * Off by default. The defaults stand in only when `app/Models` is empty —
     * a vendored framework checkout, or a project that has not defined a model
     * yet. Merging them into every app meant a five-model project migrated
     * sixty-seven tables, most of them demo schema (`carts`, `coupons`,
     * `drivers`, ...), and most of its `migrations` rows had no SQL file in the
     * repo (stacksjs/stacks#2220).
     *
     * Turn it on if your app uses built-in models — `User`, `Team`, the
     * commerce set — without publishing them. `./buddy publish model <Name>`
     * is the alternative, and the one that leaves the app's schema
     * self-describing.
     *
     * Env override for a single run: `STACKS_INCLUDE_FRAMEWORK_MODELS=1`.
     *
     * @default false
     */
    includeFrameworkDefaults?: boolean
  }

  /**
   * How reads are distributed across the active connection's replicas.
   * Cross-cutting rather than per-connection: one connection is active at
   * a time, and the staleness trade-off is a property of the application.
   */
  reads?: ReadPolicyOptions

  /**
   * Safety guards for the destructive migration commands.
   *
   * These gate `buddy migrate` and `buddy migrate:fresh` behind explicit
   * human confirmation so an absent-minded command can't silently wipe or
   * reshape a database. Every value can be overridden per-run by an env
   * var (see each field) so CI/automation has an escape hatch.
   */
  safety?: {
    /**
     * Require an interactive confirmation before `buddy migrate` applies
     * anything. Bypass a single run with `--force`; automation without a
     * TTY (CI) proceeds without prompting. Env override: `DB_MIGRATE_CONFIRM`.
     *
     * @default true
     */
    confirmMigrate?: boolean

    /**
     * Guard level for `buddy migrate:fresh`, which DROPS every table before
     * re-migrating (total data loss):
     *   - `'allow'`    run after a typed confirmation; `--force` bypasses it
     *   - `'confirm'`  always require the typed confirmation; `--force` does NOT bypass
     *   - `'disabled'` refuse to run at all (the hard kill-switch)
     *
     * Env override: `DB_MIGRATE_FRESH` (`allow` | `confirm` | `disabled`).
     *
     * @default 'allow' in local/dev, 'disabled' when APP_ENV is production
     */
    migrateFresh?: 'allow' | 'confirm' | 'disabled'
  }

  // Query logging configuration
  queryLogging?: {
    enabled: boolean
    slowThreshold: number // in milliseconds
    retention: number // in days
    pruneFrequency: number // in hours
    excludedQueries?: string[] // patterns to exclude
    analysis?: {
      enabled: boolean
      analyzeAll: boolean // analyze all queries, not just slow ones
      explainPlan: boolean // collect EXPLAIN plans
      suggestions: boolean // generate optimization suggestions
    }
  }
}

export type DatabaseConfig = Partial<DatabaseOptions>

export interface FactoryOptions {
  name: string
  count?: number
  items: object
  columns: object
}

export interface SchemaOptions {
  database: string
}
