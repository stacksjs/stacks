/**
 * Auth Tables Migration
 *
 * Creates the authentication-related tables:
 * - oauth_clients
 * - oauth_access_tokens
 * - oauth_refresh_tokens
 * - password_resets
 */

import process from 'node:process'
import { randomBytes } from 'node:crypto'
import { log } from '@stacksjs/logging'
import { db } from './utils'

// Detect database driver from environment
import { env as envVars } from '@stacksjs/env'

function getDbDriver(): string {
  return envVars.DB_CONNECTION || 'sqlite'
}

/**
 * Create all authentication tables
 */
export async function migrateAuthTables(options: { verbose?: boolean } = {}): Promise<{ success: boolean, error?: string }> {
  const dbDriver = getDbDriver()
  const isPostgres = dbDriver === 'postgres'
  const isMysql = dbDriver === 'mysql'
  const boolTrue = isPostgres ? 'true' : '1'
  const now = isPostgres || isMysql ? 'NOW()' : `datetime('now')`

  if (options.verbose) {
    log.info(`Creating auth tables for ${dbDriver}...`)
  }

  try {
    // Create oauth_clients table
    if (options.verbose) log.info('Creating oauth_clients table...')

    if (isPostgres) {
      await db.unsafe(`
        CREATE TABLE IF NOT EXISTS oauth_clients (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          secret VARCHAR(100),
          provider VARCHAR(255),
          redirect VARCHAR(2000) NOT NULL,
          personal_access_client BOOLEAN NOT NULL DEFAULT false,
          password_client BOOLEAN NOT NULL DEFAULT false,
          revoked BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP
        )
      `).execute()
    }
    else if (isMysql) {
      await db.unsafe(`
        CREATE TABLE IF NOT EXISTS oauth_clients (
          id INTEGER AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          secret VARCHAR(100),
          provider VARCHAR(255),
          redirect VARCHAR(2000) NOT NULL,
          personal_access_client BOOLEAN NOT NULL DEFAULT 0,
          password_client BOOLEAN NOT NULL DEFAULT 0,
          revoked BOOLEAN NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL
        )
      `).execute()
    }
    else {
      await db.unsafe(`
        CREATE TABLE IF NOT EXISTS oauth_clients (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name VARCHAR(255) NOT NULL,
          secret VARCHAR(100),
          provider VARCHAR(255),
          redirect VARCHAR(2000) NOT NULL,
          personal_access_client BOOLEAN NOT NULL DEFAULT 0,
          password_client BOOLEAN NOT NULL DEFAULT 0,
          revoked BOOLEAN NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP
        )
      `).execute()
    }

    // Create oauth_access_tokens table
    if (options.verbose) log.info('Creating oauth_access_tokens table...')

    if (isPostgres) {
      await db.unsafe(`
        CREATE TABLE IF NOT EXISTS oauth_access_tokens (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          oauth_client_id INTEGER NOT NULL,
          token TEXT NOT NULL,
          name VARCHAR(255),
          scopes TEXT,
          revoked BOOLEAN NOT NULL DEFAULT false,
          expires_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP
        )
      `).execute()
    }
    else if (isMysql) {
      await db.unsafe(`
        CREATE TABLE IF NOT EXISTS oauth_access_tokens (
          id INTEGER AUTO_INCREMENT PRIMARY KEY,
          user_id INTEGER NOT NULL,
          oauth_client_id INTEGER NOT NULL,
          token TEXT NOT NULL,
          name VARCHAR(255),
          scopes TEXT,
          revoked BOOLEAN NOT NULL DEFAULT 0,
          expires_at TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL
        )
      `).execute()
    }
    else {
      await db.unsafe(`
        CREATE TABLE IF NOT EXISTS oauth_access_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          oauth_client_id INTEGER NOT NULL,
          token TEXT NOT NULL,
          name VARCHAR(255),
          scopes TEXT,
          revoked BOOLEAN NOT NULL DEFAULT 0,
          expires_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP
        )
      `).execute()
    }

    // Create index on access token
    try {
      await db.unsafe(`
        CREATE INDEX IF NOT EXISTS idx_oauth_access_tokens_token ON oauth_access_tokens(token(255))
      `).execute()
    }
    catch {
      // Some databases don't support prefix indexes, try without prefix
      try {
        await db.unsafe(`
          CREATE INDEX IF NOT EXISTS idx_oauth_access_tokens_token ON oauth_access_tokens(token)
        `).execute()
      }
      catch {
        // Index might already exist or not supported
      }
    }

    // Create oauth_refresh_tokens table
    if (options.verbose) log.info('Creating oauth_refresh_tokens table...')

    if (isPostgres) {
      await db.unsafe(`
        CREATE TABLE IF NOT EXISTS oauth_refresh_tokens (
          id SERIAL PRIMARY KEY,
          access_token_id INTEGER NOT NULL,
          token TEXT NOT NULL,
          revoked BOOLEAN NOT NULL DEFAULT false,
          expires_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `).execute()
    }
    else if (isMysql) {
      await db.unsafe(`
        CREATE TABLE IF NOT EXISTS oauth_refresh_tokens (
          id INTEGER AUTO_INCREMENT PRIMARY KEY,
          access_token_id INTEGER NOT NULL,
          token TEXT NOT NULL,
          revoked BOOLEAN NOT NULL DEFAULT 0,
          expires_at TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `).execute()
    }
    else {
      await db.unsafe(`
        CREATE TABLE IF NOT EXISTS oauth_refresh_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          access_token_id INTEGER NOT NULL,
          token TEXT NOT NULL,
          revoked BOOLEAN NOT NULL DEFAULT 0,
          expires_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `).execute()
    }

    // Create index on refresh token
    try {
      await db.unsafe(`
        CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_token ON oauth_refresh_tokens(token(255))
      `).execute()
    }
    catch {
      try {
        await db.unsafe(`
          CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_token ON oauth_refresh_tokens(token)
        `).execute()
      }
      catch {
        // Index might already exist or not supported
      }
    }

    // Create password_resets table
    if (options.verbose) log.info('Creating password_resets table...')

    if (isPostgres) {
      await db.unsafe(`
        CREATE TABLE IF NOT EXISTS password_resets (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) NOT NULL,
          token VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `).execute()
    }
    else if (isMysql) {
      await db.unsafe(`
        CREATE TABLE IF NOT EXISTS password_resets (
          id INTEGER AUTO_INCREMENT PRIMARY KEY,
          email VARCHAR(255) NOT NULL,
          token VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `).execute()
    }
    else {
      await db.unsafe(`
        CREATE TABLE IF NOT EXISTS password_resets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email VARCHAR(255) NOT NULL,
          token VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `).execute()
    }

    // Create index on password_resets email
    try {
      await db.unsafe(`
        CREATE INDEX IF NOT EXISTS idx_password_resets_email ON password_resets(email)
      `).execute()
    }
    catch {
      // Index might already exist
    }

    // Create personal access client if it doesn't exist
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

    log.success('Auth tables migrated successfully')
    return { success: true }
  }
  catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error('Failed to migrate auth tables:', errorMessage)
    return { success: false, error: errorMessage }
  }
}
