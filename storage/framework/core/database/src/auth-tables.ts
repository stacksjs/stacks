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

type SqlHelpers = ReturnType<typeof sqlHelpers>

function getDbDriver(): string {
  return envVars.DB_CONNECTION || 'sqlite'
}

/**
 * Defensive ALTER guaranteeing `users.email_verified_at` — the column
 * `verifyEmail()` writes and the `verified` middleware reads, but which
 * no generated users migration ever creates (stacksjs/stacks#1948).
 * Pure builder so tests can assert per-dialect DDL without a live DB.
 */
export function usersEmailVerifiedAtSql(sql: SqlHelpers): string {
  return `ALTER TABLE users ADD COLUMN email_verified_at ${sql.nullableTimestamp}`
}

/**
 * Defensive ALTER guaranteeing `users.password_changed_at` — the column
 * `resetPassword()` stamps and the token-validation paths read to bind a
 * token's validity to the user's credential state (stacksjs/stacks#1957,
 * a #1947 follow-up). No generated users migration creates it, so the
 * same pure-builder + try/catch-swallow pattern as
 * {@link usersEmailVerifiedAtSql} guarantees it from both schema paths.
 */
export function usersPasswordChangedAtSql(sql: SqlHelpers): string {
  return `ALTER TABLE users ADD COLUMN password_changed_at ${sql.nullableTimestamp}`
}

/**
 * Defensive ALTER guaranteeing `users.two_factor_secret` and
 * `users.two_factor_enabled` — storage/framework/core/auth/src/
 * authenticator.ts's TOTP helpers (generateTwoFactorSecret,
 * verifyTwoFactorCode) have existed since early in the framework's
 * history, but nothing ever created the columns a caller would persist
 * them to, or the `passkeys`/`webauthn_challenges` tables
 * storage/framework/core/auth/src/passkey.ts's WebAuthn helpers
 * unconditionally query against — every passkey/2FA call site was
 * dead code pointed at tables that never existed on any install,
 * `buddy new` included. Same defensive ALTER + swallow pattern as
 * {@link usersEmailVerifiedAtSql}.
 */
export function usersTwoFactorColumnsSql(sql: SqlHelpers): string[] {
  return [
    `ALTER TABLE users ADD COLUMN two_factor_secret VARCHAR(255)`,
    `ALTER TABLE users ADD COLUMN two_factor_enabled BOOLEAN NOT NULL DEFAULT ${sql.boolFalse}`,
  ]
}

/**
 * Defensive ALTER guaranteeing `users.stripe_id` — the `billable`
 * model trait's methods (createStripeCustomer/createOrGetStripeUser,
 * used by `user.checkout(...)`) read and write this column
 * unconditionally, but it's runtime-mixin-only (createBillableMethods
 * in orm/define-model.ts, gated behind `traits.billable`): nothing in
 * migration codegen ever creates the column itself, on any model, with
 * or without the trait enabled. Every Stripe checkout call site was
 * dead code pointed at a column that never existed, `buddy new`
 * included — same shape as the passkeys/two_factor gap above (see
 * stacksjs/status#1 Phase 9).
 */
export function usersStripeIdSql(): string {
  return `ALTER TABLE users ADD COLUMN stripe_id VARCHAR(255)`
}

/**
 * Runs every `users` guarantee-column ALTER (email_verified_at,
 * password_changed_at, two_factor_secret, two_factor_enabled,
 * stripe_id), each independently try/catch-swallowed so one
 * already-existing column (or a not-yet-existing `users` table) never
 * skips the others. Exported so `buddy migrate`/`migrate:fresh` can
 * call it a second time after the numbered model migrations run — see
 * the call site in {@link migrateAuthTables} for why a single call
 * isn't enough.
 */
export async function ensureUsersAuthColumns(sql: SqlHelpers, options: { verbose?: boolean } = {}): Promise<void> {
  const alters = [
    usersEmailVerifiedAtSql(sql),
    usersPasswordChangedAtSql(sql),
    ...usersTwoFactorColumnsSql(sql),
    usersStripeIdSql(),
  ]
  for (const alterSql of alters) {
    try {
      await db.unsafe(alterSql).execute()
    }
    catch {
      // Column already exists (or users table missing) — safe to ignore
      if (options.verbose) log.debug(`[auth-tables] Skipped (already applied or users missing): ${alterSql}`)
    }
  }

  try {
    await db.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_stripe_id ON users(stripe_id)`).execute()
  }
  catch {
    if (options.verbose) log.debug(`[auth-tables] Skipped users.stripe_id unique index (already applied or users missing)`)
  }
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

    // `passkeys` — id is the WebAuthn credential ID itself (a
    // server-opaque string the authenticator generates), not an
    // auto-increment integer, so this table doesn't use `pkColumn`.
    // Schema matches storage/framework/core/auth/src/passkey.ts's
    // PasskeyAttribute interface exactly — that file has been querying
    // this table's columns since it was written, with nothing here to
    // create them until now.
    if (options.verbose) log.info('Creating passkeys table...')
    await db.unsafe(`
      CREATE TABLE IF NOT EXISTS passkeys (
        id VARCHAR(255) PRIMARY KEY,
        cred_public_key TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        webauthn_user_id VARCHAR(255) NOT NULL,
        counter INTEGER NOT NULL DEFAULT 0,
        credential_type VARCHAR(50),
        device_type VARCHAR(50),
        backup_eligible BOOLEAN NOT NULL DEFAULT ${sql.boolFalse},
        backup_status BOOLEAN NOT NULL DEFAULT ${sql.boolFalse},
        transports TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_used_at ${nullableTimestamp}
      )
    `).execute()

    try {
      await db.unsafe(`
        CREATE INDEX IF NOT EXISTS idx_passkeys_user_id ON passkeys(user_id)
      `).execute()
    }
    catch {
      // Index might already exist
    }

    // `webauthn_challenges` — server-issued nonces for the WebAuthn
    // registration/authentication handshake (stacksjs/stacks#1866).
    // The unique (user_id, purpose) index is what makes
    // storeWebAuthnChallenge's delete-then-insert in passkey.ts safe as
    // a single-outstanding-challenge-per-purpose upsert.
    if (options.verbose) log.info('Creating webauthn_challenges table...')
    await db.unsafe(`
      CREATE TABLE IF NOT EXISTS webauthn_challenges (
        ${pkColumn},
        user_id INTEGER NOT NULL,
        challenge TEXT NOT NULL,
        purpose VARCHAR(20) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).execute()

    try {
      await db.unsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_webauthn_challenges_user_purpose ON webauthn_challenges(user_id, purpose)
      `).execute()
    }
    catch {
      // Index might already exist
    }

    // `two_factor_challenges` — server-issued, single-use pending-login
    // tokens for the TOTP second factor (stacksjs/status#1 Phase 9).
    // LoginAction creates a row here once the password has verified but
    // before minting real access tokens; VerifyTwoFactorLoginAction
    // consumes it (delete-on-read, like webauthn_challenges) after
    // checking the submitted TOTP code, then mints the token pack via
    // Auth.loginUsingId(). Rows expire quickly (see two-factor.ts) since
    // possessing a valid challenge_token plus the correct 6-digit code
    // is what completes login.
    if (options.verbose) log.info('Creating two_factor_challenges table...')
    await db.unsafe(`
      CREATE TABLE IF NOT EXISTS two_factor_challenges (
        id VARCHAR(255) PRIMARY KEY,
        user_id INTEGER NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).execute()

    try {
      await db.unsafe(`
        CREATE INDEX IF NOT EXISTS idx_two_factor_challenges_user_id ON two_factor_challenges(user_id)
      `).execute()
    }
    catch {
      // Index might already exist
    }

    // `two_factor_pending_secrets` — a freshly generated TOTP secret,
    // stashed server-side while the user scans/enters it into their
    // authenticator app. EnableTwoFactorAction verifies the submitted
    // code against this stashed value, never a client-supplied secret
    // (stacksjs/status#1 Phase 9) — same rationale as
    // two_factor_challenges/webauthn_challenges above. One row per
    // user; a fresh generate replaces any unconfirmed prior attempt.
    if (options.verbose) log.info('Creating two_factor_pending_secrets table...')
    await db.unsafe(`
      CREATE TABLE IF NOT EXISTS two_factor_pending_secrets (
        user_id INTEGER PRIMARY KEY,
        secret VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).execute()

    // users.email_verified_at / password_changed_at / two_factor_* — see
    // {@link ensureUsersAuthColumns}. This first attempt runs before
    // `users` exists on a `buddy migrate`/`migrate:fresh` (the numbered
    // model migration that creates it hasn't run yet at this point in
    // the command — auth tables intentionally migrate first, since
    // other numbered migrations reference oauth_access_tokens), so on a
    // fresh install every ALTER here fails harmlessly and is swallowed.
    // The caller (buddy migrate/migrate:fresh) calls
    // ensureUsersAuthColumns() a second time after model migrations
    // complete, which is what actually lands these columns on a fresh
    // install — see stacksjs/status#1 Phase 9 for how this gap was found
    // (empirically: `users` was missing all four guarantee columns on a
    // fresh `buddy migrate` despite this function's own prior claim that
    // "users exists by now").
    if (options.verbose) log.info('Ensuring users auth columns exist (users may not exist yet on a fresh install — see ensureUsersAuthColumns)...')
    await ensureUsersAuthColumns(sql, options)

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
