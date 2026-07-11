/**
 * # `TransactionBackoffConfig`
 *
 * Controls exponential backoff between transaction retry attempts.
 *
 * - `baseMs`: Initial delay in milliseconds used for the first retry.
 * - `factor`: Multiplicative growth factor applied per attempt (e.g., 2 = doubles).
 * - `maxMs`: Maximum delay cap in milliseconds; backoff never exceeds this value.
 * - `jitter`: When true, adds a small randomization to the delay to reduce thundering herds.
 *
 * The delay for attempt n (1-indexed) is roughly: min(maxMs, baseMs * factor^(n-1)),
 * optionally adjusted by jitter.
 */
export declare interface TransactionBackoffConfig {
  baseMs: number
  factor: number
  maxMs: number
  jitter: boolean
}
/**
 * # `TransactionDefaultsConfig`
 *
 * Default settings applied to transactional operations.
 *
 * - `retries`: Number of times a transaction may be retried on retriable errors
 *   (e.g., deadlocks, serialization failures).
 * - `isolation`: Transaction isolation level.
 *   - 'read committed': Prevents dirty reads; non-repeatable reads possible.
 *   - 'repeatable read': Ensures stable snapshot for a transaction; phantom reads may vary by DB.
 *   - 'serializable': Highest isolation; transactions appear to run one-by-one.
 * - `sqlStates`: Additional vendor error codes considered retriable.
 * - `backoff`: Backoff configuration applied between retries.
 */
export declare interface TransactionDefaultsConfig {
  retries: number
  isolation?: 'read committed' | 'repeatable read' | 'serializable'
  sqlStates: string[]
  backoff: TransactionBackoffConfig
}
/**
 * # `TimestampConfig`
 *
 * Column naming conventions for timestamp fields used by helpers.
 *
 * - `createdAt`: Column name for row creation time (e.g., 'created_at').
 * - `updatedAt`: Column name for last update time (e.g., 'updated_at').
 * - `defaultOrderColumn`: Column used by helpers like `latest()`/`oldest()`.
 */
export declare interface TimestampConfig {
  createdAt: string
  updatedAt: string
  defaultOrderColumn: string
}
/**
 * # `PaginationConfig`
 *
 * Defaults for result pagination helpers.
 *
 * - `defaultPerPage`: Default LIMIT used by paginate helpers when not specified.
 * - `cursorColumn`: Default column used for cursor-based pagination (e.g., 'id').
 */
export declare interface PaginationConfig {
  defaultPerPage: number
  cursorColumn: string
}
/**
 * # `AliasingConfig`
 *
 * Controls how selected columns from joined relations are aliased.
 *
 * - `relationColumnAliasFormat`:
 *   - 'table_column': Aliases as `${table}_${column}` (e.g., `posts_title`).
 *   - 'table.dot.column': Aliases with dot notation (e.g., `posts.title`).
 *   - 'camelCase': Aliases as camelCase from `${table}_${column}` (e.g., `postsTitle`).
 */
export declare interface AliasingConfig {
  relationColumnAliasFormat: 'table_column' | 'table.dot.column' | 'camelCase'
}
/**
 * # `RelationsConfig`
 *
 * Conventions for inferring foreign key names and singularization.
 *
 * - `foreignKeyFormat`:
 *   - 'singularParent_id': Uses `${singular(parent)}_id` (e.g., `user_id`).
 *   - 'parentId': Uses camelCase `parentId` (e.g., `userId`).
 * - `singularizeStrategy`:
 *   - 'stripTrailingS': Naively remove trailing 's' when singularizing (default behavior when enabled elsewhere).
 *   - 'none': Do not singularize relation/table names.
 */
export declare interface RelationsConfig {
  foreignKeyFormat: 'singularParent_id' | 'parentId'
  singularizeStrategy?: 'stripTrailingS' | 'none'
  maxDepth?: number
  maxEagerLoad?: number
  detectCycles?: boolean
}
/**
 * # `SqliteConfig`
 *
 * SQLite-specific connection behavior.
 *
 * - `pragmas`: bootstrap pragmas applied to every sqlite connection the
 *   library itself opens (the query-builder connection and the model-layer
 *   executor). Pragmas like `foreign_keys` and `busy_timeout` are
 *   per-connection in SQLite — they cannot be persisted in the database
 *   file — so they must be re-applied on every new connection. When unset,
 *   `DEFAULT_SQLITE_PRAGMAS` is used (WAL journal, `foreign_keys = ON`,
 *   `busy_timeout = 5000`). Setting this REPLACES the default list.
 *   Caller-supplied `Database` instances (`configureOrm({ database: db })`)
 *   are never touched — bring-your-own connection means bring-your-own
 *   pragmas.
 */
export declare interface SqliteConfig {
  pragmas?: string[]
}
/**
 * # `SqlConfig`
 *
 * Dialect-specific SQL toggles.
 *
 * - `randomFunction`:
 *   - 'RANDOM()': PostgreSQL/SQLite style function for random ordering.
 *   - 'RAND()': MySQL style function for random ordering.
 * - `sharedLockSyntax`:
 *   - 'FOR SHARE': PostgreSQL style shared lock.
 *   - 'LOCK IN SHARE MODE': MySQL style shared lock.
 * - `jsonContainsMode`:
 *   - 'operator': Use native operators when available (e.g., Postgres `@>`).
 *   - 'function': Use a function-based approach (e.g., `json_contains`) when operators are not available.
 */
export declare interface SqlConfig {
  randomFunction?: 'RANDOM()' | 'RAND()'
  sharedLockSyntax?: 'FOR SHARE' | 'LOCK IN SHARE MODE'
  jsonContainsMode?: 'operator' | 'function'
}
/**
 * # `QueryHooks`
 *
 * Optional lifecycle hooks around query execution. These are invoked for any
 * statement executed through the builder (select/insert/update/delete/raw).
 */
export declare interface QueryHooks {
  onQueryStart?: (event: { sql: string, params?: any[], kind?: 'select' | 'insert' | 'update' | 'delete' | 'raw' }) => void
  onQueryEnd?: (event: { sql: string, params?: any[], durationMs: number, rowCount?: number, kind?: 'select' | 'insert' | 'update' | 'delete' | 'raw' }) => void
  onQueryError?: (event: { sql: string, params?: any[], error: any, durationMs: number, kind?: 'select' | 'insert' | 'update' | 'delete' | 'raw' }) => void
  startSpan?: (event: { sql: string, params?: any[], kind?: 'select' | 'insert' | 'update' | 'delete' | 'raw' }) => { end: (error?: any) => void }
  slowQueryThresholdMs?: number
  onSlowQuery?: (event: { sql: string, params?: any[], durationMs: number, kind?: 'select' | 'insert' | 'update' | 'delete' | 'raw' }) => void
  beforeCreate?: (event: { table: string, data: any }) => void | Promise<void>
  afterCreate?: (event: { table: string, data: any, result: any }) => void | Promise<void>
  beforeUpdate?: (event: { table: string, data: any, where?: any }) => void | Promise<void>
  afterUpdate?: (event: { table: string, data: any, where?: any, result: any }) => void | Promise<void>
  beforeDelete?: (event: { table: string, where?: any }) => void | Promise<void>
  afterDelete?: (event: { table: string, where?: any, result: any }) => void | Promise<void>
}
/**
 * # `FeatureToggles`
 *
 * Optional features that may be enabled per instance.
 *
 * - `distinctOn`: Enables PostgreSQL-like `DISTINCT ON (...)` behavior in builders.
 */
export declare interface FeatureToggles {
  distinctOn: boolean
}
/**
 * Connection-pool tuning for the underlying Bun SQL driver (Postgres/MySQL).
 *
 * All fields are optional and only apply to the network drivers — SQLite uses
 * a single `bun:sqlite` handle and ignores pool settings. Timeouts are given in
 * milliseconds here for ergonomics and converted to the driver's second
 * resolution at connect time (sub-second values are rounded).
 *
 * See stacksjs/bun-query-builder#1014.
 */
export declare interface PoolConfig {
  max?: number
  idleTimeoutMs?: number
  acquireTimeoutMs?: number
  maxLifetimeMs?: number
  min?: number
  autoReconnect?: boolean
}
export declare interface DatabaseConfig {
  database: string
  username: string
  password: string
  host: string
  url?: string
  port: number
  ssl?: boolean
  pool?: PoolConfig
}
/**
 * # `BrowserConfig`
 *
 * Configuration for browser mode that uses fetch() API instead of direct database connections.
 * This enables the query builder to work in browser environments by translating queries to REST API calls.
 */
export declare interface BrowserConfig {
  baseUrl: string
  getToken?: () => string | null | Promise<string | null>
  onUnauthorized?: () => void
  headers?: Record<string, string>
  timeout?: number
  transformResponse?: <T>(response: any) => T
  transformRequest?: <T>(data: T) => any
}
/**
 * # `QueryBuilderConfig`
 *
 * Global configuration for the query builder.
 *
 * - `verbose`: Enables extra logging/diagnostics from the builder.
 * - `dialect`: Target SQL dialect. See `SupportedDialect` for details.
 * - `timestamps`: Timestamp column naming conventions.
 * - `pagination`: Defaults for pagination helpers.
 * - `aliasing`: How relation columns are aliased in SELECT lists.
 * - `relations`: Foreign key naming and singularization conventions.
 * - `transactionDefaults`: Default retry/backoff/isolation behavior for transactions.
 * - `sql`: Dialect-specific SQL toggles.
 * - `features`: Optional feature flags.
 * - `debug.captureText`: When true, the builder exposes a `toText()` method to capture SQL text in memory for debugging.
 */
export declare interface QueryBuilderConfig {
  verbose: boolean
  dialect: SupportedDialect
  database: DatabaseConfig
  browser?: BrowserConfig
  timestamps: TimestampConfig
  pagination: PaginationConfig
  aliasing: AliasingConfig
  relations: RelationsConfig
  transactionDefaults: TransactionDefaultsConfig
  sql: SqlConfig
  sqlite?: SqliteConfig
  features: FeatureToggles
  debug?: {
    captureText: boolean
  }
  hooks?: QueryHooks
  softDeletes?: {
    enabled: boolean
    column: string
    defaultFilter: boolean
  }
}
export declare interface CliOption {
  verbose: boolean
}
export declare interface SqlOptions {
  limit?: number
}
export declare interface WaitReadyOptions {
  attempts?: number
  delay?: number
}
export declare interface FileOptions {
  params?: string
}
export declare interface IntrospectOptions {
  verbose?: boolean
}
export declare interface MigrateOptions {
  dialect?: SupportedDialect
  state?: string
  apply?: boolean
  full?: boolean
  applyRenames?: boolean
  fromDb?: boolean
  dryRun?: boolean
}
export declare interface GenerateMigrationResult {
  sql: string
  sqlStatements: string[]
  hasChanges: boolean
  plan: any
  operations?: import('./migrations').MigrationOperation[]
}
export declare interface UnsafeOptions {
  params?: string
}
/**
 * # `SupportedDialect`
 *
 * The SQL dialect used to tailor generated SQL and certain features.
 * - 'postgres': Uses `RANDOM()`, supports JSON operators (e.g. `@>`), `FOR SHARE`, `FOR UPDATE`, CTEs
 * - 'mysql': Uses `RAND()`, shared locks via `LOCK IN SHARE MODE`
 * - 'singlestore': MySQL wire-compatible distributed SQL. Shares MySQL's
 *   placeholder/quoting/upsert/`LAST_INSERT_ID` behavior (see `isMysqlLike`),
 *   but its DDL adds distributed-table concepts (`SHARD KEY`, `SORT KEY`,
 *   `ROWSTORE`/columnstore) and drops foreign keys — handled by the dedicated
 *   `SingleStoreDriver`.
 * - 'sqlite': Lightweight engine; some features are limited or emulated
 * - 'browser': Browser-compatible mode that uses fetch() API calls instead of direct database connections
 */
export type SupportedDialect = 'postgres' | 'mysql' | 'singlestore' | 'sqlite' | 'browser';
