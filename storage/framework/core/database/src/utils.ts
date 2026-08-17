/**
 * Database utilities using bun-query-builder
 *
 * This module provides the database connection and query builder
 * configured using the stacks database config.
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import type { QueryHooks } from '@stacksjs/query-builder'
import { createQueryBuilder, registerPersistentQueryHooks, resetConnection as resetQueryBuilderConnection, setConfig } from '@stacksjs/query-builder'

// Use default values to avoid circular dependencies initially
// These can be overridden later once config is fully loaded
// Read from environment variables first
import { SQL } from 'bun'
import { env as envVars } from '@stacksjs/env'
import type { QueryBuilderDialect } from './dialect'
import type { PoolConfig, ReadPolicyConfig, ReplicaConfig } from './driver-config'
import { getConnectionDefaults } from './defaults'
import { isMysqlWire, isVitessSharded, toQueryBuilderDialect } from './dialect'
import { relativeMigrationDirectory, resolveMigrationDirectory } from './migration-path'
import { contextInTransaction, markContextWrote, resolveReplicaConnection, selectReplica, shouldRouteToReplica, withTransactionContext } from './replicas'
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

export function acquireDbConfigLock(): Promise<() => void> {
  let release: () => void = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  const acquired = dbConfigLockTail.then(() => release)
  dbConfigLockTail = dbConfigLockTail.then(() => held)
  return acquired
}

// Function to initialize the config when it's available
export function initializeDbConfig(config: any): void {
  if (config?.app?.env)
    appEnv = config.app.env

  if (config?.database?.default)
    dbDriver = config.database.default

  if (config?.database)
    dbConfig = config.database

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
  return toQueryBuilderDialect(getDriver())
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

function forwardDatabaseQuery(event: DatabaseQueryLogEvent): void {
  void import('./query-logger')
    .then(({ logQuery }) => logQuery(event))
    .catch(() => {})
}

registerPersistentQueryHooks(createDatabaseQueryHooks(forwardDatabaseQuery))

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
function getReplicas(): ReplicaConfig[] {
  const driver = getDriver()
  if (driver === 'sqlite')
    return []
  const connections = getDatabaseConfig().connections as Record<string, DbConnectionConfig | undefined>
  return connections?.[driver]?.replicas ?? []
}

/** The app's read-routing policy. */
function getReadPolicy(): ReadPolicyConfig {
  return getDatabaseConfig().reads ?? {}
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
    database: (pool ? { ...dbConfigForQb, pool } : dbConfigForQb) as any,
    verbose: getEnv() !== 'production',
    // Must match the value migrations.ts sets. setConfig replaces the config
    // wholesale, so omitting this here silently reverts the snapshot to the
    // library default and writes a second copy to `.qb` in the project root -
    // the exact directory moving it was meant to remove.
    snapshotDir: QB_SNAPSHOT_DIR,
    migrationDir: relativeMigrationDirectory(resolveMigrationDirectory(toQueryBuilderDialect(dialect), { snapshotDir: QB_SNAPSHOT_DIR })),
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
  ;(instance as any).transaction = (...args: any[]) =>
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
  ;(instance as any).transaction = (...args: any[]) =>
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

// The bun-query-builder types `unsafe()` as returning `Promise<any>`, but at
// runtime it returns a Bun SQL Statement that has `.execute()`. This interface
// corrects the return type so callers can chain `.execute()` without type errors.
type UnsafeReturn = Promise<any> & { execute: () => Promise<any> }

/**
 * Fluent chain returned by entry-point methods like `selectFrom`/`updateTable`.
 *
 * bun-query-builder marks legacy chain methods (e.g. `selectAll`, `whereILike`,
 * `selectAllRelations`) as optional in its declarations even though they're
 * always present at runtime. Re-typing them here avoids forcing every call
 * site to use `?.()` or `!` on the chain.
 *
 * Returns are typed as `any` deliberately — typing each variant precisely
 * would re-introduce the optional methods, and we already lose strict column
 * typing one step into a chain (the underlying query builder is constructed
 * with no schema). Tests cover the runtime semantics.
 */
export interface FluentChain {
  where(callback: (eb: import('./types').StacksExpressionBuilder) => unknown): FluentChain
  where(...args: any[]): FluentChain
  whereNull: (...args: any[]) => FluentChain
  whereNotNull: (...args: any[]) => FluentChain
  whereIn: (...args: any[]) => FluentChain
  whereNotIn: (...args: any[]) => FluentChain
  whereLike: (...args: any[]) => FluentChain
  whereNotLike: (...args: any[]) => FluentChain
  whereILike: (...args: any[]) => FluentChain
  whereNotILike: (...args: any[]) => FluentChain
  whereBetween: (...args: any[]) => FluentChain
  whereNotBetween: (...args: any[]) => FluentChain
  whereRaw: (...args: any[]) => FluentChain
  whereColumn: (...args: any[]) => FluentChain
  orWhere: (...args: any[]) => FluentChain
  orWhereNull: (...args: any[]) => FluentChain
  orWhereNotNull: (...args: any[]) => FluentChain
  orWhereIn: (...args: any[]) => FluentChain
  orWhereNotIn: (...args: any[]) => FluentChain
  orWhereLike: (...args: any[]) => FluentChain
  orWhereNotLike: (...args: any[]) => FluentChain
  orWhereILike: (...args: any[]) => FluentChain
  orWhereColumn: (...args: any[]) => FluentChain
  andWhere: (...args: any[]) => FluentChain
  having: (...args: any[]) => FluentChain
  groupBy: (...args: any[]) => FluentChain
  orderBy: (...args: any[]) => FluentChain
  limit: (...args: any[]) => FluentChain
  offset: (...args: any[]) => FluentChain
  select(selection: ((eb: import('./types').StacksExpressionBuilder) => unknown) | ReadonlyArray<string | ((eb: import('./types').StacksExpressionBuilder) => unknown) | unknown>): FluentChain
  select(...args: any[]): FluentChain
  selectAll: () => FluentChain
  selectAllRelations: () => FluentChain
  selectRaw: (...args: any[]) => FluentChain
  distinct: () => FluentChain
  distinctOn: (...args: any[]) => FluentChain
  innerJoin: (...args: any[]) => FluentChain
  leftJoin: (...args: any[]) => FluentChain
  rightJoin: (...args: any[]) => FluentChain
  fullJoin: (...args: any[]) => FluentChain
  crossJoin: (...args: any[]) => FluentChain
  with: (...args: any[]) => FluentChain
  union: (...args: any[]) => FluentChain
  unionAll: (...args: any[]) => FluentChain
  values: (...args: any[]) => FluentChain
  set: (...args: any[]) => FluentChain
  returning: (...args: any[]) => FluentChain
  returningAll: () => FluentChain
  onConflict: (...args: any[]) => FluentChain
  onDuplicateKeyUpdate: (...args: any[]) => FluentChain
  onConflictDoNothing: (...args: any[]) => FluentChain
  onDuplicateKeyIgnore: () => FluentChain
  forUpdate: () => FluentChain
  forShare: () => FluentChain
  toSQL: () => string
  execute: () => Promise<any>
  executeTakeFirst: () => Promise<any>
  executeTakeFirstOrThrow: () => Promise<any>
  pluck: (...args: any[]) => Promise<any>
  count: (...args: any[]) => Promise<number>
  sum: (...args: any[]) => Promise<number>
  avg: (...args: any[]) => Promise<number>
  min: (...args: any[]) => Promise<any>
  max: (...args: any[]) => Promise<any>
  exists: () => Promise<boolean>
  doesntExist: () => Promise<boolean>
  $call: (callback: (query: FluentChain) => FluentChain) => FluentChain
  // Allow indexing for dynamic where${Column} helpers that bun-query-builder
  // generates at the type level via mapped templates.
  [key: string]: any
}

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
export type TableName = (keyof DatabaseSchema & string) | (string & {})

interface Db extends Pick<Required<RawQueryBuilder>, GenericPassthroughKeys> {
  fn: import('./types').ExpressionFunctions
  selectFrom: (table: TableName) => FluentChain
  insertInto: (table: TableName) => FluentChain
  updateTable: (table: TableName) => FluentChain
  deleteFrom: (table: TableName) => FluentChain
  table: (table: TableName) => FluentChain
  selectFromSub: (sub: any, alias: string) => FluentChain
  select: (table: TableName, ...columns: string[]) => FluentChain
  unsafe: (query: string, params?: any[]) => UnsafeReturn
  /**
   * Replica-routed handle. Reads issued through it go to a read replica
   * when one is configured, accepting replication lag in exchange for
   * taking load off the primary. Falls back to the primary when no
   * replicas are declared or inside a transaction.
   */
  read: Omit<Db, 'read'>
}

/**
 * Lazy proxy for the query builder - connection is only made when first used.
 * This is the main entry point for database operations.
 */
export const db = new Proxy({} as Db, {
  get(_target, prop) {
    // `fn` is our own aggregate surface (`aggregateFunctions`) -
    // bun-query-builder has no top-level `fn`, so serve it directly
    // instead of forwarding `undefined` from the wrapped instance.
    if (prop === 'fn')
      return aggregateFunctions

    // `db.read.*` — explicitly replica-routed, for callers that know the
    // query tolerates replication lag.
    if (prop === 'read')
      return readDb

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

    const value = (instance as any)[prop]
    if (typeof value === 'function') {
      return value.bind(instance)
    }
    return value
  },
})

/**
 * Replica-routed handle exposed as `db.read`.
 *
 * A separate proxy rather than a method so the whole builder surface stays
 * available behind it (`db.read.selectFrom(...).where(...)`) without
 * re-declaring every chain entry point.
 */
export const readDb = new Proxy({} as Db, {
  get(_target, prop) {
    if (prop === 'fn')
      return aggregateFunctions
    const instance = getExplicitReadDb()
    const value = (instance as any)[prop]
    if (typeof value === 'function') {
      return value.bind(instance)
    }
    return value
  },
})

// Export setConfig if available
export { setConfig }
