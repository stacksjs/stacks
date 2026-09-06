/**
 * Database utilities using bun-query-builder
 *
 * This module provides the database connection and query builder
 * configured using the stacks database config.
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import type { QueryHooks } from '@stacksjs/query-builder'
import { config as queryBuilderConfig, createQueryBuilder, registerPersistentQueryHooks, resetConnection as resetQueryBuilderConnection, setConfig } from '@stacksjs/query-builder'

// Use default values to avoid circular dependencies initially
// These can be overridden later once config is fully loaded
// Read from environment variables first
import { SQL } from 'bun'
import { env as envVars } from '@stacksjs/env'
import type { QueryBuilderDialect } from './dialect'
import type { FrameworkSchema } from './framework-schema'
import type { PoolConfig, ReadPolicyConfig, ReplicaConfig } from './driver-config'
import { getConnectionDefaults } from './defaults'
import { isMysqlWire, isVitessSharded, toQueryBuilderDialect } from './dialect'
import { relativeMigrationDirectory, resolveMigrationDirectory, snapshotDirForQueryBuilder } from './migration-path'
import { contextInTransaction, markContextWrote, resolveReplicaConnection, selectReplica, shouldRouteToReplica, withRoutingContext, withTransactionContext } from './replicas'
import { aggregateFunctions } from './types'

interface DbConnectionConfig {
  database?: string
  name?: string
  host?: string
  username?: string
  password?: string
  port?: number
  prefix?: string
  pool?: PoolConfig
  replicas?: ReplicaConfig[]
  sharded?: boolean
}

interface DbConfig {
  /** The chosen dialect, from `config/database.ts`. */
  default?: string
  connections: {
    sqlite: DbConnectionConfig
    mysql: DbConnectionConfig
    singlestore: DbConnectionConfig
    vitess: DbConnectionConfig
    postgres: DbConnectionConfig
  }
  reads?: ReadPolicyConfig
}

const sqliteDefaults = getConnectionDefaults('sqlite', envVars)
const mysqlDefaults = getConnectionDefaults('mysql', envVars)
const postgresDefaults = getConnectionDefaults('postgres', envVars)

let appEnv: string = envVars.APP_ENV || 'local'
let dbDriver: string = envVars.DB_CONNECTION || 'sqlite'
let queryBuilderDialect: QueryBuilderDialect = toQueryBuilderDialect(dbDriver)
let queryLoggingEnabled = envVars.DB_QUERY_LOGGING_ENABLED ?? !isProductionEnvironment(appEnv)
let dbConfig: DbConfig = {
  connections: {
    sqlite: { database: sqliteDefaults.database, prefix: '' },
    mysql: { name: mysqlDefaults.database, host: mysqlDefaults.host, username: mysqlDefaults.username, password: mysqlDefaults.password, port: mysqlDefaults.port, prefix: '' },
    singlestore: { name: mysqlDefaults.database, host: mysqlDefaults.host, username: mysqlDefaults.username, password: mysqlDefaults.password, port: mysqlDefaults.port, prefix: '' },
    // vtgate's port, not mysqld's — see VitessConfig in ./driver-config.
    vitess: { name: mysqlDefaults.database, host: mysqlDefaults.host, username: mysqlDefaults.username, password: mysqlDefaults.password, port: 15306, prefix: '', sharded: isVitessSharded() },
    postgres: { name: postgresDefaults.database, host: postgresDefaults.host, username: postgresDefaults.username, password: postgresDefaults.password, port: postgresDefaults.port, prefix: '' },
  },
}

// Test-only config mutex (stacksjs/stacks#1862 follow-up) ------------------
//
// `initializeDbConfig` mutates process-wide state (`dbConfig`, `dbDriver`,
// `appEnv`, and the cached `_dbInstance` below). Bun's test runner evaluates
// multiple test files' top-level code — including their `beforeAll`/`it`
// callbacks — concurrently in one process, so two files that each want
// their own isolated sqlite database and both call `initializeDbConfig()`
// can interleave: file B's call clobbers file A's config (and nulls the
// shared `_dbInstance`) while file A's own hooks/tests are still mid-flight,
// silently pointing file A's queries at file B's database instead.
//
// There's no per-file isolation of this state today — that would need
// AsyncLocalStorage-scoped config threaded through bun:test's hook
// scheduling, which bun:test doesn't expose a seam for — so instead, any
// test file that calls `initializeDbConfig` with its own database should
// hold this lock for its *entire* lifetime: acquire first thing in
// `beforeAll`, release last thing in `afterAll` (wrap the release in a
// `finally` so a thrown cleanup error can't leave the lock stuck and hang
// every subsequent file). That serializes just the subset of files that
// mutate this shared config against each other, while every other test
// file keeps running fully concurrently.
let dbConfigLockTail: Promise<void> = Promise.resolve()

/**
 * How long one file may hold the config lock before the queue moves on without
 * it. Generous, because a holder is a whole test file: it should never be
 * reached by a file that is merely slow, only by one that has stopped.
 */
const DB_CONFIG_LOCK_MAX_HOLD_MS = 60_000

export function acquireDbConfigLock(): Promise<() => void> {
  let release: () => void = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })

  const acquired = dbConfigLockTail.then(() => {
    // Armed on acquisition rather than on request, so a long queue does not
    // start the clock on files that are still waiting their turn.
    //
    // The advice above - always release from a `finally` - is still the right
    // way to use this, but it cannot be the only thing standing between one
    // file and every file after it. A holder that never releases, because it
    // crashed or its own hook timed out before `afterAll` ran, used to strand
    // the chain permanently: the next file's `beforeAll` waited on a promise
    // nothing would ever resolve, and bun reported it as a hook timeout in a
    // file that had done nothing wrong. That is what this watchdog is for.
    const watchdog = setTimeout(() => {
      console.warn(
        `[database] the db config lock was held for over ${DB_CONFIG_LOCK_MAX_HOLD_MS / 1000}s. `
        + 'Releasing it so the queue can proceed - a test file most likely failed before its afterAll ran.',
      )
      release()
    }, DB_CONFIG_LOCK_MAX_HOLD_MS)
    // Never keep the process alive just to watch a lock.
    ;(watchdog as { unref?: () => void }).unref?.()

    void held.then(() => clearTimeout(watchdog))

    return release
  })

  // `catch` keeps the chain alive: a rejection anywhere in it would otherwise
  // reject every future acquisition rather than just the file that failed.
  dbConfigLockTail = dbConfigLockTail.then(() => held).catch(() => {})

  return acquired
}

// Function to initialize the config when it's available
/**
 * The slice of the app config this reads, written out rather than left as
 * `any`. It is called with the whole config object, so naming only what it
 * consumes keeps it callable from anywhere while still checking the four
 * paths it walks.
 */
export interface DbConfigSource {
  app?: { env?: string }
  database?: {
    default?: string
    /*
     * Every connection optional, because that is how the app config declares
     * them - `config/database.ts` types each dialect as optional even though
     * it supplies them all. The stored `DbConfig` below requires all five, so
     * these two shapes were never the same type; the parameter being `any` is
     * what let them be assigned to one another without anybody noticing.
     */
    connections?: Partial<DbConfig['connections']>
    reads?: DbConfig['reads']
    queryLogging?: { enabled?: boolean }
  }
}

export function initializeDbConfig(config: DbConfigSource | null | undefined): void {
  if (config?.app?.env)
    appEnv = config.app.env

  if (config?.database?.default)
    dbDriver = config.database.default
  queryBuilderDialect = toQueryBuilderDialect(dbDriver)

  // Cast rather than a merge: replacing the whole object is the behaviour this
  // has always had, and an app that reaches here has supplied its connections.
  // Narrowing the shapes above is what makes the difference visible at all.
  if (config?.database?.connections)
    dbConfig = config.database as DbConfig

  queryLoggingEnabled = config?.database?.queryLogging?.enabled
    ?? envVars.DB_QUERY_LOGGING_ENABLED
    ?? !isProductionEnvironment(appEnv)

  syncDatabaseQueryHooks()

  // Update bun-query-builder config
  updateQueryBuilderConfig()

  // Drop the cached query-builder instance so the next `db` access renders
  // SQL for the overridden dialect. The connection itself is rebuilt by
  // bun-query-builder's signature check, but the cached instance keeps
  // rendering with the dialect captured at creation — a config override
  // from mysql back to sqlite otherwise executes `NOW()`-style SQL against
  // the sqlite connection (cross-file test interference).
  _dbInstance = null
  // Replica builders own their own connections to hosts named in the old
  // config, so a reconfigured replica list must not keep being served by
  // them. Dropped rather than closed: the pools are garbage-collected with
  // the builders, and closing here would race any read still in flight.
  _replicaInstances = new Map()
}

// Simple functions with defensive defaults
function getEnv(): string {
  return appEnv
}

function isProductionEnvironment(value: string): boolean {
  return value === 'production' || value === 'prod'
}

function getDriver(): string {
  return dbDriver
}

function getDatabaseConfig(): DbConfig {
  return dbConfig
}

/**
 * Get the dialect type for bun-query-builder.
 *
 * Collapses through the capability table rather than an if-chain: Stacks
 * tracks dialects that bun-query-builder has no separate renderer for
 * (they diverge only in DDL), and those must be handed down as the dialect
 * whose SQL they actually speak. Unknown values still fall back to sqlite,
 * matching the previous behavior.
 */
function getDialect(): QueryBuilderDialect {
  return queryBuilderDialect
}

/**
 * Get database configuration for bun-query-builder
 */
function getDbConfig(): { database: string, username?: string, password?: string, host?: string, port?: number } {
  const driver = getDriver()
  const database = getDatabaseConfig()
  const env = getEnv()

  if (driver === 'sqlite') {
    const defaultName = env !== 'testing' ? 'database/stacks.sqlite' : 'database/stacks_testing.sqlite'
    return {
      database: database.connections?.sqlite?.database ?? defaultName,
    }
  }

  if (driver === 'mysql') {
    return {
      database: database.connections?.mysql?.name || 'stacks',
      host: database.connections?.mysql?.host ?? '127.0.0.1',
      username: database.connections?.mysql?.username ?? 'root',
      password: database.connections?.mysql?.password ?? '',
      port: database.connections?.mysql?.port ?? 3306,
    }
  }

  // SingleStore reuses the MySQL connection shape (wire protocol + port 3306).
  if (driver === 'singlestore') {
    return {
      database: database.connections?.singlestore?.name || 'stacks',
      host: database.connections?.singlestore?.host ?? '127.0.0.1',
      username: database.connections?.singlestore?.username ?? 'root',
      password: database.connections?.singlestore?.password ?? '',
      port: database.connections?.singlestore?.port ?? 3306,
    }
  }

  // Vitess is dialed through vtgate on the MySQL wire protocol; `name` is a
  // keyspace rather than a database, but it occupies the same slot.
  if (driver === 'vitess') {
    return {
      database: database.connections?.vitess?.name || 'stacks',
      host: database.connections?.vitess?.host ?? '127.0.0.1',
      username: database.connections?.vitess?.username ?? 'root',
      password: database.connections?.vitess?.password ?? '',
      port: database.connections?.vitess?.port ?? 15306,
    }
  }

  if (driver === 'postgres') {
    const dbName = database.connections?.postgres?.name ?? 'stacks'
    const finalDbName = env === 'testing' ? `${dbName}_testing` : dbName

    return {
      database: finalDbName,
      host: database.connections?.postgres?.host ?? '127.0.0.1',
      username: database.connections?.postgres?.username ?? '',
      password: database.connections?.postgres?.password ?? '',
      port: database.connections?.postgres?.port ?? 5432,
    }
  }

  return { database: ':memory:' }
}

/**
 * Update bun-query-builder configuration
 */
/**
 * Where the model snapshot lives, relative to the project root.
 *
 * Exported and referenced by every `setConfig` call rather than repeated at
 * each one: `setConfig` replaces the query-builder config wholesale, so a call
 * site that omits this silently reverts the snapshot to the library default
 * and writes `.qb` into the project root. That has now happened twice from two
 * different call sites, which is a sign the value wants one home.
 */
export const QB_SNAPSHOT_DIR = 'storage/framework/database'

/**
 * The snapshot directory to hand to `setConfig`, resolved at call time.
 *
 * Read fresh on every call rather than frozen into a module constant: on a
 * Capistrano-style deploy `DB_SNAPSHOT_PATH` points at a shared directory that
 * outlives the release, and a value captured at import time would miss an env
 * loaded after this module (stacksjs/stacks#2351).
 */
export function qbSnapshotDir(): string {
  return snapshotDirForQueryBuilder()
}

/**
 * Process-wide query-builder soft-delete filtering must stay disabled.
 *
 * The raw query builder has no model definition, so it cannot know whether
 * the selected table carries the `useSoftDeletes` trait or even has a
 * `deleted_at` column. ModelQueryBuilder applies the trait-aware scope, and
 * the generated REST routes apply it from the model definition. Enabling
 * this global filter would incorrectly scope every raw table query.
 */
export const RAW_QUERY_SOFT_DELETE_CONFIG = {
  enabled: false,
  column: 'deleted_at',
  defaultFilter: true,
} as const

export interface DatabaseQueryLogEvent {
  query: {
    sql: string
    parameters?: unknown[]
  }
  queryDurationMillis: number
  error?: unknown
}

export function createDatabaseQueryHooks(dispatch: (event: DatabaseQueryLogEvent) => void | Promise<void>): QueryHooks {
  function forward(event: DatabaseQueryLogEvent): void {
    try {
      void Promise.resolve(dispatch(event)).catch(() => {})
    }
    catch {
      // Query diagnostics must never change the query result.
    }
  }

  return {
    onQueryEnd: event => forward({
      query: {
        sql: event.sql,
        parameters: event.params,
      },
      queryDurationMillis: event.durationMs,
    }),
    onQueryError: event => forward({
      query: {
        sql: event.sql,
        parameters: event.params,
      },
      queryDurationMillis: event.durationMs,
      error: event.error,
    }),
  }
}

let queryLoggerModule: Promise<typeof import('./query-logger')> | undefined

function forwardDatabaseQuery(event: DatabaseQueryLogEvent): void {
  // Keep delivery asynchronous without resolving the same module per query.
  // Failed imports remain retryable, so an unavailable logger cannot poison
  // diagnostics for the rest of the process.
  queryLoggerModule ??= import('./query-logger').catch((error) => {
    queryLoggerModule = undefined
    throw error
  })
  void queryLoggerModule
    .then(({ logQuery }) => logQuery(event))
    .catch(() => {})
}

let unregisterDatabaseQueryHooks: (() => void) | undefined

function syncDatabaseQueryHooks(): void {
  const shouldInstall = !isProductionEnvironment(appEnv) || queryLoggingEnabled
  if (shouldInstall && !unregisterDatabaseQueryHooks) {
    unregisterDatabaseQueryHooks = registerPersistentQueryHooks(createDatabaseQueryHooks(forwardDatabaseQuery))
  }
  else if (!shouldInstall && unregisterDatabaseQueryHooks) {
    unregisterDatabaseQueryHooks()
    unregisterDatabaseQueryHooks = undefined
  }
}

syncDatabaseQueryHooks()

/**
 * The active connection's pool block, if it declared one.
 *
 * SQLite is excluded on purpose: it is embedded and single-connection, so
 * a pool block there is a config mistake rather than something to honor.
 */
function getPoolConfig(): PoolConfig | undefined {
  const driver = getDriver()
  if (driver === 'sqlite')
    return undefined
  const connections = getDatabaseConfig().connections as Record<string, DbConnectionConfig | undefined>
  return connections?.[driver]?.pool
}

/** Replicas declared on the active connection. */
const EMPTY_REPLICAS: ReplicaConfig[] = []

function getReplicas(): ReplicaConfig[] {
  const driver = getDriver()
  if (driver === 'sqlite')
    return EMPTY_REPLICAS
  const connections = getDatabaseConfig().connections as Record<string, DbConnectionConfig | undefined>
  return connections?.[driver]?.replicas ?? EMPTY_REPLICAS
}

/** The app's read-routing policy. */
function getReadPolicy(): ReadPolicyConfig {
  return getDatabaseConfig().reads ?? {}
}

/** Establish read-routing state only when this connection can use a replica. */
export function withDatabaseRoutingContext<T>(fn: () => T): T {
  return getReplicas().length === 0 ? fn() : withRoutingContext(fn)
}

/**
 * Argument-passing variant for request dispatchers. Keeping the argument out
 * of a per-request closure matters on the no-replica path, while replica-aware
 * applications still establish the same AsyncLocalStorage routing boundary.
 */
export function runInDatabaseRoutingContext<T, A>(fn: (arg: A) => T, arg: A): T {
  return getReplicas().length === 0 ? fn(arg) : withRoutingContext(() => fn(arg))
}

/**
 * Translate the framework's millisecond pool knobs onto Bun's SQL driver
 * options, which are named differently and measured in seconds.
 *
 * `min` and `autoReconnect` are accepted on `PoolConfig` but not forwarded
 * — Bun's driver manages both itself, and passing unknown keys through
 * would be silently ignored anyway. Keeping them out of the mapping makes
 * that deliberate rather than accidental.
 */
function toBunPoolOptions(pool?: PoolConfig): Record<string, number> {
  if (!pool)
    return {}
  const options: Record<string, number> = {}
  if (pool.max !== undefined)
    options.max = pool.max
  if (pool.idleTimeoutMs !== undefined)
    options.idleTimeout = Math.round(pool.idleTimeoutMs / 1000)
  if (pool.acquireTimeoutMs !== undefined)
    options.connectionTimeout = Math.round(pool.acquireTimeoutMs / 1000)
  if (pool.maxLifetimeMs !== undefined)
    options.maxLifetime = Math.round(pool.maxLifetimeMs / 1000)
  return options
}

function updateQueryBuilderConfig(): void {
  const dialect = getDialect()
  const dbConfigForQb = getDbConfig()
  const pool = getPoolConfig()

  setConfig({
    dialect: dialect as Parameters<typeof setConfig>[0]['dialect'],
    vitess: {
      sharded: isVitessSharded(dbConfig.connections.vitess?.sharded),
    },
    // bun-query-builder accepts `pool` on its database config and maps it
    // onto Bun's driver options itself, so the block is handed down as-is
    // rather than pre-translated here. `toBunPoolOptions` exists for the
    // replica connections below, which are constructed directly.
    database: (pool ? { ...dbConfigForQb, pool } : dbConfigForQb),
    verbose: getEnv() !== 'production',
    // Must match the value migrations.ts sets. setConfig replaces the config
    // wholesale, so omitting this here silently reverts the snapshot to the
    // library default and writes a second copy to `.qb` in the project root -
    // the exact directory moving it was meant to remove.
    snapshotDir: qbSnapshotDir(),
    migrationDir: relativeMigrationDirectory(resolveMigrationDirectory(toQueryBuilderDialect(dialect), { snapshotDir: qbSnapshotDir() })),
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      defaultOrderColumn: 'created_at',
    },
    softDeletes: RAW_QUERY_SOFT_DELETE_CONFIG,
  })
}

// Initialize config immediately at module load time with env defaults
// This ensures bun-query-builder is configured before any queries run
updateQueryBuilderConfig()

/**
 * Lazy query builder instance - only created when first accessed.
 * This ensures the database connection is not made at module load time
 * which can cause issues in compiled binaries.
 */
let _dbInstance: ReturnType<typeof createQueryBuilder> | null = null

let _configInitPromise: Promise<void> | null = null

function ensureConfigLoaded(): Promise<void> {
  if (!_configInitPromise) {
    _configInitPromise = (async () => {
      try {
        const { config, overridesReady } = await import('@stacksjs/config')
        // `config.database` is a Proxy read (see `readMerged()` in
        // @stacksjs/config) that falls back to framework defaults until the
        // project's own `config/database.ts` has actually finished loading.
        // `overridesReady` is the signal for that — awaiting it here closes
        // a race where a fast one-shot script (e.g. a `bun -e` script or a
        // CLI command issuing its first query very early in boot) reads the
        // proxy before the project override lands, locks in the framework's
        // default connection settings via `initializeDbConfig`, and never
        // retries since `_dbInstance` is only invalidated from inside
        // `initializeDbConfig` itself.
        await overridesReady
        if (config) {
          initializeDbConfig(config)
          // Reset instance so next access uses updated config
          _dbInstance = null
        }
      }
      catch {
        // Config not available, use defaults from env vars
      }
    })()
  }

  return _configInitPromise
}

export async function ensureDatabaseConfigLoaded(): Promise<void> {
  await ensureConfigLoaded()
}

// SQLite bootstrap pragmas (stacksjs/stacks#1951) now live in
// @stacksjs/query-builder — the one chokepoint every framework
// query-builder instance is created through — so EVERY fresh sqlite
// connection gets `foreign_keys = ON`, including builders created outside
// this module (e.g. the ORM auto-CRUD routes). Re-exported here for
// backwards compatibility with existing imports.
export { applySqlitePragmas, SQLITE_BOOTSTRAP_PRAGMAS } from '@stacksjs/query-builder'

/**
 * SQLite transaction serialization (stacksjs/stacks#1953).
 *
 * Bun.SQL's sqlite adapter is a single shared connection and
 * bun-query-builder tracks transaction depth per-connection, so two
 * CONCURRENT `db.transaction()` calls interleave: the second BEGIN is
 * issued as a savepoint inside the first caller's transaction (or fails
 * outright with "cannot start a transaction within a transaction"), and
 * the first COMMIT destroys the second caller's savepoint ("no such
 * savepoint: qb_sp_N"). Either way the loser 500s on perfectly legal
 * work — e.g. two near-simultaneous registrations for different emails.
 * Queue transactions through a promise-chain mutex so they run one at a
 * time instead of colliding. MySQL/Postgres pool connections, so they
 * are unaffected; the patch is only applied for the sqlite dialect.
 *
 * Same-async-context NESTING is exempt from the queue: a nested
 * `db.transaction()` inside an open transaction's callback is the
 * sequential savepoint case bun-query-builder handles correctly, and
 * queueing it would deadlock — the inner call would wait for the outer
 * transaction (its own caller) to finish.
 */
const sqliteTxOwner = new AsyncLocalStorage<true>()
let sqliteTxTail: Promise<void> = Promise.resolve()

function serializeSqliteTransaction<T>(run: () => Promise<T>): Promise<T> {
  if (sqliteTxOwner.getStore())
    return run()

  const result = sqliteTxTail.then(() => sqliteTxOwner.run(true, run))
  // Keep the chain alive after a rollback — the rejection still surfaces
  // to this transaction's caller via `result`.
  sqliteTxTail = result.then(() => undefined, () => undefined)
  return result
}

function applySqliteTransactionSerialization(instance: RawQueryBuilder): void {
  // Patch the instance's own property (not the proxy) so internal callers
  // like `transactional()` — which invokes `this.transaction(...)` — are
  // serialized too.
  const original = (instance.transaction as (...args: any[]) => Promise<any>).bind(instance)
  ;(instance).transaction = (...args: any[]) =>
    serializeSqliteTransaction(() => original(...args))
}

/**
 * Mark the routing context as "inside a transaction" for the duration of
 * every `db.transaction()` call.
 *
 * Without this, rule 2 in `./replicas` could not be enforced: a SELECT
 * issued inside a transaction callback would look like any other read and
 * could be routed to a replica, where it would miss the transaction's own
 * uncommitted writes and run outside its isolation entirely.
 *
 * Patched onto the instance's own property rather than a wrapper object so
 * internal callers reach it too — `transactional()` invokes
 * `this.transaction(...)`, which would bypass a wrapper.
 */
function applyTransactionRoutingContext(instance: RawQueryBuilder): void {
  const original = (instance.transaction as (...args: any[]) => Promise<any>).bind(instance)
  ;(instance).transaction = (...args: any[]) =>
    withTransactionContext(() => original(...args))
}

function getDb(): ReturnType<typeof createQueryBuilder> {
  if (!_dbInstance) {
    updateQueryBuilderConfig()
    // stacksjs/stacks#1951 — the wrapped createQueryBuilder applies the
    // sqlite bootstrap pragmas to the freshly captured connection, so every
    // instance recreation (config reload nulls `_dbInstance`, and a config
    // change can swap bun-query-builder's signature-keyed singleton) is
    // re-bootstrapped without an explicit call here.
    _dbInstance = createQueryBuilder()
    // stacksjs/stacks#1953 — re-applied on every instance recreation
    // (config reload nulls `_dbInstance`). Pragmas themselves are applied
    // inside the wrapped createQueryBuilder (#1951), so only the
    // transaction serialization patch is needed here.
    if (getDialect() === 'sqlite')
      applySqliteTransactionSerialization(_dbInstance)
    // Applied after the sqlite patch so the routing context is the
    // outermost wrapper — a read issued while queued behind another
    // transaction is then treated as in-transaction and stays on the
    // primary, which is the conservative direction to be wrong in.
    applyTransactionRoutingContext(_dbInstance)
  }
  return _dbInstance
}

/**
 * Query builders bound to a replica, keyed by `host:port`.
 *
 * Cached because a builder owns a connection pool — rebuilding one per
 * read would open a fresh pool on every SELECT. Cleared alongside
 * `_dbInstance` whenever the config changes, so a reconfigured replica
 * list cannot keep serving reads from the old hosts.
 */
let _replicaInstances = new Map<string, ReturnType<typeof createQueryBuilder>>()

/**
 * Discard every cached database client after the underlying query-builder
 * connection is reset.
 *
 * The Stacks `db` proxy caches a query-builder instance, while
 * bun-query-builder separately caches the SQL connection captured by that
 * instance. Resetting only the lower cache leaves the proxy pointing at a
 * closed SQLite handle. Migration flows reconfigure the lower layer between
 * reset and replay, so both caches must be invalidated as one operation.
 */
export function resetDatabaseConnection(): void {
  resetQueryBuilderConnection()
  _dbInstance = null
  _replicaInstances = new Map()
}

/**
 * Build (or reuse) a query builder pointed at `replica`.
 *
 * The builder is created with an injected `SQL` connection, which is the
 * seam bun-query-builder provides for exactly this: the process-wide
 * config still supplies the dialect and rendering rules — correct, since a
 * replica runs the same engine as its primary — while the connection
 * itself points somewhere else.
 */
function getReplicaDb(replica: ReplicaConfig): ReturnType<typeof createQueryBuilder> {
  const primary = getDbConfig()
  const resolved = resolveReplicaConnection(replica, primary)
  const key = `${resolved.host}:${resolved.port ?? ''}`

  const cached = _replicaInstances.get(key)
  if (cached)
    return cached

  const scheme = isMysqlWire(getDriver()) ? 'mysql' : 'postgres'
  const auth = resolved.username
    ? `${encodeURIComponent(resolved.username)}:${encodeURIComponent(resolved.password ?? '')}@`
    : ''
  const url = `${scheme}://${auth}${resolved.host}:${resolved.port}/${resolved.database}`

  const sql = new SQL({ url, ...toBunPoolOptions(getPoolConfig()) })
  const instance = createQueryBuilder({ sql })
  _replicaInstances.set(key, instance)
  return instance
}

/**
 * The builder a read should use right now.
 *
 * Falls back to the primary whenever routing is not permitted — no
 * replicas configured, auto-routing off, inside a transaction, or after a
 * write in this async context. See `./replicas` for why each of those
 * carve-outs exists.
 */
function getReadDb(): ReturnType<typeof createQueryBuilder> {
  const replicas = getReplicas()
  if (replicas.length === 0)
    return getDb()

  const policy = getReadPolicy()

  if (!shouldRouteToReplica({ policy, replicas }))
    return getDb()

  const replica = selectReplica(replicas, policy.strategy)
  return replica ? getReplicaDb(replica) : getDb()
}

/**
 * Explicitly replica-routed handle: `db.read.selectFrom('users')`.
 *
 * Unlike automatic routing this ignores `reads.autoRoute` — asking for
 * `db.read` IS the statement that this particular query tolerates a stale
 * result. It still respects the transaction carve-out, because a read
 * inside a transaction must see that transaction's own writes no matter
 * how it was requested.
 */
function getExplicitReadDb(): ReturnType<typeof createQueryBuilder> {
  const replicas = getReplicas()
  if (!replicas.length || contextInTransaction())
    return getDb()
  const replica = selectReplica(replicas, getReadPolicy().strategy)
  return replica ? getReplicaDb(replica) : getDb()
}

/** Statements that mutate, for the read-your-writes tracking in `./replicas`. */
const WRITE_ENTRY_POINTS = new Set([
  'insertInto',
  'updateTable',
  'deleteFrom',
  'create',
  'createMany',
  'insertOrIgnore',
  'insertGetId',
  'updateOrInsert',
  'upsert',
])

/** Reads that are candidates for replica routing. */
const READ_ENTRY_POINTS = new Set([
  'selectFrom',
  'selectFromSub',
  'select',
])

// Start config loading in the background
ensureConfigLoaded()

/**
 * What raw SQL answers: rows whose shape only the SQL knows.
 *
 * The query builder types `unsafe()` as `Promise<any>`, and at runtime it hands
 * back a Bun SQL statement that also has `.execute()`. Both halves are declared
 * here - and the rows are `Record<string, unknown>` rather than `any`, because
 * that is the truth about a hand-written `SELECT`: it has aliases this code
 * cannot see, and every column wants reading out.
 *
 * `any` was worse than useless here: it made `rows.map(row => …)` an implicit
 * any at every call site, which is the error `noImplicitAny` exists to raise.
 */
type UnsafeRow = Record<string, unknown>
type UnsafeReturn = Promise<UnsafeRow[]> & {
  execute: () => Promise<UnsafeRow[]>
  executeSync: () => UnsafeRow[]
}

/**
 * A raw result as the drivers actually hand it back.
 *
 * `UnsafeReturn` above says "the rows", and for most drivers that is true. Some
 * answer `{ rows: [...] }` and some answer nothing at all, which is why callers
 * across migrations, the query logger and the scheduler all write
 * `Array.isArray(r) ? r : (r?.rows ?? [])`. Behind a `(db)` that read
 * typechecked; without one the `.rows` branch narrows to `never`, because the
 * declared type admits only the array. This names the shape they handle.
 */
export type UnsafeRowsResult = UnsafeRow[] | { rows?: UnsafeRow[] } | undefined

/**
 * What a write statement run through `db.unsafe` resolves to.
 *
 * `UnsafeReturn` above describes a SELECT - the rows. An UPDATE, INSERT or
 * DELETE resolves to the driver's own result object instead, and every driver
 * spells the affected-row count differently, which is why callers read all of
 * these in turn. They were reaching for the fields off a value typed as
 * `UnsafeRow[]`, which has none of them, behind a `(db)`.
 */
export interface DbWriteResult {
  changes?: number
  numUpdatedRows?: number | bigint
  numAffectedRows?: number | bigint
  numDeletedRows?: number | bigint
  affectedRows?: number
  rowsAffected?: number
  /** Postgres. */
  rowCount?: number
  lastInsertRowid?: number | bigint
  insertId?: number | bigint
  /**
   * Some drivers answer with an array of result rows rather than one object,
   * which is why callers probe `result[0]?.numUpdatedRows` alongside
   * `result.numUpdatedRows`. Both spellings are real, so both are described.
   */
  [index: number]: DbWriteResult | undefined
}

/**
 * Fluent chain returned by entry-point methods like `selectFrom`/`updateTable`.
 *
 * bun-query-builder marks legacy chain methods (e.g. `selectAll`, `whereILike`,
 * `selectAllRelations`) as optional in its declarations even though they're
 * always present at runtime. Re-typing them here avoids forcing every call
 * site to use `?.()` or `!` on the chain.
 *
 * **The chain carries its row type.** `TRow` comes from the augmented
 * `DatabaseSchema` that `buddy generate:db-types` writes, so
 * `db.selectFrom('users').executeTakeFirst()` answers a `users` row rather than
 * `any` - and `select(['id', 'handle'])` narrows it to those two columns.
 *
 * Every terminal used to be `Promise<any>`, and the cost was not theoretical:
 * an application on top of this ends up annotating every result `any` to say
 * what it already knows, which is a thousand places the compiler has been told
 * to stop looking. A row it cannot type is `Record<string, unknown>` instead -
 * still a value the caller has to narrow, but one narrowing it is checked.
 *
 * A join or an aliased select list widens the row to
 * `Record<string, unknown>`: the shape then depends on the aliases rather than
 * on any one table, and claiming otherwise would be worse than not knowing.
 */
/**
 * State the shape of rows this package knows and the query cannot.
 *
 * A raw query answers `Record<string, unknown>` when the table is not in the
 * generated `DatabaseSchema` - which is always true *inside* the framework,
 * because an application's schema does not exist at framework build time. The
 * package that ships the model does know the shape, and this is where that
 * knowledge is written down: once, at the boundary, named and greppable.
 *
 * It is an assertion, and deliberately an obvious one. What it replaces is a
 * `Promise<any>` that spread the same claim silently through every caller.
 *
 * Application code should not need it: `buddy generate:db-types` gives `db` the
 * real column types, and a row that arrives typed does not want asserting.
 */
export function asRows<TRow>(rows: ReadonlyArray<Record<string, unknown>>): TRow[] {
  return rows as unknown as TRow[]
}

/** The single-row form of {@link asRows}. */
export function asRow<TRow>(row: Record<string, unknown> | undefined): TRow | undefined {
  return row as unknown as TRow | undefined
}

/**
 * The keys a row type actually declares, or `never` for a loose record.
 *
 * `keyof Record<string, unknown>` is `string`, so a narrowing overload written
 * against it will happily accept *anything* as a column - including
 * `'menu_items.id as id'`, which then becomes a property name in the result
 * type. That is worse than not narrowing: the row type looks specific and every
 * key in it is fiction.
 */
export type KnownKeys<T> = string extends keyof T ? never : keyof T

/**
 * Which verb started a chain, so its terminals can answer the right thing.
 *
 * `returning` is its own kind rather than a flag on the others: a mutation with
 * `RETURNING` answers rows, and that is the difference between reading
 * `rows[0].id` and reading a count.
 */
export type ChainKind = 'select' | 'insert' | 'update' | 'delete' | 'returning'

/** What `execute()` resolves to for each verb. */
export type ResultOf<TRow, TKind extends ChainKind> = TKind extends 'select' | 'returning'
  ? TRow[]
  : number

/**
 * What an insert reports when it was not asked to return rows.
 *
 * Every field optional and every one differently named, because drivers
 * disagree: Postgres answers a count, SQLite a `changes`, MySQL an `insertId`.
 * Typing this as the row - which is what the query builder's own declarations
 * do - is how framework code came to read `insertId` off a value that is not a
 * row and cannot have one.
 *
 * `returning(...)` is the way to get rows out of an insert, and it changes the
 * chain's kind so the types follow.
 */
export interface InsertReceipt {
  insertId?: number | bigint
  numInsertedOrUpdatedRows?: number | bigint
  numAffectedRows?: number | bigint
  affectedRows?: number
  changes?: number
}

/**
 * What `executeTakeFirst()` resolves to for each verb.
 *
 * The counts are *required*, because the runtime always sets them: an update
 * that changed nothing answers `{ numUpdatedRows: 0 }`. Declaring them optional
 * would make every caller write `?? 0` for a case that cannot happen.
 */
export type FirstOf<TRow, TKind extends ChainKind> = TKind extends 'select' | 'returning'
  ? TRow | undefined
  : TKind extends 'insert'
    ? InsertReceipt | undefined
    : TKind extends 'update'
      ? { numUpdatedRows: number }
      : { numDeletedRows: number }

export interface BaseFluentChain<TRow = Record<string, unknown>, TKind extends ChainKind = 'select'> {
  where(callback: (eb: import('./types').StacksExpressionBuilder) => unknown): FluentChain<TRow, TKind>
  where(...args: unknown[]): FluentChain<TRow, TKind>
  whereNull: (...args: unknown[]) => FluentChain<TRow, TKind>
  whereNotNull: (...args: unknown[]) => FluentChain<TRow, TKind>
  whereIn: (...args: unknown[]) => FluentChain<TRow, TKind>
  whereNotIn: (...args: unknown[]) => FluentChain<TRow, TKind>
  whereLike: (...args: unknown[]) => FluentChain<TRow, TKind>
  whereNotLike: (...args: unknown[]) => FluentChain<TRow, TKind>
  whereILike: (...args: unknown[]) => FluentChain<TRow, TKind>
  whereNotILike: (...args: unknown[]) => FluentChain<TRow, TKind>
  whereBetween: (...args: unknown[]) => FluentChain<TRow, TKind>
  whereNotBetween: (...args: unknown[]) => FluentChain<TRow, TKind>
  whereRaw: (...args: unknown[]) => FluentChain<TRow, TKind>
  whereColumn: (...args: unknown[]) => FluentChain<TRow, TKind>
  orWhere: (...args: unknown[]) => FluentChain<TRow, TKind>
  orWhereNull: (...args: unknown[]) => FluentChain<TRow, TKind>
  orWhereNotNull: (...args: unknown[]) => FluentChain<TRow, TKind>
  orWhereIn: (...args: unknown[]) => FluentChain<TRow, TKind>
  orWhereNotIn: (...args: unknown[]) => FluentChain<TRow, TKind>
  orWhereLike: (...args: unknown[]) => FluentChain<TRow, TKind>
  orWhereNotLike: (...args: unknown[]) => FluentChain<TRow, TKind>
  orWhereILike: (...args: unknown[]) => FluentChain<TRow, TKind>
  orWhereColumn: (...args: unknown[]) => FluentChain<TRow, TKind>
  andWhere: (...args: unknown[]) => FluentChain<TRow, TKind>
  // The multi-column predicates the query builder ships (`whereAny(columns,
  // op, value)` and friends). They were missing here, so a caller that used
  // one - the log search does, across message/project/file/stacktrace - had
  // no type for the chain it got back.
  whereAny: (...args: unknown[]) => FluentChain<TRow, TKind>
  whereAll: (...args: unknown[]) => FluentChain<TRow, TKind>
  whereNone: (...args: unknown[]) => FluentChain<TRow, TKind>
  having: (...args: unknown[]) => FluentChain<TRow, TKind>
  groupBy: (...args: unknown[]) => FluentChain<TRow, TKind>
  orderBy: (...args: unknown[]) => FluentChain<TRow, TKind>
  limit: (...args: unknown[]) => FluentChain<TRow, TKind>
  offset: (...args: unknown[]) => FluentChain<TRow, TKind>
  /**
   * Narrow the select list, and the row type with it.
   *
   * A list of plain column names narrows to exactly those columns. Anything
   * else - an alias, an expression builder callback, a raw fragment - answers a
   * `Record<string, unknown>` chain, because what comes back is then named by
   * the aliases rather than by the table.
   */
  select<K extends KnownKeys<TRow> & string>(columns: readonly K[]): FluentChain<Pick<TRow, K>, TKind>
  select(selection: ((eb: import('./types').StacksExpressionBuilder) => unknown) | ReadonlyArray<string | ((eb: import('./types').StacksExpressionBuilder) => unknown) | unknown>): FluentChain<Record<string, unknown>, TKind>
  select(...args: unknown[]): FluentChain<Record<string, unknown>, TKind>
  selectAll: () => FluentChain<TRow, TKind>
  selectAllRelations: () => FluentChain<Record<string, unknown>, TKind>
  selectRaw: (...args: unknown[]) => FluentChain<Record<string, unknown>, TKind>
  distinct: () => FluentChain<TRow, TKind>
  distinctOn: (...args: unknown[]) => FluentChain<TRow, TKind>
  /*
   * A joined chain's rows are not this table's rows.
   *
   * `Record<string, unknown>` rather than `TRow`, because the select list after
   * a join is written as aliases - `'users.id as user_id'` - and a row typed as
   * the base table would be confidently wrong about every one of them.
   */
  innerJoin: (...args: unknown[]) => FluentChain<Record<string, unknown>, TKind>
  leftJoin: (...args: unknown[]) => FluentChain<Record<string, unknown>, TKind>
  rightJoin: (...args: unknown[]) => FluentChain<Record<string, unknown>, TKind>
  fullJoin: (...args: unknown[]) => FluentChain<Record<string, unknown>, TKind>
  crossJoin: (...args: unknown[]) => FluentChain<Record<string, unknown>, TKind>
  with: (...args: unknown[]) => FluentChain<Record<string, unknown>, TKind>
  union: (...args: unknown[]) => FluentChain<Record<string, unknown>, TKind>
  unionAll: (...args: unknown[]) => FluentChain<Record<string, unknown>, TKind>
  /**
   * `values()` takes what the table holds, and keeps the row type for
   * `returning()`.
   *
   * `object` rather than `Record<string, unknown>` as the loose branch, because
   * an *interface* is not assignable to `Record<string, unknown>` - it has no
   * index signature - and every caller that has declared a row shape of its own
   * passes exactly that. Rejecting those would be a type error about a value
   * that is right.
   */
  values: (values: Partial<TRow> | ReadonlyArray<Partial<TRow>> | object | readonly object[]) => FluentChain<TRow, TKind>
  set: (values: Partial<TRow> | object) => FluentChain<TRow, TKind>
  /*
   * `RETURNING` turns a mutation into something that answers rows, which is
   * why it changes the chain's kind rather than only its row type: the whole
   * point of writing it is that `execute()` stops answering a count.
   */
  returning<K extends KnownKeys<TRow> & string>(columns: readonly K[]): FluentChain<Pick<TRow, K>, 'returning'>
  returning(...args: unknown[]): FluentChain<Record<string, unknown>, 'returning'>
  returningAll: () => FluentChain<TRow, 'returning'>
  onConflict: (...args: unknown[]) => FluentChain<TRow, TKind>
  onDuplicateKeyUpdate: (...args: unknown[]) => FluentChain<TRow, TKind>
  onConflictDoNothing: (...args: unknown[]) => FluentChain<TRow, TKind>
  onDuplicateKeyIgnore: () => FluentChain<TRow, TKind>
  forUpdate: () => FluentChain<TRow, TKind>
  forShare: () => FluentChain<TRow, TKind>
  toSQL: () => string
  /**
   * What running this chain answers, decided by which verb started it.
   *
   * A select resolves rows; an update or a delete resolves how many rows it
   * changed. Both were `Promise<any>` before, which is why callers in this
   * framework and in applications on top of it read `numUpdatedRows` off a
   * value that might be a number - the type never told them which they had.
   */
  execute: () => Promise<ResultOf<TRow, TKind>>
  executeTakeFirst: () => Promise<FirstOf<TRow, TKind>>
  executeTakeFirstOrThrow: () => Promise<NonNullable<FirstOf<TRow, TKind>>>
  pluck: (...args: unknown[]) => Promise<unknown[]>
  count: (...args: unknown[]) => Promise<number>
  sum: (...args: unknown[]) => Promise<number>
  avg: (...args: unknown[]) => Promise<number>
  min: (...args: unknown[]) => Promise<unknown>
  max: (...args: unknown[]) => Promise<unknown>
  exists: () => Promise<boolean>
  doesntExist: () => Promise<boolean>
  $call: (callback: (query: FluentChain<TRow, TKind>) => FluentChain<TRow, TKind>) => FluentChain<TRow, TKind>

  /*
   * The rest of the builder bun-query-builder ships.
   *
   * These were reachable only through the `[key: string]: any` index signature
   * that used to sit at the bottom of this interface: present at runtime,
   * absent from the type, and typed as `any` when anybody used one. Removing
   * that signature without declaring them would have been a capability
   * regression - which is exactly how it was found, on `orderByRaw`.
   *
   * Declared as chain-returning, because that is what they are. The arguments
   * stay `unknown[]`: each one's real signature lives in the query builder, and
   * restating a hundred of them here is a second declaration to keep in step.
   */
  abort: (...args: unknown[]) => FluentChain<TRow, TKind>
  addSelect: (...args: unknown[]) => FluentChain<TRow, TKind>
  applyPivotColumns: (...args: unknown[]) => FluentChain<TRow, TKind>
  cache: (...args: unknown[]) => FluentChain<TRow, TKind>
  clone: (...args: unknown[]) => FluentChain<TRow, TKind>
  crossJoinSub: (...args: unknown[]) => FluentChain<TRow, TKind>
  denseRank: (...args: unknown[]) => FluentChain<TRow, TKind>
  doesntHave: (...args: unknown[]) => FluentChain<TRow, TKind>
  dump: (...args: unknown[]) => FluentChain<TRow, TKind>
  forPage: (...args: unknown[]) => FluentChain<TRow, TKind>
  groupByRaw: (...args: unknown[]) => FluentChain<TRow, TKind>
  has: (...args: unknown[]) => FluentChain<TRow, TKind>
  havingRaw: (...args: unknown[]) => FluentChain<TRow, TKind>
  inRandomOrder: (...args: unknown[]) => FluentChain<TRow, TKind>
  join: (...args: unknown[]) => FluentChain<TRow, TKind>
  joinSub: (...args: unknown[]) => FluentChain<TRow, TKind>
  latest: (...args: unknown[]) => FluentChain<TRow, TKind>
  leftJoinSub: (...args: unknown[]) => FluentChain<TRow, TKind>
  lockForUpdate: (...args: unknown[]) => FluentChain<TRow, TKind>
  oldest: (...args: unknown[]) => FluentChain<TRow, TKind>
  onlyTrashed: (...args: unknown[]) => FluentChain<TRow, TKind>
  orWhereBetween: (...args: unknown[]) => FluentChain<TRow, TKind>
  orWhereExists: (...args: unknown[]) => FluentChain<TRow, TKind>
  orWhereGroup: (...args: unknown[]) => FluentChain<TRow, TKind>
  orWhereNested: (...args: unknown[]) => FluentChain<TRow, TKind>
  orWhereNotILike: (...args: unknown[]) => FluentChain<TRow, TKind>
  orWhereRaw: (...args: unknown[]) => FluentChain<TRow, TKind>
  orderByDesc: (...args: unknown[]) => FluentChain<TRow, TKind>
  orderByRaw: (...args: unknown[]) => FluentChain<TRow, TKind>
  pipe: (...args: unknown[]) => FluentChain<TRow, TKind>
  reorder: (...args: unknown[]) => FluentChain<TRow, TKind>
  rowNumber: (...args: unknown[]) => FluentChain<TRow, TKind>
  scope: (...args: unknown[]) => FluentChain<TRow, TKind>
  sharedLock: (...args: unknown[]) => FluentChain<TRow, TKind>
  tap: (...args: unknown[]) => FluentChain<TRow, TKind>
  when: (...args: unknown[]) => FluentChain<TRow, TKind>
  whereDate: (...args: unknown[]) => FluentChain<TRow, TKind>
  whereDoesntHave: (...args: unknown[]) => FluentChain<TRow, TKind>
  whereExists: (...args: unknown[]) => FluentChain<TRow, TKind>
  whereGroup: (...args: unknown[]) => FluentChain<TRow, TKind>
  whereHas: (...args: unknown[]) => FluentChain<TRow, TKind>
  whereJsonContains: (...args: unknown[]) => FluentChain<TRow, TKind>
  whereJsonContainsKey: (...args: unknown[]) => FluentChain<TRow, TKind>
  whereJsonDoesntContain: (...args: unknown[]) => FluentChain<TRow, TKind>
  whereJsonDoesntContainKey: (...args: unknown[]) => FluentChain<TRow, TKind>
  whereJsonLength: (...args: unknown[]) => FluentChain<TRow, TKind>
  whereJsonPath: (...args: unknown[]) => FluentChain<TRow, TKind>
  whereNested: (...args: unknown[]) => FluentChain<TRow, TKind>
  wherePivot: (...args: unknown[]) => FluentChain<TRow, TKind>
  wherePivotIn: (...args: unknown[]) => FluentChain<TRow, TKind>
  wherePivotNotIn: (...args: unknown[]) => FluentChain<TRow, TKind>
  wherePivotNotNull: (...args: unknown[]) => FluentChain<TRow, TKind>
  wherePivotNull: (...args: unknown[]) => FluentChain<TRow, TKind>
  withAvg: (...args: unknown[]) => FluentChain<TRow, TKind>
  withCTE: (...args: unknown[]) => FluentChain<TRow, TKind>
  withCount: (...args: unknown[]) => FluentChain<TRow, TKind>
  withMax: (...args: unknown[]) => FluentChain<TRow, TKind>
  withMin: (...args: unknown[]) => FluentChain<TRow, TKind>
  withPivot: (...args: unknown[]) => FluentChain<TRow, TKind>
  withRecursive: (...args: unknown[]) => FluentChain<TRow, TKind>
  withSum: (...args: unknown[]) => FluentChain<TRow, TKind>
  withTimeout: (...args: unknown[]) => FluentChain<TRow, TKind>
  withTrashed: (...args: unknown[]) => FluentChain<TRow, TKind>

  /* The terminals, which answer rows rather than a chain. */
  get: () => Promise<TRow[]>
  first: () => Promise<TRow | undefined>
  firstOrFail: () => Promise<TRow>
  find: (id: number | string) => Promise<TRow | undefined>
  findMany: (ids: Array<number | string>) => Promise<TRow[]>
  findOrFail: (id: number | string) => Promise<TRow>
  value: <K extends keyof TRow & string>(column: K) => Promise<TRow[K]>
  lazy: () => AsyncIterable<TRow>
  lazyById: () => AsyncIterable<TRow>
  chunk: (size: number, handler: (rows: TRow[]) => Promise<void> | void) => Promise<void>
  chunkById: (size: number, column?: keyof TRow & string, handler?: (rows: TRow[]) => Promise<void> | void) => Promise<void>
  eachById: (size: number, column?: keyof TRow & string, handler?: (row: TRow) => Promise<void> | void) => Promise<void>
  paginate: (perPage: number, page?: number, opts?: unknown) => Promise<{ data: TRow[], meta: Record<string, unknown> }>
  simplePaginate: (perPage: number, page?: number) => Promise<{ data: TRow[], meta: Record<string, unknown> }>
  cursorPaginate: (perPage: number, cursor?: string | number, column?: string, direction?: 'asc' | 'desc') => Promise<{ data: TRow[], meta: Record<string, unknown> }>
  explain: () => Promise<Record<string, unknown>[]>
  raw: () => Promise<unknown[][]>
  toParams: () => unknown[]
  toText: () => string
  simple: () => unknown
  cancel: () => void
  dd: () => never
}

/** `created_at` -> `CreatedAt`, for the dynamic helper names below. */
type SnakeToPascal<S extends string> = S extends `${infer Head}_${infer Tail}`
  ? `${Capitalize<Head>}${SnakeToPascal<Tail>}`
  : Capitalize<S>

/**
 * The dynamic `where<Column>` helpers bun-query-builder generates.
 *
 * Derived from the row type rather than allowed by an index signature. The
 * index signature that used to be here (`[key: string]: any`) made every
 * misspelling legal and every result `any`: `whereHndle('a')` compiled, and so
 * did reading a property that does not exist.
 */
export type DynamicWhereMethods<TRow, TKind extends ChainKind = 'select'> = {
  [K in keyof TRow & string as `where${SnakeToPascal<K>}`]: (value: TRow[K]) => FluentChain<TRow, TKind>
} & {
  [K in keyof TRow & string as `orWhere${SnakeToPascal<K>}`]: (value: TRow[K]) => FluentChain<TRow, TKind>
} & {
  [K in keyof TRow & string as `andWhere${SnakeToPascal<K>}`]: (value: TRow[K]) => FluentChain<TRow, TKind>
}

/**
 * A chain over one table's rows: the methods, plus the generated helpers.
 *
 * A type alias rather than an interface because the helper half is a mapped
 * type over `TRow`, and an interface can only extend members TypeScript knows
 * statically.
 */
export type FluentChain<TRow = Record<string, unknown>, TKind extends ChainKind = 'select'>
  = BaseFluentChain<TRow, TKind> & DynamicWhereMethods<TRow, TKind>

/**
 * Top-level surface of the lazy `db` proxy. Methods that return a chainable
 * builder are typed as `FluentChain` to flatten the optional-method noise
 * inherent in bun-query-builder's declarations. Methods that introduce their
 * own generics (`transaction<T>`, etc.) are kept as their original signatures
 * via the underlying QueryBuilder type so call-site inference still works.
 */
type RawQueryBuilder = ReturnType<typeof createQueryBuilder>
type GenericPassthroughKeys =
  | 'transaction'
  | 'savepoint'
  | 'beginDistributed'
  | 'transactional'
  | 'configure'
  | 'reserve'
  | 'commitDistributed'
  | 'rollbackDistributed'
  | 'setTransactionDefaults'
  | 'close'
  | 'listen'
  | 'unlisten'
  | 'notify'
  | 'copyTo'
  | 'copyFrom'
  | 'ping'
  | 'waitForReady'
  | 'count'
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'insertOrIgnore'
  | 'insertGetId'
  | 'updateOrInsert'
  | 'upsert'
  | 'create'
  | 'createMany'
  | 'sql'
  | 'raw'
  | 'simple'
  | 'file'

/**
 * Userland-augmentable table registry (stacksjs/stacks#1923).
 *
 * Empty by default — the framework can't know an app's tables at its
 * own build time. `buddy generate:types` walks `app/Models/*.ts` and
 * emits `database/types.d.ts` containing:
 *
 * ```ts
 * declare module '@stacksjs/database' {
 *   interface DatabaseSchema {
 *     court_houses: { columns: { id: number; name: string; ... } }
 *     judges:       { columns: { id: number; name: string; court_id: number; ... } }
 *   }
 * }
 * ```
 *
 * Once that file is loaded into the TS project, `db.selectFrom('co|')`
 * autocompletes to known table names. Apps without a generated file
 * still compile — the `(string & {})` branch on `TableName` keeps the
 * type as a literal-union+escape-hatch, so any string is accepted
 * but known keys are surfaced first by the language server.
 */
// eslint-disable-next-line ts/no-empty-object-type
export interface DatabaseSchema {}

/**
 * Accept either a registered table name (from augmented
 * `DatabaseSchema`) for autocomplete, or any other string for apps
 * that haven't generated types yet / tables not in a model file.
 *
 * The `(string & {})` branch prevents TS from collapsing the union
 * back to `string` and losing the autocomplete narrowing — a
 * well-documented LiteralUnion trick.
 */
// eslint-disable-next-line ts/no-empty-object-type
export type TableName = (keyof DatabaseSchema & string) | (keyof FrameworkSchema & string) | (string & {})

/**
 * The row type of a registered table, or an unknown-valued record.
 *
 * A table the generated `DatabaseSchema` knows answers its own columns. One it
 * does not - an app that has never run `buddy generate:db-types`, or a table
 * that lives outside a model - answers `Record<string, unknown>`: still a value
 * the caller narrows, but narrowing it is checked rather than waved through.
 */
export type RowOf<T extends TableName> = T extends keyof DatabaseSchema
  ? Shape<DatabaseSchema[T]>
  : T extends keyof FrameworkSchema
    ? Shape<FrameworkSchema[T]>
    : Record<string, unknown>

/**
 * A generated entry, whichever of the two shapes it was written in.
 *
 * The app generator has emitted a flat column record for a while; the
 * `{ columns }` form is what the query builder's own schema type uses. Both are
 * accepted so an app does not have to regenerate to keep compiling.
 */
type Shape<T> = T extends { columns: infer C } ? C : T

interface Db extends Pick<Required<RawQueryBuilder>, GenericPassthroughKeys> {
  fn: import('./types').ExpressionFunctions
  selectFrom: <T extends TableName>(table: T) => FluentChain<RowOf<T>, 'select'>
  insertInto: <T extends TableName>(table: T) => FluentChain<RowOf<T>, 'insert'>
  updateTable: <T extends TableName>(table: T) => FluentChain<RowOf<T>, 'update'>
  deleteFrom: <T extends TableName>(table: T) => FluentChain<RowOf<T>, 'delete'>
  table: <T extends TableName>(table: T) => FluentChain<RowOf<T>, 'select'>
  /*
   * A subquery's rows are named by its own select list, so there is no table to
   * take a shape from.
   */
  selectFromSub: (sub: unknown, alias: string) => FluentChain<Record<string, unknown>>
  select: <T extends TableName>(table: T, ...columns: string[]) => FluentChain<Record<string, unknown>>
  unsafe: (query: string, params?: unknown[]) => UnsafeReturn
  /**
   * Replica-routed handle. Reads issued through it go to a read replica
   * when one is configured, accepting replication lag in exchange for
   * taking load off the primary. Falls back to the primary when no
   * replicas are declared or inside a transaction.
   */
  read: Omit<Db, 'read'>
}

const SIMPLE_SQLITE_TABLE = /^[A-Z_][A-Z0-9_]*$/i
const SIMPLE_SQLITE_COLUMN = /^[A-Z_][A-Z0-9_]*(?:\.[A-Z_][A-Z0-9_]*)?$/i
const SIMPLE_SQLITE_SELECTION = /^[A-Z_][A-Z0-9_]*(?:\.[A-Z_][A-Z0-9_]*)?(?:\s+AS\s+[A-Z_][A-Z0-9_]*)?$/i
const SIMPLE_SQLITE_OPERATORS = new Set(['=', '!=', '<>', '<', '<=', '>', '>=', 'like', 'not like'])
const SQLITE_IDENTIFIER_CACHE_LIMIT = 512

function memoizeSqliteIdentifier(pattern: RegExp): (value: string) => boolean {
  const valid = new Set<string>()
  return (value) => {
    if (valid.has(value))
      return true
    if (!pattern.test(value))
      return false
    if (valid.size < SQLITE_IDENTIFIER_CACHE_LIMIT)
      valid.add(value)
    return true
  }
}

const isSimpleSqliteTable = memoizeSqliteIdentifier(SIMPLE_SQLITE_TABLE)
const isSimpleSqliteColumn = memoizeSqliteIdentifier(SIMPLE_SQLITE_COLUMN)
const isSimpleSqliteSelection = memoizeSqliteIdentifier(SIMPLE_SQLITE_SELECTION)

// Endpoint reads tend to repeat one structural query while only bound values
// change. Keep the cache deliberately single-entry so that locality avoids SQL
// string assembly without retaining arbitrary application query shapes.
let lastParameterizedSqliteSelect: {
  instance: RawQueryBuilder
  selectKeyword: string
  selected: string
  table: string
  predicateColumn: string
  predicateOperator: string | undefined
  limit: number | undefined
  sql: string
  statement?: { all: (...params: unknown[]) => UnsafeRow[] }
} | undefined

// Selection validation and rendering are also structural. Snapshot the last
// validated list so caller mutation cannot make cached SQL describe new input.
let lastSqliteSelection: { columns: string[], sql: string } | undefined

function hasActiveQueryBuilderHooks(): boolean {
  return Boolean(queryBuilderConfig.hooks && Object.values(queryBuilderConfig.hooks).some(value => value !== undefined))
}

function resolveDeferredSqliteTerminal(
  target: Record<string | symbol, unknown>,
  property: string | symbol,
  executeStatement: (firstOnly?: boolean, selection?: string) => UnsafeRow[],
  materialize: () => ReturnType<RawQueryBuilder['selectFrom']>,
  proxy: Record<string | symbol, unknown>,
): unknown {
  if (property === 'get') {
    target.get = target.execute
    return target.execute
  }
  if (property === 'selectAll') {
    const selectAll = () => proxy
    target.selectAll = selectAll
    return selectAll
  }
  if (property === 'first' || property === 'executeTakeFirst') {
    const first = async () => executeStatement(true)[0]
    target.first = first
    target.executeTakeFirst = first
    return first
  }
  if (property === 'firstOrFail' || property === 'executeTakeFirstOrThrow') {
    const firstOrFail = async () => {
      const row = executeStatement(true)[0]
      if (row === undefined)
        throw new Error('Record not found')
      return row
    }
    target.firstOrFail = firstOrFail
    target.executeTakeFirstOrThrow = firstOrFail
    return firstOrFail
  }
  if (property === 'exists' || property === 'doesntExist') {
    const findsRow = property === 'exists'
    const check = async () => (executeStatement(true)[0] !== undefined) === findsRow
    target[property] = check
    return check
  }
  if (property === 'value') {
    const value = async (column: string) => executeStatement(true)[0]?.[column]
    target.value = value
    return value
  }
  if (property === 'count' || property === 'sum' || property === 'avg' || property === 'min' || property === 'max') {
    const emptyValue = property === 'min' || property === 'max' ? null : 0
    const aggregate = (...args: unknown[]) => runDeferredSqliteAggregate(property, args, emptyValue, materialize, executeStatement)
    target[property] = aggregate
    return aggregate
  }
  if (property === 'pluck') {
    const pluck = (...args: unknown[]) => {
      if (args.length !== 1) {
        const builder = materialize()
        const apply = builder.pluck as unknown as (...values: unknown[]) => Promise<unknown[]>
        return apply.call(builder, ...args)
      }

      try {
        const column = args[0] as string
        const rows = executeStatement()
        const values = new Array<unknown>(rows.length)
        for (let index = 0; index < rows.length; index++)
          values[index] = rows[index]?.[column]
        return Promise.resolve(values)
      }
      catch (error) {
        return Promise.reject(error)
      }
    }
    target.pluck = pluck
    return pluck
  }
}

function runDeferredSqliteAggregate(
  name: 'count' | 'sum' | 'avg' | 'min' | 'max',
  args: unknown[],
  emptyValue: unknown,
  materialize: () => ReturnType<RawQueryBuilder['selectFrom']>,
  executeStatement: (firstOnly?: boolean, selection?: string) => UnsafeRow[],
): Promise<unknown> {
  const column = args[0]
  const acceptsNoColumn = name === 'count' && args.length === 0
  if (!acceptsNoColumn && (args.length !== 1 || typeof column !== 'string' || !isSimpleSqliteColumn(column))) {
    const builder = materialize() as unknown as Record<typeof name, (...values: unknown[]) => Promise<unknown>>
    return builder[name].call(builder, ...args)
  }

  try {
    const expression = `${name.toUpperCase()}(${acceptsNoColumn ? '*' : column}) AS aggregate`
    const value = executeStatement(false, expression)[0]?.aggregate ?? emptyValue
    return Promise.resolve(name === 'count' || name === 'sum' || name === 'avg' ? Number(value) : value)
  }
  catch (error) {
    return Promise.reject(error)
  }
}

interface FastSqliteDatabase {
  query: (sql: string) => { all: (...params: unknown[]) => UnsafeRow[] }
}

const fastSqliteDatabaseCache = new WeakMap<object, FastSqliteDatabase | null>()

/**
 * Resolve bun-query-builder's already-bootstrapped SQLite connection.
 *
 * `_wrapper` is an upstream implementation detail, so every access is
 * feature-detected and cached. A changed upstream shape falls back to
 * `instance.unsafe()` in `runSql`; it never opens a second connection. Keeping
 * the live handle matters for transactions because a separate read connection
 * would not see the transaction's uncommitted writes.
 */
function fastSqliteDatabase(instance: RawQueryBuilder): FastSqliteDatabase | undefined {
  if (fastSqliteDatabaseCache.has(instance))
    return fastSqliteDatabaseCache.get(instance) ?? undefined

  const sql = (instance as unknown as { sql?: { _wrapper?: { database?: unknown } } }).sql
  const database = sql?._wrapper?.database as Partial<FastSqliteDatabase> | undefined
  const resolved = database && typeof database.query === 'function'
    ? database as FastSqliteDatabase
    : null
  fastSqliteDatabaseCache.set(instance, resolved)
  return resolved ?? undefined
}

/**
 * Build the common SQLite SELECT shape without allocating bun-query-builder's
 * complete relationship, aggregate, window, pagination, and dynamic-where API.
 * Any method or argument outside this deliberately small surface materializes
 * the upstream builder and replays the calls, so capability and behavior stay
 * intact for complex queries.
 */
function createDeferredSqliteSelect(instance: RawQueryBuilder, table: string): unknown {
  const sqliteDatabase = fastSqliteDatabase(instance)
  let selectKeyword = 'SELECT'
  let columns: string | string[] | undefined
  let selectedColumnsSql: string | undefined
  let predicateColumn: string | undefined
  let predicateOperator: string | undefined
  let predicateValue: unknown
  let predicateParameterized = true
  let predicateValues: unknown[] | undefined
  let additionalPredicates: Array<{ column: string, operator: string, value: unknown, parameterized: boolean, values?: unknown[] }> | undefined
  let orderings: Array<{ column: string, direction: 'asc' | 'desc' }> | undefined
  let rowLimit: number | undefined
  let rowOffset: number | undefined
  let materialized: ReturnType<RawQueryBuilder['selectFrom']> | undefined

  const materialize = (): ReturnType<RawQueryBuilder['selectFrom']> => {
    if (materialized)
      return materialized
    let builder = instance.selectFrom(table)
    if (columns) {
      const apply = builder.select as unknown as (value: unknown) => typeof builder
      builder = apply.call(builder, columns)
    }
    if (selectKeyword === 'SELECT DISTINCT') {
      const apply = builder.distinct as unknown as () => typeof builder
      builder = apply.call(builder)
    }
    if (predicateColumn !== undefined) {
      if (predicateValues) {
        if (predicateOperator === 'LIKE LOWER' || predicateOperator === 'NOT LIKE LOWER') {
          const method = predicateOperator === 'LIKE LOWER' ? 'whereILike' : 'whereNotILike'
          const apply = builder[method] as unknown as (column: unknown, value: unknown) => typeof builder
          builder = apply.call(builder, predicateColumn.slice(6, -1), predicateValues[0])
        }
        else {
          const method = predicateOperator === 'IN' ? 'whereIn' : 'whereNotIn'
          const apply = builder[method] as unknown as (column: unknown, values: unknown[]) => typeof builder
          builder = apply.call(builder, predicateColumn, predicateValues)
        }
      }
      else if (predicateParameterized) {
        const apply = builder.where as unknown as (column: unknown, operator: unknown, value: unknown) => typeof builder
        builder = apply.call(builder, predicateColumn, predicateOperator, predicateValue)
      }
      else {
        const method = predicateOperator === 'IS NULL' ? 'whereNull' : 'whereNotNull'
        const apply = builder[method] as unknown as (column: unknown) => typeof builder
        builder = apply.call(builder, predicateColumn)
      }
      if (additionalPredicates) {
        for (const predicate of additionalPredicates) {
          if (predicate.values) {
            if (predicate.operator === 'LIKE LOWER' || predicate.operator === 'NOT LIKE LOWER') {
              const method = predicate.operator === 'LIKE LOWER' ? 'whereILike' : 'whereNotILike'
              const apply = builder[method] as unknown as (column: unknown, value: unknown) => typeof builder
              builder = apply.call(builder, predicate.column.slice(6, -1), predicate.values[0])
            }
            else {
              const method = predicate.operator === 'IN' ? 'whereIn' : 'whereNotIn'
              const apply = builder[method] as unknown as (column: unknown, values: unknown[]) => typeof builder
              builder = apply.call(builder, predicate.column, predicate.values)
            }
          }
          else if (predicate.parameterized) {
            const apply = builder.where as unknown as (column: unknown, operator: unknown, value: unknown) => typeof builder
            builder = apply.call(builder, predicate.column, predicate.operator, predicate.value)
          }
          else {
            const method = predicate.operator === 'IS NULL' ? 'whereNull' : 'whereNotNull'
            const apply = builder[method] as unknown as (column: unknown) => typeof builder
            builder = apply.call(builder, predicate.column)
          }
        }
      }
    }
    if (orderings) {
      const apply = builder.orderBy as unknown as (column: string, direction: 'asc' | 'desc') => typeof builder
      for (const ordering of orderings)
        builder = apply.call(builder, ordering.column, ordering.direction)
    }
    if (rowLimit !== undefined) {
      const apply = builder.limit as unknown as (value: unknown) => typeof builder
      builder = apply.call(builder, rowLimit)
    }
    if (rowOffset !== undefined) {
      const apply = builder.offset as unknown as (value: unknown) => typeof builder
      builder = apply.call(builder, rowOffset)
    }
    materialized = builder
    return builder
  }

  let proxy: Record<string | symbol, unknown>
  const runSql = (sql: string, params: unknown[] = []): UnsafeRow[] => sqliteDatabase
    ? sqliteDatabase.query(sql).all(...params)
    : (instance.unsafe(sql, params) as unknown as UnsafeReturn).executeSync()

  const executeStatement = (firstOnly = false, selection?: string): UnsafeRow[] => {
    const selected = selection ?? selectedColumnsSql ?? '*'
    const effectiveLimit = rowLimit ?? (firstOnly && rowOffset === undefined ? 1 : undefined)
    if (predicateColumn === undefined && orderings === undefined && rowOffset === undefined) {
      const limit = effectiveLimit === undefined ? '' : ` LIMIT ${effectiveLimit}`
      return runSql(`${selectKeyword} ${selected} FROM ${table}${limit}`)
    }
    if (
      predicateColumn !== undefined
      && predicateValues === undefined
      && predicateParameterized
      && additionalPredicates === undefined
      && orderings === undefined
      && rowOffset === undefined
    ) {
      const cached = lastParameterizedSqliteSelect
      if (
        cached
        && cached.instance === instance
        && cached.selectKeyword === selectKeyword
        && cached.selected === selected
        && cached.table === table
        && cached.predicateColumn === predicateColumn
        && cached.predicateOperator === predicateOperator
        && cached.limit === effectiveLimit
      ) {
        if (sqliteDatabase) {
          const statement = cached.statement ??= sqliteDatabase.query(cached.sql)
          return statement.all(predicateValue)
        }
        return runSql(cached.sql, [predicateValue])
      }
      const sql = `${selectKeyword} ${selected} FROM ${table} WHERE ${predicateColumn} ${predicateOperator} ?${effectiveLimit === undefined ? '' : ` LIMIT ${effectiveLimit}`}`
      lastParameterizedSqliteSelect = {
        instance,
        selectKeyword,
        selected,
        table,
        predicateColumn,
        predicateOperator,
        limit: effectiveLimit,
        sql,
        statement: sqliteDatabase?.query(sql),
      }
      return lastParameterizedSqliteSelect.statement
        ? lastParameterizedSqliteSelect.statement.all(predicateValue)
        : runSql(sql, [predicateValue])
    }
    let query = `${selectKeyword} ${selected} FROM ${table}`
    const params: unknown[] = []
    if (predicateColumn !== undefined) {
      query += ` WHERE ${predicateColumn} ${predicateOperator}`
      if (predicateValues) {
        query += ` (${predicateValues.map(() => '?').join(', ')})`
        params.push(...predicateValues)
      }
      else if (predicateParameterized) {
        query += ' ?'
        params.push(predicateValue)
      }
      if (additionalPredicates) {
        query += ` AND ${additionalPredicates.map((predicate) => {
          if (predicate.values) {
            params.push(...predicate.values)
            return `${predicate.column} ${predicate.operator} (${predicate.values.map(() => '?').join(', ')})`
          }
          if (predicate.parameterized) {
            params.push(predicate.value)
            return `${predicate.column} ${predicate.operator} ?`
          }
          return `${predicate.column} ${predicate.operator}`
        }).join(' AND ')}`
      }
    }
    if (orderings)
      query += ` ORDER BY ${orderings.map(ordering => `${ordering.column} ${ordering.direction.toUpperCase()}`).join(', ')}`
    // bun-query-builder leaves an offset-only SQLite query invalid, including
    // through first-row terminals that append LIMIT after OFFSET. Preserve
    // that behavior instead of silently repairing the caller's query.
    if (effectiveLimit !== undefined)
      query += ` LIMIT ${effectiveLimit}`
    if (rowOffset !== undefined)
      query += ` OFFSET ${rowOffset}`
    return runSql(query, params)
  }

  /*
   * The benchmark and the dominant application read shape only touch
   * select, where, limit, and execute. Keep that four-method surface eager;
   * allocating every supported convenience method here accounted for most of
   * the lightweight builder's remaining overhead. The broader fast surface is
   * created only when a query actually asks for one of those methods.
   */
  const createExtensions = (): Record<string, unknown> => ({
    distinct() {
      if (selectKeyword === 'SELECT DISTINCT')
        return materialize().distinct()
      selectKeyword = 'SELECT DISTINCT'
      return proxy
    },
    where(column: unknown, operator?: unknown, value?: unknown) {
      if (column !== null && typeof column === 'object' && !Array.isArray(column) && operator === undefined && value === undefined) {
        const prototype = Object.getPrototypeOf(column)
        const entries = prototype === Object.prototype || prototype === null
          ? Object.entries(column as Record<string, unknown>)
          : []
        if (entries.length > 0 && entries.every(([key]) => isSimpleSqliteColumn(key))) {
          for (const [key, entryValue] of entries) {
            if (predicateColumn === undefined) {
              predicateColumn = key
              predicateOperator = '='
              predicateValue = entryValue
              predicateParameterized = true
              predicateValues = undefined
            }
            else {
              ;(additionalPredicates ??= []).push({ column: key, operator: '=', value: entryValue, parameterized: true })
            }
          }
          return proxy
        }
      }
      const builder = materialize()
      const apply = builder.where as unknown as (column: unknown, operator: unknown, value: unknown) => typeof builder
      return apply.call(builder, column, operator, value)
    },
    whereNull(column: unknown) {
      if (typeof column !== 'string' || !isSimpleSqliteColumn(column)) {
        const builder = materialize()
        const apply = builder.whereNull as unknown as (column: unknown) => typeof builder
        return apply.call(builder, column)
      }
      if (predicateColumn === undefined) {
        predicateColumn = column
        predicateOperator = 'IS NULL'
        predicateValue = undefined
        predicateParameterized = false
        predicateValues = undefined
      }
      else {
        ;(additionalPredicates ??= []).push({ column, operator: 'IS NULL', value: undefined, parameterized: false })
      }
      return proxy
    },
    whereNotNull(column: unknown) {
      if (typeof column !== 'string' || !isSimpleSqliteColumn(column)) {
        const builder = materialize()
        const apply = builder.whereNotNull as unknown as (column: unknown) => typeof builder
        return apply.call(builder, column)
      }
      if (predicateColumn === undefined) {
        predicateColumn = column
        predicateOperator = 'IS NOT NULL'
        predicateValue = undefined
        predicateParameterized = false
        predicateValues = undefined
      }
      else {
        ;(additionalPredicates ??= []).push({ column, operator: 'IS NOT NULL', value: undefined, parameterized: false })
      }
      return proxy
    },
    whereLike(column: unknown, value: unknown, caseSensitive: unknown = false) {
      if (typeof column !== 'string' || !isSimpleSqliteColumn(column)) {
        const builder = materialize()
        const apply = builder.whereLike as unknown as (column: unknown, value: unknown, caseSensitive?: unknown) => typeof builder
        return apply.call(builder, column, value, caseSensitive)
      }
      if (!caseSensitive)
        return (proxy.whereILike as (column: string, value: unknown) => unknown)(column, value)
      if (predicateColumn === undefined) {
        predicateColumn = column
        predicateOperator = 'LIKE'
        predicateValue = value
        predicateParameterized = true
        predicateValues = undefined
      }
      else {
        ;(additionalPredicates ??= []).push({ column, operator: 'LIKE', value, parameterized: true })
      }
      return proxy
    },
    whereNotLike(column: unknown, value: unknown, caseSensitive: unknown = false) {
      if (typeof column !== 'string' || !isSimpleSqliteColumn(column)) {
        const builder = materialize()
        const apply = builder.whereNotLike as unknown as (column: unknown, value: unknown, caseSensitive?: unknown) => typeof builder
        return apply.call(builder, column, value, caseSensitive)
      }
      if (!caseSensitive)
        return (proxy.whereNotILike as (column: string, value: unknown) => unknown)(column, value)
      if (predicateColumn === undefined) {
        predicateColumn = column
        predicateOperator = 'NOT LIKE'
        predicateValue = value
        predicateParameterized = true
        predicateValues = undefined
      }
      else {
        ;(additionalPredicates ??= []).push({ column, operator: 'NOT LIKE', value, parameterized: true })
      }
      return proxy
    },
    whereILike(column: unknown, value: unknown) {
      if (typeof column !== 'string' || !isSimpleSqliteColumn(column)) {
        const builder = materialize()
        const apply = builder.whereILike as unknown as (column: unknown, value: unknown) => typeof builder
        return apply.call(builder, column, value)
      }
      const sqlColumn = `LOWER(${column})`
      if (predicateColumn === undefined) {
        predicateColumn = sqlColumn
        predicateOperator = 'LIKE LOWER'
        predicateValue = undefined
        predicateParameterized = false
        predicateValues = [value]
      }
      else {
        ;(additionalPredicates ??= []).push({ column: sqlColumn, operator: 'LIKE LOWER', value: undefined, parameterized: false, values: [value] })
      }
      return proxy
    },
    whereNotILike(column: unknown, value: unknown) {
      if (typeof column !== 'string' || !isSimpleSqliteColumn(column)) {
        const builder = materialize()
        const apply = builder.whereNotILike as unknown as (column: unknown, value: unknown) => typeof builder
        return apply.call(builder, column, value)
      }
      const sqlColumn = `LOWER(${column})`
      if (predicateColumn === undefined) {
        predicateColumn = sqlColumn
        predicateOperator = 'NOT LIKE LOWER'
        predicateValue = undefined
        predicateParameterized = false
        predicateValues = [value]
      }
      else {
        ;(additionalPredicates ??= []).push({ column: sqlColumn, operator: 'NOT LIKE LOWER', value: undefined, parameterized: false, values: [value] })
      }
      return proxy
    },
    whereIn(column: unknown, values: unknown) {
      if (typeof column !== 'string' || !isSimpleSqliteColumn(column) || !Array.isArray(values)) {
        const builder = materialize()
        const apply = builder.whereIn as unknown as (column: unknown, values: unknown) => typeof builder
        return apply.call(builder, column, values)
      }
      const snapshot = values.slice()
      if (predicateColumn === undefined) {
        predicateColumn = column
        predicateOperator = 'IN'
        predicateValue = undefined
        predicateParameterized = false
        predicateValues = snapshot
      }
      else {
        ;(additionalPredicates ??= []).push({ column, operator: 'IN', value: undefined, parameterized: false, values: snapshot })
      }
      return proxy
    },
    whereNotIn(column: unknown, values: unknown) {
      if (typeof column !== 'string' || !isSimpleSqliteColumn(column) || !Array.isArray(values)) {
        const builder = materialize()
        const apply = builder.whereNotIn as unknown as (column: unknown, values: unknown) => typeof builder
        return apply.call(builder, column, values)
      }
      const snapshot = values.slice()
      if (predicateColumn === undefined) {
        predicateColumn = column
        predicateOperator = 'NOT IN'
        predicateValue = undefined
        predicateParameterized = false
        predicateValues = snapshot
      }
      else {
        ;(additionalPredicates ??= []).push({ column, operator: 'NOT IN', value: undefined, parameterized: false, values: snapshot })
      }
      return proxy
    },
    whereBetween(...args: unknown[]) {
      const [column, startOrValues, end] = args
      const values = Array.isArray(startOrValues)
        ? startOrValues
        : args.length >= 3
          ? [startOrValues, end]
          : undefined
      if (typeof column !== 'string' || !isSimpleSqliteColumn(column) || !values || values.length < 2) {
        const builder = materialize()
        const apply = builder.whereBetween as unknown as (...values: unknown[]) => typeof builder
        return apply.call(builder, ...args)
      }
      const lower = values[0]
      const upper = values[1]
      if (predicateColumn === undefined) {
        predicateColumn = column
        predicateOperator = '>='
        predicateValue = lower
        predicateParameterized = true
        predicateValues = undefined
      }
      else {
        ;(additionalPredicates ??= []).push({ column, operator: '>=', value: lower, parameterized: true })
      }
      ;(additionalPredicates ??= []).push({ column, operator: '<=', value: upper, parameterized: true })
      return proxy
    },
    whereDate(...args: unknown[]) {
      const [column, operator, date] = args
      if (typeof column !== 'string' || !isSimpleSqliteColumn(column) || typeof operator !== 'string' || !SIMPLE_SQLITE_OPERATORS.has(operator.toLowerCase()) || (typeof date !== 'string' && !(date instanceof Date))) {
        const builder = materialize()
        const apply = builder.whereDate as unknown as (...values: unknown[]) => typeof builder
        return apply.call(builder, ...args)
      }
      const normalizedDate = date instanceof Date ? date.toISOString() : date
      if (predicateColumn === undefined) {
        predicateColumn = column
        predicateOperator = operator
        predicateValue = normalizedDate
        predicateParameterized = true
        predicateValues = undefined
      }
      else {
        ;(additionalPredicates ??= []).push({ column, operator, value: normalizedDate, parameterized: true })
      }
      return proxy
    },
    orderBy(column: unknown, direction: unknown = 'asc') {
      if (typeof column !== 'string' || !isSimpleSqliteColumn(column)) {
        const builder = materialize()
        const apply = builder.orderBy as unknown as (column: unknown, direction?: unknown) => typeof builder
        return apply.call(builder, column, direction)
      }
      ;(orderings ??= []).push({ column, direction: direction === 'asc' ? 'asc' : 'desc' })
      return proxy
    },
    orderByDesc(column: unknown) {
      if (typeof column !== 'string' || !isSimpleSqliteColumn(column)) {
        const builder = materialize()
        const apply = builder.orderByDesc as unknown as (column: unknown) => typeof builder
        return apply.call(builder, column)
      }
      ;(orderings ??= []).push({ column, direction: 'desc' })
      return proxy
    },
    latest(column?: unknown) {
      const resolvedColumn = column ?? queryBuilderConfig.timestamps.defaultOrderColumn
      if (typeof resolvedColumn !== 'string' || !isSimpleSqliteColumn(resolvedColumn)) {
        const builder = materialize()
        const apply = builder.latest as unknown as (value?: unknown) => typeof builder
        return apply.call(builder, column)
      }
      ;(orderings ??= []).push({ column: resolvedColumn, direction: 'desc' })
      return proxy
    },
    oldest(column?: unknown) {
      const resolvedColumn = column ?? queryBuilderConfig.timestamps.defaultOrderColumn
      if (typeof resolvedColumn !== 'string' || !isSimpleSqliteColumn(resolvedColumn)) {
        const builder = materialize()
        const apply = builder.oldest as unknown as (value?: unknown) => typeof builder
        return apply.call(builder, column)
      }
      ;(orderings ??= []).push({ column: resolvedColumn, direction: 'asc' })
      return proxy
    },
    offset(value: unknown) {
      if (typeof value !== 'number' || value < 0 || !Number.isInteger(value)) {
        const builder = materialize()
        const apply = builder.offset as unknown as (value: unknown) => typeof builder
        return apply.call(builder, value)
      }
      rowOffset = value
      return proxy
    },
  })

  let extensions: Record<string, unknown> | undefined
  const base = {
    select(value: unknown) {
      if (typeof value === 'string') {
        if (value !== '*' && !isSimpleSqliteSelection(value)) {
          const builder = materialize()
          const apply = builder.select as unknown as (selection: unknown) => typeof builder
          return apply.call(builder, value)
        }
        columns = value
        selectedColumnsSql = value
        return proxy
      }

      const selected = Array.isArray(value) ? value : [value]
      let simple = false
      let selection: string | undefined
      const cached = lastSqliteSelection
      if (cached && cached.columns.length === selected.length) {
        simple = true
        for (let index = 0; simple && index < selected.length; index++)
          simple = cached.columns[index] === selected[index]
        if (simple)
          selection = cached.sql
      }
      if (!simple) {
        simple = selected.length > 0
        selection = ''
        for (let index = 0; simple && index < selected.length; index++) {
          const column = selected[index]
          simple = typeof column === 'string' && (column === '*' || isSimpleSqliteSelection(column))
          if (simple)
            selection += index === 0 ? column : `, ${column}`
        }
        if (simple)
          lastSqliteSelection = { columns: (selected as string[]).slice(), sql: selection }
      }
      if (!simple) {
        const builder = materialize()
        const apply = builder.select as unknown as (value: unknown) => typeof builder
        return apply.call(builder, value)
      }
      columns = selected as string[]
      selectedColumnsSql = selection
      return proxy
    },
    where(column: unknown, operator?: unknown, value?: unknown) {
      if (typeof column !== 'string' || !isSimpleSqliteColumn(column) || typeof operator !== 'string' || (operator !== '=' && !SIMPLE_SQLITE_OPERATORS.has(operator) && !SIMPLE_SQLITE_OPERATORS.has(operator.toLowerCase()))) {
        const extended = extensions ??= createExtensions()
        return (extended.where as (column: unknown, operator?: unknown, value?: unknown) => unknown)(column, operator, value)
      }
      if (predicateColumn === undefined) {
        predicateColumn = column
        predicateOperator = operator
        predicateValue = value
        predicateParameterized = true
        predicateValues = undefined
      }
      else {
        ;(additionalPredicates ??= []).push({ column, operator, value, parameterized: true })
      }
      return proxy
    },
    limit(value: unknown) {
      if (typeof value !== 'number' || value < 0 || !Number.isInteger(value)) {
        const builder = materialize()
        const apply = builder.limit as unknown as (value: unknown) => typeof builder
        return apply.call(builder, value)
      }
      rowLimit = value
      return proxy
    },
    async execute() {
      return executeStatement()
    },
  }

  proxy = new Proxy(base as Record<string | symbol, unknown>, {
    get(target, property) {
      const value = target[property]
      if (value !== undefined)
        return value
      const terminal = resolveDeferredSqliteTerminal(target, property, executeStatement, materialize, proxy)
      if (terminal !== undefined)
        return terminal
      const extension = (extensions ??= createExtensions())[property as string]
      if (extension !== undefined)
        return extension
      const builder = materialize() as unknown as Record<string | symbol, unknown>
      const fallback = builder[property]
      return typeof fallback === 'function' ? fallback.bind(builder) : fallback
    },
  })
  return proxy
}

function selectFromDatabase(table: string): unknown {
  const dialect = getDialect()
  const instance = dialect === 'sqlite' ? getDb() : getReadDb()
  if (dialect === 'sqlite' && !queryBuilderConfig.softDeletes?.enabled && !hasActiveQueryBuilderHooks() && isSimpleSqliteTable(table))
    return createDeferredSqliteSelect(instance, table)
  return instance.selectFrom(table)
}

function selectFromExplicitReadDatabase(table: string): unknown {
  const dialect = getDialect()
  const instance = getExplicitReadDb()
  if (dialect === 'sqlite' && !queryBuilderConfig.softDeletes?.enabled && !hasActiveQueryBuilderHooks() && isSimpleSqliteTable(table))
    return createDeferredSqliteSelect(instance, table)
  return instance.selectFrom(table)
}

function unsafeDatabase(query: string, params?: unknown[]): UnsafeReturn {
  return getDb().unsafe(query, params) as unknown as UnsafeReturn
}

function unsafeExplicitReadDatabase(query: string, params?: unknown[]): UnsafeReturn {
  return getExplicitReadDb().unsafe(query, params) as unknown as UnsafeReturn
}

function insertIntoDatabase(table: string): unknown {
  markContextWrote()
  return getDb().insertInto(table)
}

function updateTableDatabase(table: string): unknown {
  markContextWrote()
  return getDb().updateTable(table)
}

function deleteFromDatabase(table: string): unknown {
  markContextWrote()
  return getDb().deleteFrom(table)
}

function tableDatabase(table: string): unknown {
  return getDb().table(table)
}

function selectDatabase(table: string, ...columns: string[]): unknown {
  return getReadDb().select(table, ...columns)
}

function selectFromSubDatabase(subquery: unknown, alias: string): unknown {
  return getReadDb().selectFromSub(subquery as { toSQL: () => string }, alias)
}

function tableExplicitReadDatabase(table: string): unknown {
  return getExplicitReadDb().table(table)
}

function selectExplicitReadDatabase(table: string, ...columns: string[]): unknown {
  return getExplicitReadDb().select(table, ...columns)
}

function selectFromSubExplicitReadDatabase(subquery: unknown, alias: string): unknown {
  return getExplicitReadDb().selectFromSub(subquery as { toSQL: () => string }, alias)
}

/**
 * Lazy fallback for the query-builder surface. The common facade properties
 * live on `db` itself below, so `db.selectFrom()` does not enter a Proxy on
 * every read; uncommon methods still resolve lazily through this prototype.
 */
const dbFallback = new Proxy({} as Db, {
  get(_target, prop) {
    // A write pins this async context's later reads to the primary, so a
    // request that reads back what it just wrote cannot be served a stale
    // row. Marked before dispatch: the flag must be visible to a read
    // issued while this statement is still in flight.
    if (typeof prop === 'string' && WRITE_ENTRY_POINTS.has(prop))
      markContextWrote()

    // Reads consult the router; everything else (transactions, DDL, raw
    // `unsafe`) stays on the primary unconditionally. `unsafe` is a
    // deliberate omission — its SQL is opaque here, so it could be a write,
    // and routing it on a guess would be the worst kind of wrong.
    const instance = typeof prop === 'string' && READ_ENTRY_POINTS.has(prop)
      ? getReadDb()
      : getDb()

    const value = (instance as unknown as Record<string | symbol, unknown>)[prop]
    if (typeof value === 'function') {
      return value.bind(instance)
    }
    return value
  },
})

/**
 * Lazy query-builder facade. Own properties bypass the Proxy prototype while
 * preserving the same connection-on-first-use behavior.
 */
export const db: Db = Object.create(dbFallback) as Db
Object.defineProperties(db, {
  deleteFrom: { value: deleteFromDatabase },
  fn: { value: aggregateFunctions },
  insertInto: { value: insertIntoDatabase },
  read: { get: () => readDb },
  select: { value: selectDatabase },
  selectFrom: { value: selectFromDatabase },
  selectFromSub: { value: selectFromSubDatabase },
  table: { value: tableDatabase },
  unsafe: { value: unsafeDatabase },
  updateTable: { value: updateTableDatabase },
})

/**
 * Replica-routed handle exposed as `db.read`.
 *
 * Its common properties use the same facade shape as `db`; the Proxy
 * prototype retains the complete builder surface without putting common
 * SQLite reads through the generic builder.
 */
const readDbFallback = new Proxy({} as Db, {
  get(_target, prop) {
    const instance = getExplicitReadDb()
    const value = (instance as unknown as Record<string | symbol, unknown>)[prop]
    if (typeof value === 'function') {
      return value.bind(instance)
    }
    return value
  },
})

export const readDb: Omit<Db, 'read'> = Object.create(readDbFallback) as Omit<Db, 'read'>
Object.defineProperties(readDb, {
  fn: { value: aggregateFunctions },
  select: { value: selectExplicitReadDatabase },
  selectFrom: { value: selectFromExplicitReadDatabase },
  selectFromSub: { value: selectFromSubExplicitReadDatabase },
  table: { value: tableExplicitReadDatabase },
  unsafe: { value: unsafeExplicitReadDatabase },
})

// Export setConfig if available
export { setConfig }
