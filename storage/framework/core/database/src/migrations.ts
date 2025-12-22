/**
 * Database Migrations using bun-query-builder
 *
 * This module provides migration functionality for the stacks framework
 * powered by bun-query-builder.
 */

import type { Err, Ok, Result } from '@stacksjs/error-handling'
import { log } from '@stacksjs/cli'
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

// Use environment variables directly to avoid circular dependencies with @stacksjs/config
const envVars = typeof Bun !== 'undefined' ? Bun.env : process.env

// Build database config from environment variables
const dbDriver = envVars.DB_CONNECTION || 'sqlite'
const dbConfig = {
  default: dbDriver,
  connections: {
    sqlite: {
      database: 'database/stacks.sqlite',
      prefix: '',
    },
    mysql: {
      name: envVars.DB_DATABASE || 'stacks',
      host: envVars.DB_HOST || '127.0.0.1',
      username: envVars.DB_USERNAME || 'root',
      password: envVars.DB_PASSWORD || '',
      port: Number(envVars.DB_PORT) || 3306,
      prefix: '',
    },
    postgres: {
      name: envVars.DB_DATABASE || 'stacks',
      host: envVars.DB_HOST || '127.0.0.1',
      username: envVars.DB_USERNAME || '',
      password: envVars.DB_PASSWORD || '',
      port: Number(envVars.DB_PORT) || 5432,
      prefix: '',
    },
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
 * Run database migrations
 */
export async function runDatabaseMigration(): Promise<Result<string, Error>> {
  try {
    log.info('Migrating database...')

    // Configure bun-query-builder with stacks database settings
    configureQueryBuilder()

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
export async function resetDatabase(): Promise<Ok<string, never>> {
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

/**
 * Drop framework-managed tables (OAuth, passkeys, jobs, etc.)
 */
async function dropFrameworkTables(dialect: 'sqlite' | 'mysql' | 'postgres'): Promise<void> {
  // Disable foreign key checks for MySQL to avoid constraint issues
  if (dialect === 'mysql') {
    try {
      await db.unsafe('SET FOREIGN_KEY_CHECKS = 0').execute()
    }
    catch (error) {
      log.warn(`Could not disable foreign key checks: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Disable foreign key checks for SQLite
  if (dialect === 'sqlite') {
    try {
      await db.unsafe('PRAGMA foreign_keys = OFF').execute()
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

      await db.unsafe(dropSql).execute()

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
      await db.unsafe('SET FOREIGN_KEY_CHECKS = 1').execute()
    }
    catch (error) {
      log.warn(`Could not re-enable foreign key checks: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Re-enable foreign key checks for SQLite
  if (dialect === 'sqlite') {
    try {
      await db.unsafe('PRAGMA foreign_keys = ON').execute()
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
export async function generateMigrations(): Promise<Ok<string, never> | Err<string, any>> {
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
    return err(error)
  }
}

/**
 * Generate fresh migrations (full regeneration, ignoring previous state)
 */
export async function generateMigrations2(): Promise<Ok<string, never> | Err<string, any>> {
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
    return err(error)
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
