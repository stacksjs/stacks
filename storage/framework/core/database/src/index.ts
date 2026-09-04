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
export type { FrameworkSchema } from './framework-schema'
export * from './utils'

// Types (compatibility layer for Kysely types)
export * from './types'

// Migrations
export * from './migrations'

// Query logger DI hook (router calls setQueryTracker on init)
export { setQueryTracker, logQuery } from './query-logger'

// Zero-downtime migration helpers
export { addColumnSafely, backfillInBatches, renameColumnSafely } from './safe-migrations'

// Seeding
export * from './seeder'

// Driver utilities
export * from './drivers'

// Custom migrations (jobs, errors, etc.)
export * from './custom'

// Auth tables migration
export * from './auth-tables'

// Bringing an existing database's timestamp defaults up to UTC, which
// `CREATE TABLE IF NOT EXISTS` cannot do on its own
export * from './utc-defaults'

// uuid column guarantee for `useUuid` models (stacksjs/status#1 Phase 9)
export * from './uuid-columns'

// Schema-diff guards so trait-managed columns aren't proposed for dropping (stacksjs/stacks#2075)
export * from './managed-columns'

// Foreign keys a model gets from `belongsTo` rather than from `attributes`
export * from './relation-columns'

// Notification tables migration (stacksjs/stacks#1937)
export { ensureNotificationForeignKeys, migrateNotificationTables } from './notification-tables'

// RBAC tables migration (stacksjs/stacks#1941 Phase A)
export { migrateRbacTables } from './rbac-tables'

// Polymorphic trait tables (commentables/taggables/categorizables/upvotes).
// Exported wholesale like auth-tables: the pure DDL builders are how tests and
// tooling stand up the same schema `buddy migrate` creates.
export * from './trait-tables'

// MySQL TIMESTAMP -> DATETIME guarantee for framework tables
export * from './datetime-columns'

// Dialect capability table — the single source of truth for what each
// dialect speaks (wire protocol) and what it accepts (DDL features).
export * from './dialect'

// Read replica routing policy (auto-route opt-in, transaction and
// read-your-writes carve-outs, replica selection).
export * from './replicas'

// DDL capability audit — catches a corpus that is valid SQL for the target's
// wire protocol but uses a feature the engine does not implement (foreign
// keys and AUTO_INCREMENT on a sharded engine).
export * from './ddl-constraints'

// VSchema derivation — turns the model relationship graph into a Vitess
// keyspace topology, co-locating child tables with their parents so joins
// between them do not scatter across shards.
export * from './vschema'

// SQL dialect helpers & connection defaults
export * from './sql-helpers'
export * from './defaults'

// Dialect classification for the committed migration corpus, so a corpus
// emitted for one database fails loudly before a single statement runs.
export * from './migration-dialect'
export * from './migration-path'

// Ledger drift audit (stacksjs/stacks#2203) — compare the corpus on disk, the
// `migrations` table, and the live schema, because regeneration renumbers files
// and the ledger keys on the filename.
export * from './migration-ledger'

// Model resolution for the generator: userland + framework defaults, flattened
// because bun-query-builder's loadModels reads only the top level of a dir.
export * from './model-sources'
export * from './package-migrations'
export * from './package-models'
export * from './shadowed-models'

// Database bootstrap: probe the target, and create it over a maintenance
// connection we open ourselves rather than through bun-query-builder, whose
// connection string is rebuilt from process.env and cannot be redirected.
export * from './ensure-database'

// Foreign-key audit (stacksjs/stacks#1916) — compare declared
// `belongsTo` relationships against live FKs.
export { auditForeignKeys, classifyDeclaredFKs, findFkOrphans, fkKey, getDeclaredFKs, getLiveFKs, getLiveTables } from './fk-audit'

// Schema drift audit — compare live column types against what the models
// declare. `migrate` only tracks which files have run, so a database built from
// a wrong migration set reports "up to date" forever while its columns differ.
export { auditSchemaDrift, formatSchemaDrift } from './schema-drift'
export type { SchemaDriftColumn, SchemaDriftReport } from './schema-drift'
export type { DeclaredFK, FkAuditResult, FkOrphan, FkOrphanReport, LiveFK } from './fk-audit'

// Unique-index drift audit (stacksjs/stacks#1952) — compare declared
// `unique: true` attributes / indexes against live UNIQUE indexes.
export { auditUniqueIndexes, getDeclaredUniques, getLiveUniqueIndexes } from './unique-audit'
export type { DeclaredUnique, LiveUniqueIndex, UniqueAuditResult } from './unique-audit'

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
