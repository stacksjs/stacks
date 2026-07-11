/**
 * Database utilities using bun-query-builder
 *
 * This module provides the database connection and query builder
 * configured using the stacks database config.
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import { createQueryBuilder, setConfig } from '@stacksjs/query-builder'

// Use default values to avoid circular dependencies initially
// These can be overridden later once config is fully loaded
// Read from environment variables first
import { env as envVars } from '@stacksjs/env'
import { getConnectionDefaults } from './defaults'

interface DbConnectionConfig {
  database?: string
  name?: string
  host?: string
  username?: string
  password?: string
  port?: number
  prefix?: string
}

interface DbConfig {
  connections: {
    sqlite: DbConnectionConfig
    mysql: DbConnectionConfig
    singlestore: DbConnectionConfig
    postgres: DbConnectionConfig
  }
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
 * Get the dialect type for bun-query-builder
 */
function getDialect(): 'sqlite' | 'mysql' | 'singlestore' | 'postgres' {
  const driver = getDriver()
  if (driver === 'sqlite') return 'sqlite'
  if (driver === 'mysql') return 'mysql'
  // Pass 'singlestore' through to bun-query-builder (>=0.1.42), which shares
  // MySQL's runtime DML behavior for the dialect via isMysqlLike.
  if (driver === 'singlestore') return 'singlestore'
  if (driver === 'postgres') return 'postgres'
  return 'sqlite' // default fallback
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
function updateQueryBuilderConfig(): void {
  const dialect = getDialect()
  const dbConfigForQb = getDbConfig()

  setConfig({
    dialect: dialect as Parameters<typeof setConfig>[0]['dialect'],
    database: dbConfigForQb as any,
    verbose: getEnv() !== 'production',
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      defaultOrderColumn: 'created_at',
    },
    softDeletes: {
      // Boot-time default; mirrors config/query-builder.ts. Enabled so the
      // ORM read path filters out `deleted_at` rows by default (per-model
      // behavior still gated by the `useSoftDeletes` trait). See the config
      // file for the full rationale.
      enabled: true,
      column: 'deleted_at',
      defaultFilter: true,
    },
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
  }
  return _dbInstance
}

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
}

/**
 * Lazy proxy for the query builder - connection is only made when first used.
 * This is the main entry point for database operations.
 */
export const db = new Proxy({} as Db, {
  get(_target, prop) {
    const instance = getDb()
    const value = (instance as any)[prop]
    if (typeof value === 'function') {
      return value.bind(instance)
    }
    return value
  },
})

// Export setConfig if available
export { setConfig }
