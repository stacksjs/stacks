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

// Seeding
export * from './seeder'

// Driver utilities
export * from './drivers'

// Re-export bun-query-builder functions and types
export {
  createQueryBuilder,
  Seeder,
  setConfig,
} from 'bun-query-builder'

export type {
  QueryBuilder,
  QueryBuilderConfig,
  SupportedDialect,
} from 'bun-query-builder'
