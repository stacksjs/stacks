import process from 'node:process'
import { randomBytes } from 'node:crypto'
import { db } from '@stacksjs/database'
import { log } from '@stacksjs/logging'

// Detect database driver from environment
const envVars = typeof Bun !== 'undefined' ? Bun.env : process.env
const dbDriver = envVars.DB_CONNECTION || 'sqlite'
const isPostgres = dbDriver === 'postgres'
const isMysql = dbDriver === 'mysql'

// SQL syntax helpers for cross-database compatibility
// - PostgreSQL: SERIAL PRIMARY KEY, NOW(), true/false
// - MySQL: INTEGER AUTO_INCREMENT PRIMARY KEY, NOW(), 1/0
// - SQLite: INTEGER PRIMARY KEY AUTOINCREMENT, datetime('now'), 1/0
const autoIncrement = isPostgres ? 'SERIAL' : 'INTEGER'
const primaryKey = isPostgres ? 'PRIMARY KEY' : (isMysql ? 'PRIMARY KEY AUTO_INCREMENT' : 'PRIMARY KEY AUTOINCREMENT')
const now = isPostgres || isMysql ? 'NOW()' : "datetime('now')"
const boolTrue = isPostgres ? 'true' : '1'
const boolFalse = isPostgres ? 'false' : '0'

log.info('Setting up authentication...')
log.info(`Database driver: ${dbDriver}`)

// Step 1: Ensure OAuth tables exist
log.info('Ensuring OAuth tables exist...')

try {
  // Create oauth_clients table if it doesn't exist
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
  } else if (isMysql) {
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
        updated_at TIMESTAMP
      )
    `).execute()
  } else {
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

  // Create oauth_access_tokens table if it doesn't exist
  // Note: tokens are JWT-like strings with embedded metadata (variable length)
  // Foreign keys removed to allow standalone OAuth tables (not dependent on ORM models)
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
  } else if (isMysql) {
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
  } else {
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

  // Create index on token for fast lookups
  await db.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_oauth_access_tokens_token ON oauth_access_tokens(token)
  `).execute()

  // Create oauth_refresh_tokens table if it doesn't exist
  // Note: tokens are JWT-like strings with embedded metadata (variable length)
  // Foreign keys removed to allow standalone OAuth tables
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
  } else if (isMysql) {
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
  } else {
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

  // Create index on refresh token for fast lookups
  await db.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_token ON oauth_refresh_tokens(token)
  `).execute()

  log.success('OAuth tables ready')
}
catch (error) {
  log.error('Failed to create OAuth tables', error)
  process.exit(1)
}

// Step 2: Create personal access client
log.info('Creating personal access client...')

try {
  // Check if personal access client already exists using raw SQL
  const existing = await db.unsafe(`
    SELECT id FROM oauth_clients WHERE personal_access_client = ${boolTrue} LIMIT 1
  `).execute()

  if ((existing as any[])?.length > 0) {
    console.log('\n✓ Personal access client already exists')
  }
  else {
    const secret = randomBytes(40).toString('hex')

    if (isPostgres) {
      await db.unsafe(`
        INSERT INTO oauth_clients (name, secret, provider, redirect, personal_access_client, password_client, revoked, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, ['Personal Access Client', secret, 'local', 'http://localhost', true, false, false]).execute()
    } else {
      // MySQL and SQLite both use ? placeholders and numeric booleans
      await db.unsafe(`
        INSERT INTO oauth_clients (name, secret, provider, redirect, personal_access_client, password_client, revoked, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ${now})
      `, ['Personal Access Client', secret, 'local', 'http://localhost', 1, 0, 0]).execute()
    }

    console.log('\n✓ Personal access client created successfully')
  }
}
catch (error) {
  console.error('Failed to create personal access client:', error)
  process.exit(1)
}

console.log('\n✓ Authentication setup complete!')
console.log('\nFeatures enabled:')
console.log('  - Token hashing (SHA-256) for secure storage')
console.log('  - Refresh tokens for seamless token renewal')
console.log('  - Scope-based authorization')
console.log('\nNext steps:')
console.log('  1. Use createToken(userId, name, scopes) to generate tokens')
console.log('  2. Use refreshToken(token) to exchange refresh tokens')
console.log('  3. Use the "auth" middleware to protect routes')
console.log('  4. Use tokenCan(scope) for authorization checks\n')

process.exit(0)
