import process from 'node:process'
import { randomBytes } from 'node:crypto'
import { db } from '@stacksjs/database'
import { log } from '@stacksjs/logging'
import { makeHash } from '@stacksjs/security'

// Detect database driver from environment
import { env } from '@stacksjs/env'
import { sqlHelpers, usersEmailVerifiedAtSql, usersPasswordChangedAtSql } from '@stacksjs/database'

const dbDriver = env.DB_CONNECTION || 'sqlite'
const sql = sqlHelpers(dbDriver)
const { isPostgres, isMysql, now, boolTrue, boolFalse: _boolFalse } = sql

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
    `)
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
    `)
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
    `)
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
    `)
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
    `)
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
    `)
  }

  // Create index on token for fast lookups
  await db.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_oauth_access_tokens_token ON oauth_access_tokens(token)
  `)

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
    `)
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
    `)
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
    `)
  }

  // Create index on refresh token for fast lookups
  await db.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_token ON oauth_refresh_tokens(token)
  `)

  log.success('OAuth tables ready')
}
catch (error) {
  log.error('Failed to create OAuth tables', error)
  process.exit(1)
}

// Step 1b: Create password_resets table for password reset flow.
//
// Each row carries an explicit `expires_at` timestamp so verification
// doesn't depend on the application code's clock-arithmetic against
// `created_at`. A unique constraint on `email` enforces "one
// outstanding token per email" — the application layer deletes the
// prior row before inserting a new one, so requesting a second reset
// always invalidates the first (stacksjs/stacks#1861 A-5 + M-2).
log.info('Ensuring password_resets table exists...')

try {
  if (isPostgres) {
    await db.unsafe(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        token VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
  } else if (isMysql) {
    await db.unsafe(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id INTEGER AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        token VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
  } else {
    await db.unsafe(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email VARCHAR(255) NOT NULL,
        token VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
  }

  // Defensive ALTER for installs that ran an earlier `auth:setup`
  // before the `expires_at` column existed. The column has a
  // CURRENT_TIMESTAMP default so existing rows aren't orphaned, but
  // application-issued tokens always set an explicit value.
  try {
    await db.unsafe(`ALTER TABLE password_resets ADD COLUMN expires_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`)
  }
  catch { /* column already exists — safe to ignore */ }

  // Unique index on email — enforces single-outstanding-token-per-email.
  // The application's createResetToken() deletes the prior row before
  // insert so a second reset request always supersedes the first.
  await db.unsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_password_resets_email_unique ON password_resets(email)
  `)

  log.success('Password resets table ready')
}
catch (error) {
  log.error('Failed to create password_resets table', error)
  process.exit(1)
}

// Step 1c: Create email_verifications table.
//
// Previously read+written by `@stacksjs/auth`'s `email-verification.ts`
// but never created — the first call to `sendVerificationEmail` on a
// fresh install would fail at the DB layer. See stacksjs/stacks#1861 M-3.
log.info('Ensuring email_verifications table exists...')

try {
  if (isPostgres) {
    await db.unsafe(`
      CREATE TABLE IF NOT EXISTS email_verifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        token VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
  } else if (isMysql) {
    await db.unsafe(`
      CREATE TABLE IF NOT EXISTS email_verifications (
        id INTEGER AUTO_INCREMENT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        token VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
  } else {
    await db.unsafe(`
      CREATE TABLE IF NOT EXISTS email_verifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
  }

  // Unique index on user_id — application layer deletes the prior row
  // before inserting a new one, so each user has at most one
  // outstanding verification token at a time.
  await db.unsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_email_verifications_user_id_unique ON email_verifications(user_id)
  `)

  // Defensive ALTER for the column `verifyEmail()` writes. Generated
  // users migrations omit `email_verified_at` (stacksjs/stacks#1948),
  // so guarantee it here — same pattern as the password_resets
  // `expires_at` ALTER above. Fails harmlessly when the column already
  // exists or when `users` hasn't been migrated yet (`buddy migrate`
  // also ensures it via migrateAuthTables).
  try {
    await db.unsafe(usersEmailVerifiedAtSql(sql))
  }
  catch { /* column already exists (or users table missing) — safe to ignore */ }

  // Defensive ALTER for the column `resetPassword()` stamps and the
  // token-validation paths read to invalidate credentials issued
  // before a password change (stacksjs/stacks#1957, a #1947 follow-up).
  // Same pattern + swallow as the email_verified_at ALTER above; also
  // ensured on the `buddy migrate` path via migrateAuthTables.
  try {
    await db.unsafe(usersPasswordChangedAtSql(sql))
  }
  catch { /* column already exists (or users table missing) — safe to ignore */ }

  log.success('Email verifications table ready')
}
catch (error) {
  log.error('Failed to create email_verifications table', error)
  process.exit(1)
}

// Step 1d: Create webauthn_challenges table.
//
// Stores server-issued WebAuthn challenges between
// `Generate{Authentication,Registration}Action` and
// `Verify{Authentication,Registration}Action`. Without this table the
// challenge was round-tripped through the client (`body.challenge`),
// so an attacker who captured an authentication response could replay
// it as long as they also had the challenge. The unique constraint
// on (user_id, purpose) enforces single-outstanding-challenge per
// user per purpose — issuing a new challenge invalidates any prior
// one. See stacksjs/stacks#1866 (formerly #1861 A-4 challenge half).
log.info('Ensuring webauthn_challenges table exists...')

try {
  if (isPostgres) {
    await db.unsafe(`
      CREATE TABLE IF NOT EXISTS webauthn_challenges (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        challenge TEXT NOT NULL,
        purpose VARCHAR(32) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
  } else if (isMysql) {
    await db.unsafe(`
      CREATE TABLE IF NOT EXISTS webauthn_challenges (
        id INTEGER AUTO_INCREMENT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        challenge TEXT NOT NULL,
        purpose VARCHAR(32) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
  } else {
    await db.unsafe(`
      CREATE TABLE IF NOT EXISTS webauthn_challenges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        challenge TEXT NOT NULL,
        purpose VARCHAR(32) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
  }

  // Unique index on (user_id, purpose) — application layer deletes
  // any prior row for the same user+purpose before inserting a fresh
  // challenge, so this constraint is belt-and-braces against
  // concurrent generate calls double-inserting.
  await db.unsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_webauthn_challenges_user_purpose ON webauthn_challenges(user_id, purpose)
  `)

  log.success('WebAuthn challenges table ready')
}
catch (error) {
  log.error('Failed to create webauthn_challenges table', error)
  process.exit(1)
}

// Step 2: Create personal access client
log.info('Creating personal access client...')

try {
  // Check if personal access client already exists using raw SQL
  const existing = await db.unsafe(`
    SELECT id FROM oauth_clients WHERE personal_access_client = ${boolTrue} LIMIT 1
  `)

  if ((existing as any[])?.length > 0) {
    console.log('\n✓ Personal access client already exists')
  }
  else {
    // The DB row stores a bcrypt hash; only the in-memory plaintext
    // is ever surfaced (and only at this single point of creation).
    // Mirror Laravel Passport's newer-versions behaviour — see
    // stacksjs/stacks#1861 M-1.
    const secret = randomBytes(40).toString('hex')
    const hashedSecret = await makeHash(secret, { algorithm: 'bcrypt' })

    if (isPostgres) {
      await db.unsafe(`
        INSERT INTO oauth_clients (name, secret, provider, redirect, personal_access_client, password_client, revoked, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, ['Personal Access Client', hashedSecret, 'local', 'http://localhost', true, false, false])
    } else {
      // MySQL and SQLite both use ? placeholders and numeric booleans
      await db.unsafe(`
        INSERT INTO oauth_clients (name, secret, provider, redirect, personal_access_client, password_client, revoked, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ${now})
      `, ['Personal Access Client', hashedSecret, 'local', 'http://localhost', 1, 0, 0])
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
console.log('  - Password reset flow')
console.log('\nNext steps:')
console.log('  1. Use createToken(userId, name, scopes) to generate tokens')
console.log('  2. Use refreshToken(token) to exchange refresh tokens')
console.log('  3. Use the "auth" middleware to protect routes')
console.log('  4. Use tokenCan(scope) for authorization checks')
console.log('  5. POST /password/forgot to request password reset')
console.log('  6. POST /password/reset to reset password with token\n')

process.exit(0)
