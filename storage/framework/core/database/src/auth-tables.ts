/**
 * Auth Tables Migration
 *
 * Creates the authentication-related tables:
 * - oauth_clients
 * - oauth_access_tokens
 * - oauth_refresh_tokens
 * - password_resets
 *
 * Pre stacksjs/stacks#1915 D-3, every CREATE TABLE was duplicated three
 * times — once per dialect — and ~200 lines of copy-pasted SQL diverged
 * subtly across drivers (NULL modifiers, boolean defaults, primary-key
 * syntax). Each table is now declared once with the dialect-specific
 * bits sourced from {@link sqlHelpers}; everything else is identical
 * across drivers.
 */

import process from 'node:process'
import { randomBytes } from 'node:crypto'
import { log } from '@stacksjs/logging'
import { env as envVars } from '@stacksjs/env'
import { db } from './utils'
import { sqlHelpers } from './sql-helpers'

function getDbDriver(): string {
  return envVars.DB_CONNECTION || 'sqlite'
}

/**
 * Create all authentication tables
 */
export async function migrateAuthTables(options: { verbose?: boolean } = {}): Promise<{ success: boolean, error?: string }> {
  const dbDriver = getDbDriver()
  const sql = sqlHelpers(dbDriver)
  const { isPostgres, boolTrue, now, pkColumn, nullableTimestamp } = sql

  if (options.verbose) {
    log.info(`Creating auth tables for ${dbDriver}...`)
  }

  try {
    if (options.verbose) log.info('Creating oauth_clients table...')
    await db.unsafe(`
      CREATE TABLE IF NOT EXISTS oauth_clients (
        ${pkColumn},
        name VARCHAR(255) NOT NULL,
        secret VARCHAR(100),
        provider VARCHAR(255),
        redirect VARCHAR(2000) NOT NULL,
        personal_access_client BOOLEAN NOT NULL DEFAULT ${sql.boolFalse},
        password_client BOOLEAN NOT NULL DEFAULT ${sql.boolFalse},
        revoked BOOLEAN NOT NULL DEFAULT ${sql.boolFalse},
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at ${nullableTimestamp}
      )
    `).execute()

    if (options.verbose) log.info('Creating oauth_access_tokens table...')
    await db.unsafe(`
      CREATE TABLE IF NOT EXISTS oauth_access_tokens (
        ${pkColumn},
        user_id INTEGER NOT NULL,
        oauth_client_id INTEGER NOT NULL,
        token TEXT NOT NULL,
        name VARCHAR(255),
        scopes TEXT,
        revoked BOOLEAN NOT NULL DEFAULT ${sql.boolFalse},
        expires_at ${nullableTimestamp},
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at ${nullableTimestamp}
      )
    `).execute()

    // Some MySQL setups need a key length on TEXT-column indexes (e.g.
    // `token(255)`); Postgres + SQLite don't. Try the prefixed form
    // first, fall back to the unprefixed form.
    await createTokenIndex('idx_oauth_access_tokens_token', 'oauth_access_tokens', 'token')

    if (options.verbose) log.info('Creating oauth_refresh_tokens table...')
    await db.unsafe(`
      CREATE TABLE IF NOT EXISTS oauth_refresh_tokens (
        ${pkColumn},
        access_token_id INTEGER NOT NULL,
        token TEXT NOT NULL,
        revoked BOOLEAN NOT NULL DEFAULT ${sql.boolFalse},
        expires_at ${nullableTimestamp},
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).execute()

    await createTokenIndex('idx_oauth_refresh_tokens_token', 'oauth_refresh_tokens', 'token')

    if (options.verbose) log.info('Creating password_resets table...')
    await db.unsafe(`
      CREATE TABLE IF NOT EXISTS password_resets (
        ${pkColumn},
        email VARCHAR(255) NOT NULL,
        token VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).execute()

    try {
      await db.unsafe(`
        CREATE INDEX IF NOT EXISTS idx_password_resets_email ON password_resets(email)
      `).execute()
    }
    catch {
      // Index might already exist
    }

    if (options.verbose) log.info('Ensuring personal access client exists...')

    const existing = await db.unsafe(`
      SELECT id FROM oauth_clients WHERE personal_access_client = ${boolTrue} LIMIT 1
    `).execute()

    if ((existing as any[])?.length === 0) {
      const secret = randomBytes(40).toString('hex')

      if (isPostgres) {
        await db.unsafe(`
          INSERT INTO oauth_clients (name, secret, provider, redirect, personal_access_client, password_client, revoked, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `, ['Personal Access Client', secret, 'local', 'http://localhost', true, false, false]).execute()
      }
      else {
        await db.unsafe(`
          INSERT INTO oauth_clients (name, secret, provider, redirect, personal_access_client, password_client, revoked, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ${now})
        `, ['Personal Access Client', secret, 'local', 'http://localhost', 1, 0, 0]).execute()
      }

      if (options.verbose) log.success('Personal access client created')
    }

    // Auth-table SQL is exclusively `CREATE TABLE IF NOT EXISTS`, so
    // this success line was firing on every `buddy migrate` whether
    // anything changed or not. Keep it as a debug signal — the buddy
    // command's outro already reports overall outcome to the user.
    log.debug('Auth tables migrated successfully')
    return { success: true }
  }
  catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error('Failed to migrate auth tables:', errorMessage)
    return { success: false, error: errorMessage }
  }
}

/**
 * Create a TEXT-column token index, falling back from MySQL's
 * `column(255)` prefix syntax to the unprefixed form for other
 * dialects (and for MySQL setups where the prefix is rejected by the
 * configured index type).
 */
async function createTokenIndex(indexName: string, tableName: string, column: string): Promise<void> {
  try {
    await db.unsafe(`
      CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName}(${column}(255))
    `).execute()
  }
  catch {
    try {
      await db.unsafe(`
        CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName}(${column})
      `).execute()
    }
    catch {
      // Index might already exist or not supported
    }
  }
}
