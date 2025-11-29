/**
 * Database Migrations using bun-query-builder
 *
 * This module provides migration functionality for the stacks framework
 * powered by bun-query-builder.
 */

import type { Err, Ok, Result } from '@stacksjs/error-handling'
import { log } from '@stacksjs/cli'
import { database } from '@stacksjs/config'
import { err, handleError, ok } from '@stacksjs/error-handling'
import { path } from '@stacksjs/path'
import {
  executeMigration as qbExecuteMigration,
  generateMigration as qbGenerateMigration,
  resetConnection,
  resetDatabase as qbResetDatabase,
  setConfig,
} from 'bun-query-builder'

function getDriver(): string {
  return database.default || ''
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
  const dbConfig = database.connections[dialect]

  setConfig({
    dialect,
    database: {
      database: dbConfig?.name || dbConfig?.database || 'stacks',
      host: dbConfig?.host || 'localhost',
      port: dbConfig?.port || (dialect === 'postgres' ? 5432 : dialect === 'mysql' ? 3306 : 0),
      username: dbConfig?.username || '',
      password: dbConfig?.password || '',
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
 * Reset the database (drop all tables)
 */
export async function resetDatabase(): Promise<Ok<string, never>> {
  // Configure bun-query-builder with stacks database settings
  configureQueryBuilder()

  const modelsDir = path.userModelsPath()
  const dialect = getDialect()

  await qbResetDatabase(modelsDir, { dialect })

  return ok('All tables dropped successfully!')
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
