import { describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { usersStripeIdSql } from '../src/auth-tables'

/**
 * stacksjs/status#1 Phase 9 — the `billable` model trait's methods
 * (createStripeCustomer/createOrGetStripeUser, used by
 * `user.checkout(...)`) read and write `users.stripe_id`
 * unconditionally, but nothing in migration codegen ever creates the
 * column — not even when the trait is enabled. Every Stripe checkout
 * call site (storage/framework/defaults/app/Actions/Payment/*) was
 * dead code pointed at a column that never existed, `buddy new`
 * included, the same shape as the passkeys/two_factor gap covered by
 * email-verified-at.test.ts / two-factor.test.ts.
 */

describe('users.stripe_id defensive ALTER (stacksjs/status#1 Phase 9)', () => {
  test('DDL is dialect-independent (VARCHAR is valid on sqlite/postgres/mysql alike)', () => {
    expect(usersStripeIdSql()).toBe('ALTER TABLE users ADD COLUMN stripe_id VARCHAR(255)')
  })

  describe('behavioral (bun:sqlite, committed users schema)', () => {
    const MIGRATION = resolve(__dirname, '../../../../..', 'database/migrations/0000000044-create-users-table.sql')

    function freshUsersDb(): Database {
      const db = new Database(':memory:')
      db.exec(readFileSync(MIGRATION, 'utf8'))
      db.run(`INSERT INTO users (name, email, password) VALUES ('U', 'u@example.com', 'hash')`)
      return db
    }

    test('pre-fix failure mode: persisting a Stripe customer id throws "no such column"', () => {
      const db = freshUsersDb()
      expect(() => db.run(`UPDATE users SET stripe_id = 'cus_123' WHERE id = 1`))
        .toThrow(/no such column/i)
      db.close()
    })

    test('post-ALTER the same UPDATE succeeds and the value reads back', () => {
      const db = freshUsersDb()
      db.exec(usersStripeIdSql())
      db.run(`UPDATE users SET stripe_id = 'cus_123' WHERE id = 1`)
      const row = db.query('SELECT stripe_id FROM users WHERE id = 1').get() as any
      expect(row.stripe_id).toBe('cus_123')
      db.close()
    })

    test('re-running the ALTER throws duplicate-column — the swallow both call sites rely on', () => {
      const db = freshUsersDb()
      const ddl = usersStripeIdSql()
      db.exec(ddl)
      expect(() => db.exec(ddl)).toThrow(/duplicate column/i)
      db.close()
    })
  })

  describe('wiring', () => {
    test('ensureUsersAuthColumns includes the stripe_id ALTER and a guarded unique index', () => {
      const source = readFileSync(resolve(__dirname, '../src/auth-tables.ts'), 'utf-8')
      const fnIdx = source.indexOf('export async function ensureUsersAuthColumns')
      expect(fnIdx).toBeGreaterThan(-1)
      const body = source.slice(fnIdx, source.indexOf('export async function migrateAuthTables'))
      expect(body).toMatch(/usersStripeIdSql\(\)/)
      expect(body).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS idx_users_stripe_id ON users\(stripe_id\)/)
    })

    // The framework default deliberately leaves `billable` off — not
    // every app bills through the User model. Apps that want
    // checkout()/createStripeUser()/etc. publish their own override
    // (`buddy publish:model User`) and enable the trait there — see
    // ~/Code/status's app/Models/User.ts for a real example. The
    // schema-side guarantee (stripe_id column + index, asserted above)
    // applies regardless of whether any given app enables the trait.
    test('User model default leaves the billable trait off', () => {
      const source = readFileSync(resolve(__dirname, '../../../defaults/app/Models/User.ts'), 'utf-8')
      expect(source).toMatch(/billable:\s*false/)
    })
  })
})
