/**
 * @stacksjs/database
 *
 * Database module powered by bun-query-builder.
 * Provides database initialization, driver configuration, migrations,
 * seeding, and a fluent query builder interface.
 *
 * @example
 * ```ts
 * import { Database, db, createSqliteDatabase } from '@stacksjs/database'
 *
 * // Use the default db instance (configured from environment)
 * const users = await db.selectFrom('users').where('active', '=', true).get()
 *
 * // Or create a custom database instance
 * const customDb = new Database({
 *   driver: 'postgres',
 *   connection: {
 *     database: 'myapp',
 *     host: 'localhost',
 *     port: 5432,
 *     username: 'postgres',
 *     password: 'secret'
 *   }
 * })
 *
 * // Helper functions for quick setup
 * const sqliteDb = createSqliteDatabase('database/app.sqlite')
 * ```
 */

// Database initialization and management
export {
  Database,
  createDatabase,
  createMysqlDatabase,
  createPostgresDatabase,
  createSqliteDatabase,
} from './database'

export type {
  DatabaseConnectionConfig,
  DatabaseOptions,
} from './database'

// Driver configuration
export {
  detectDriver,
  driverDefaults,
  getConfigFromEnv,
  getConnectionString,
  mergeWithDefaults,
  validateDriverConfig,
} from './driver-config'

export type {
  DatabaseConnections,
  DynamoDbConfig,
  FullDatabaseConfig,
  MysqlConfig,
  PostgresConfig,
  SqliteConfig,
} from './driver-config'

// Core database utilities and default instance
export * from './utils'

// Types (compatibility layer for Kysely types)
export * from './types'

// Migrations
export * from './migrations'

// Query logger DI hook (router calls setQueryTracker on init)
export { setQueryTracker, logQuery } from './query-logger'

// Class-based seeders (supplements the model-attribute auto-seeder)
export { Seeder, runClassSeeders } from './class-seeder'

// Zero-downtime migration helpers
export { addColumnSafely, backfillInBatches, renameColumnSafely } from './safe-migrations'

// Seeding
export * from './seeder'

// stacksjs/stacks#1919 — public factory API. The canonical replacement
// for the legacy `useSeeder` trait + auto-walker. Class seeders call
// `factory.generate(Model, opts)` explicitly so there's one
// orchestration layer per table, no double-fire on tables that have
// both a `useSeeder` trait and a class seeder file.
export { factory, generate as factoryGenerate } from './factory'
export type { GenerateOptions } from './factory'

// `buddy seed:scaffold` codemod — generates class-seeder files for
// every model with a `useSeeder` trait, easing the migration off the
// auto-walker.
export { scaffoldClassSeedersFromModels, renderSeederFile } from './seed-scaffold'
export type { ScaffoldOptions, ScaffoldResult } from './seed-scaffold'

// Driver utilities
export * from './drivers'

// Custom migrations (jobs, errors, etc.)
export * from './custom'

// Auth tables migration
export * from './auth-tables'

// SQL dialect helpers & connection defaults
export * from './sql-helpers'
export * from './defaults'

// Foreign-key audit (stacksjs/stacks#1916) — compare declared
// `belongsTo` relationships against live FKs.
export { auditForeignKeys, getDeclaredFKs, getLiveFKs } from './fk-audit'
export type { DeclaredFK, FkAuditResult, LiveFK } from './fk-audit'

// Transaction context: AsyncLocalStorage-based scope so side-effect
// emitters (queue dispatch, mailer send) can buffer themselves
// until the surrounding `db.transaction(...)` commits
// (stacksjs/stacks#1882).
export {
  __flushAfterCommitNow,
  __pendingAfterCommitCount,
  enqueueAfterCommit,
  isInTransaction,
  runInTransactionScope,
} from './transaction-context'

// Re-export bun-query-builder functions and types
export {
  createQueryBuilder,
  setConfig,
} from '@stacksjs/query-builder'

export type {
  QueryBuilder,
  QueryBuilderConfig,
  Seeder as QueryBuilderSeeder,
  SupportedDialect,
} from '@stacksjs/query-builder'

// DynamoDB entity-centric API
export {
  createDynamo,
  dynamo,
  EntityQueryBuilder,
  generateKeyPattern,
  parseKeyPattern,
  buildKey,
  marshall,
  unmarshall,
} from './drivers/dynamodb'

export type {
  DynamoConnectionConfig,
  SingleTableEntityMapping,
  SortKeyBuilder,
  BatchWriteOperation,
  TransactWriteOperation,
  QueryResult,
} from './drivers/dynamodb'
