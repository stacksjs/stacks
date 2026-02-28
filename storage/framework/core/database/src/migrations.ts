/**
 * Database Migrations using bun-query-builder
 *
 * This module provides migration functionality for the stacks framework
 * powered by bun-query-builder.
 */

import type { Result } from '@stacksjs/error-handling'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { log as _log } from '@stacksjs/logging'

// Defensive log wrapper to handle cases where log methods might not be initialized
const log = {
  info: (...args: any[]) => typeof _log?.info === 'function' ? _log.info(...args) : console.log(...args),
  success: (msg: string) => typeof _log?.success === 'function' ? _log.success(msg) : console.log(msg),
  warn: (msg: string) => typeof _log?.warn === 'function' ? _log.warn(msg) : console.warn(msg),
}
import { err, handleError, ok } from '@stacksjs/error-handling'
import { path } from '@stacksjs/path'
import {
  executeMigration as qbExecuteMigration,
  generateMigration as qbGenerateMigration,
  resetConnection,
  resetDatabase as qbResetDatabase,
  setConfig,
} from 'bun-query-builder'
import { db } from './utils'

// Use environment variables via @stacksjs/env for proper type coercion
import { env as envVars } from '@stacksjs/env'
import { getConnectionDefaults } from './defaults'

// Build database config from environment variables
const dbDriver = envVars.DB_CONNECTION || 'sqlite'
const sqliteDefaults = getConnectionDefaults('sqlite', envVars)
const mysqlDefaults = getConnectionDefaults('mysql', envVars)
const postgresDefaults = getConnectionDefaults('postgres', envVars)

const dbConfig = {
  default: dbDriver,
  connections: {
    sqlite: { database: sqliteDefaults.database, prefix: '' },
    mysql: { name: mysqlDefaults.database, host: mysqlDefaults.host, username: mysqlDefaults.username, password: mysqlDefaults.password, port: mysqlDefaults.port, prefix: '' },
    postgres: { name: postgresDefaults.database, host: postgresDefaults.host, username: postgresDefaults.username, password: postgresDefaults.password, port: postgresDefaults.port, prefix: '' },
  },
}

function getDriver(): string {
  return dbConfig.default || 'sqlite'
}

function getDialect(): 'sqlite' | 'mysql' | 'postgres' {
  const driver = getDriver()
  if (driver === 'sqlite') return 'sqlite'
  if (driver === 'mysql') return 'mysql'
  if (driver === 'postgres') return 'postgres'
  return 'sqlite'
}

/**
 * Configure bun-query-builder with stacks database settings
 */
function configureQueryBuilder(): void {
  const dialect = getDialect()
  const connectionConfig = dbConfig.connections[dialect] as any

  setConfig({
    dialect,
    database: {
      database: connectionConfig?.name || connectionConfig?.database || 'stacks',
      host: connectionConfig?.host || 'localhost',
      port: connectionConfig?.port || (dialect === 'postgres' ? 5432 : dialect === 'mysql' ? 3306 : 0),
      username: connectionConfig?.username || '',
      password: connectionConfig?.password || '',
    },
  })

  // Reset the connection to ensure the new config is used
  resetConnection()
}

/**
 * SQLite compatibility preprocessing for migrations.
 *
 * SQLite does not support:
 * - ALTER TABLE ADD CONSTRAINT (foreign keys must be defined at table creation)
 * - Creating duplicate unique indexes on columns that already have UNIQUE constraints
 *   from inline table definitions (the index name differs but the constraint conflicts)
 *
 * This function rewrites incompatible migration files to no-ops.
 */
function preprocessSqliteMigrations(): void {
  const migrationsDir = join(process.cwd(), 'database', 'migrations')
  let files: string[]
  try {
    files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql'))
  }
  catch {
    return // directory doesn't exist yet
  }

  const addConstraintPattern = /^\s*ALTER\s+TABLE\s+.+\s+ADD\s+CONSTRAINT\s+/i
  // Match CREATE UNIQUE INDEX — these are redundant in SQLite when the table
  // already defines the UNIQUE constraint inline during CREATE TABLE.
  // Regular CREATE INDEX is fine and should NOT be skipped.
  const createUniqueIndexPattern = /^\s*CREATE\s+UNIQUE\s+INDEX\s+/i
  // Match ALTER TABLE ... DROP COLUMN — SQLite fails if the column doesn't exist
  const dropColumnPattern = /^\s*ALTER\s+TABLE\s+["']?(\w+)["']?\s+DROP\s+COLUMN\s+["']?(\w+)["']?\s*$/i

  // Open SQLite DB to check column existence for DROP COLUMN migrations
  const sqliteDbPath = join(process.cwd(), dbConfig.connections.sqlite.database || 'stacks.db')
  let sqliteDb: import('bun:sqlite').Database | null = null
  if (existsSync(sqliteDbPath)) {
    try {
      const { Database } = require('bun:sqlite')
      sqliteDb = new Database(sqliteDbPath, { readonly: true })
    }
    catch {
      // If we can't open the DB, we'll skip DROP COLUMN checks
    }
  }

  for (const file of files) {
    const filePath = join(migrationsDir, file)
    const content = readFileSync(filePath, 'utf-8')
    const statements = content
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    if (statements.length === 0) continue

    // Skip files that only contain ALTER TABLE ADD CONSTRAINT
    const allAddConstraint = statements.every(s => addConstraintPattern.test(s))
    if (allAddConstraint) {
      log.info(`Skipping SQLite-incompatible migration: ${file}`)
      writeFileSync(filePath, '-- Skipped: SQLite does not support ALTER TABLE ADD CONSTRAINT\nSELECT 1;\n')
      continue
    }

    // CREATE UNIQUE INDEX fails in SQLite when the column already has
    // a UNIQUE constraint from table creation. IF NOT EXISTS only checks
    // by index name, not by column — so a second unique index with a
    // different name triggers SQLITE_CONSTRAINT_UNIQUE.
    const allCreateUniqueIndex = statements.every(s => createUniqueIndexPattern.test(s))
    if (allCreateUniqueIndex) {
      log.info(`Skipping redundant unique index migration for SQLite: ${file}`)
      writeFileSync(filePath, '-- Skipped: unique constraints already exist from table creation\nSELECT 1;\n')
      continue
    }

    // DROP COLUMN fails in SQLite if the column doesn't exist (e.g., on fresh DB
    // where the CREATE TABLE already reflects the current model without the column).
    // Filter out DROP COLUMN statements for non-existent columns. Keep all other
    // statements unchanged.
    const hasDropColumn = statements.some(s => dropColumnPattern.test(s))
    if (hasDropColumn) {
      let modified = false
      const filteredStatements: string[] = []

      for (const stmt of statements) {
        const dropColMatch = stmt.match(dropColumnPattern)
        if (dropColMatch) {
          const tableName = dropColMatch[1]
          const columnName = dropColMatch[2]

          if (!sqliteDb) {
            // No database file — fresh install. The CREATE TABLE migration will
            // create the table from the current model (without the dropped column),
            // so this DROP COLUMN is unnecessary.
            log.info(`Skipping DROP COLUMN "${columnName}" — no database exists yet: ${file}`)
            modified = true
            continue
          }

          try {
            const columns = (sqliteDb as any).prepare(`PRAGMA table_info("${tableName}")`).all() as Array<{ name: string }>
            if (columns.length === 0) {
              // Table doesn't exist yet — column will be absent from CREATE TABLE
              log.info(`Skipping DROP COLUMN "${columnName}" — table "${tableName}" does not exist yet: ${file}`)
              modified = true
              continue
            }
            const columnExists = columns.some((col: { name: string }) => col.name === columnName)
            if (!columnExists) {
              log.info(`Skipping DROP COLUMN "${columnName}" from "${tableName}" — column does not exist: ${file}`)
              modified = true
              continue
            }
          }
          catch {
            // Table doesn't exist — skip the DROP COLUMN
            log.info(`Skipping DROP COLUMN "${columnName}" — table "${tableName}" not found: ${file}`)
            modified = true
            continue
          }
        }
        filteredStatements.push(stmt)
      }

      if (modified) {
        if (filteredStatements.length === 0) {
          writeFileSync(filePath, '-- Skipped: columns already absent from table\nSELECT 1;\n')
        }
        else {
          writeFileSync(filePath, `${filteredStatements.join(';\n')};\n`)
        }
        continue
      }
    }
  }

  if (sqliteDb) {
    try { (sqliteDb as any).close() }
    catch { /* ignore */ }
  }
}

/**
 * Run database migrations
 */
export async function runDatabaseMigration(): Promise<Result<string, Error>> {
  try {
    log.info('Migrating database...')

    // Configure bun-query-builder with stacks database settings
    configureQueryBuilder()

    // Preprocess migrations for SQLite compatibility
    if (getDialect() === 'sqlite') {
      preprocessSqliteMigrations()
    }

    const modelsDir = path.userModelsPath()

    // Execute existing migration files
    await qbExecuteMigration(modelsDir)

    log.success('Database migration completed.')
    return ok('Database migration completed.')
  }
  catch (error) {
    return err(handleError('Migration failed', error))
  }
}

/**
 * Framework tables that are not part of user models but need to be dropped
 * These include OAuth tables, passkeys, and other framework-managed tables
 */
const FRAMEWORK_TABLES = [
  'oauth_refresh_tokens', // Drop first due to foreign key to oauth_access_tokens
  'oauth_access_tokens',
  'oauth_clients',
  'passkeys',
  'failed_jobs',
  'jobs',
  'notifications',
  'password_reset_tokens',
]

/**
 * Reset the database (drop all tables)
 */
export async function resetDatabase(): Promise<Result<string, Error>> {
  try {
    // Configure bun-query-builder with stacks database settings
    configureQueryBuilder()

    const modelsDir = path.userModelsPath()
    const dialect = getDialect()

    // Drop framework tables first (OAuth, passkeys, etc.)
    await dropFrameworkTables(dialect)

    // Then drop user model tables
    await qbResetDatabase(modelsDir, { dialect })

    return ok('All tables dropped successfully!')
  }
  catch (error) {
    return err(handleError('Database reset failed', error))
  }
}

/**
 * Drop framework-managed tables (OAuth, passkeys, jobs, etc.)
 */
async function dropFrameworkTables(dialect: 'sqlite' | 'mysql' | 'postgres'): Promise<void> {
  // Disable foreign key checks for MySQL to avoid constraint issues
  if (dialect === 'mysql') {
    try {
      await (db as any).unsafe('SET FOREIGN_KEY_CHECKS = 0').execute()
    }
    catch (error) {
      log.warn(`Could not disable foreign key checks: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Disable foreign key checks for SQLite
  if (dialect === 'sqlite') {
    try {
      await (db as any).unsafe('PRAGMA foreign_keys = OFF').execute()
    }
    catch (error) {
      log.warn(`Could not disable foreign key checks: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  for (const tableName of FRAMEWORK_TABLES) {
    try {
      // SQLite uses double quotes or no quotes, MySQL uses backticks, Postgres uses double quotes with CASCADE
      let dropSql: string
      if (dialect === 'postgres') {
        dropSql = `DROP TABLE IF EXISTS "${tableName}" CASCADE`
      }
      else if (dialect === 'mysql') {
        dropSql = `DROP TABLE IF EXISTS \`${tableName}\``
      }
      else {
        // SQLite - use double quotes for identifiers
        dropSql = `DROP TABLE IF EXISTS "${tableName}"`
      }

      log.info(`Dropping framework table: ${tableName}`)

      await (db as any).unsafe(dropSql).execute()

      log.info(`Dropped framework table: ${tableName}`)
    }
    catch (error) {
      // Log the actual error for debugging, but continue with other tables
      log.warn(`Could not drop table ${tableName}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Re-enable foreign key checks for MySQL
  if (dialect === 'mysql') {
    try {
      await (db as any).unsafe('SET FOREIGN_KEY_CHECKS = 1').execute()
    }
    catch (error) {
      log.warn(`Could not re-enable foreign key checks: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Re-enable foreign key checks for SQLite
  if (dialect === 'sqlite') {
    try {
      await (db as any).unsafe('PRAGMA foreign_keys = ON').execute()
    }
    catch (error) {
      log.warn(`Could not re-enable foreign key checks: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

/**
 * Generate migrations based on model changes
 * This is the new bun-query-builder style that compares models to generate diffs
 */
export async function generateMigrations(): Promise<Result<string, Error>> {
  try {
    log.info('Generating migrations...')

    // Configure bun-query-builder with stacks database settings
    configureQueryBuilder()

    const modelsDir = path.userModelsPath()
    const dialect = getDialect()

    const result = await qbGenerateMigration(modelsDir, { dialect })

    if (result.hasChanges) {
      log.success('Migrations generated')
    }
    else {
      log.info('No changes detected')
    }

    return ok('Migrations generated')
  }
  catch (error) {
    return err(handleError('Migration generation failed', error))
  }
}

/**
 * Generate fresh migrations (full regeneration, ignoring previous state)
 */
export async function generateMigrations2(): Promise<Result<string, Error>> {
  try {
    log.info('Generating fresh migrations...')

    // Configure bun-query-builder with stacks database settings
    configureQueryBuilder()

    const modelsDir = path.userModelsPath()
    const dialect = getDialect()

    await qbGenerateMigration(modelsDir, { dialect, full: true })

    log.success('Migrations generated')
    return ok('Migrations generated')
  }
  catch (error) {
    return err(handleError('Fresh migration generation failed', error))
  }
}

/**
 * Migration result type for compatibility
 */
export interface MigrationResult {
  migrationName: string
  direction: 'Up' | 'Down'
  status: 'Success' | 'Error' | 'NotExecuted'
}

export type { MigrationResult as MigrationResultType }
