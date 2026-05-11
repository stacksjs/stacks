/**
 * Database utilities using bun-query-builder
 *
 * This module provides the database connection and query builder
 * configured using the stacks database config.
 */

import type { DatabaseSchema } from 'bun-query-builder'
import { createQueryBuilder, setConfig } from 'bun-query-builder'

// Permissive schema type that accepts any table name with any columns
// This allows the query builder to work before model types are generated
type AnySchema = DatabaseSchema<any> & Record<string, { columns: Record<string, any>, primaryKey: string }>

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
    postgres: { name: postgresDefaults.database, host: postgresDefaults.host, username: postgresDefaults.username, password: postgresDefaults.password, port: postgresDefaults.port, prefix: '' },
  },
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
function getDialect(): 'sqlite' | 'mysql' | 'postgres' {
  const driver = getDriver()
  if (driver === 'sqlite') return 'sqlite'
  if (driver === 'mysql') return 'mysql'
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
    dialect,
    database: dbConfigForQb as any,
    verbose: getEnv() !== 'production',
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      defaultOrderColumn: 'created_at',
    },
    softDeletes: {
      enabled: false,
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
        const { config } = await import('@stacksjs/config')
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

function getDb(): ReturnType<typeof createQueryBuilder> {
  if (!_dbInstance) {
    updateQueryBuilderConfig()
    _dbInstance = createQueryBuilder()
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
  where: (...args: any[]) => FluentChain
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
  select: (...args: any[]) => FluentChain
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

interface Db extends Pick<Required<RawQueryBuilder>, GenericPassthroughKeys> {
  selectFrom: (table: string) => FluentChain
  insertInto: (table: string) => FluentChain
  updateTable: (table: string) => FluentChain
  deleteFrom: (table: string) => FluentChain
  table: (table: string) => FluentChain
  selectFromSub: (sub: any, alias: string) => FluentChain
  select: (table: string, ...columns: string[]) => FluentChain
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
