import { describe, expect, test } from 'bun:test'
import { utcDefaultSql, utcDefaultTables } from '../src/utc-defaults'
import { frameworkDatetimeTables } from '../src/datetime-columns'
import { sqlHelpers } from '../src/sql-helpers'

/**
 * The framework's own tables are created with `CREATE TABLE IF NOT EXISTS`, so
 * changing their DDL fixes new installs and leaves every existing database
 * exactly as it was - for ever, silently, on every migrate. That is how a real
 * instance came to have eleven columns defaulting to the database session's
 * local clock while the other hundred and fifteen defaulted to UTC, all of them
 * `timestamp` without a zone, none of them complaining.
 *
 * The columns were `password_resets`, `email_verifications`,
 * `two_factor_challenges`, `two_factor_pending_secrets`, `webauthn_challenges`,
 * the five RBAC tables and the migration ledger: the expiry windows of every
 * short-lived credential the framework issues.
 */

describe('the UTC default repair', () => {
  test('pins to the expression each engine actually takes', () => {
    // Postgres and MySQL 8.0.13+ share the `ALTER COLUMN ... SET DEFAULT`
    // spelling; only the expression differs.
    expect(utcDefaultSql({ table: 'password_resets', column: 'created_at' }, 'postgres'))
      .toBe(`ALTER TABLE password_resets ALTER COLUMN created_at SET DEFAULT (now() AT TIME ZONE 'utc')`)

    expect(utcDefaultSql({ table: 'password_resets', column: 'created_at' }, 'mysql'))
      .toBe('ALTER TABLE password_resets ALTER COLUMN created_at SET DEFAULT (UTC_TIMESTAMP)')
  })

  test('and the expression is the one the table creators use', () => {
    // The repair and the CREATE have to agree, or a repaired database differs
    // from a fresh one - which is the bug this file is about, one level up.
    for (const driver of ['postgres', 'mysql'] as const) {
      expect(utcDefaultSql({ table: 'roles', column: 'created_at' }, driver))
        .toContain(sqlHelpers(driver).utcNow)
    }
  })

  test('refuses an identifier it cannot splice safely', () => {
    // These come from `information_schema` rather than from a caller, so this
    // is a backstop rather than the main defence - but DDL cannot take a
    // placeholder, so the check has to exist somewhere.
    expect(() => utcDefaultSql({ table: 'roles; DROP TABLE users', column: 'created_at' }, 'postgres'))
      .toThrow('unsafe identifier')

    expect(() => utcDefaultSql({ table: 'roles', column: 'created_at, x' }, 'postgres'))
      .toThrow('unsafe identifier')
  })

  test('covers every table the datetime repair covers, plus the ledger', () => {
    /*
     * One list rather than two. These two repairs are the same bug in different
     * clothes - a column's type, and a column's default - so a framework table
     * added to one has to be covered by the other, and deriving it is the only
     * way that stays true.
     */
    const tables = utcDefaultTables()

    for (const table of frameworkDatetimeTables())
      expect(tables).toContain(table)

    // The ledger is created by the migration runner rather than by a table
    // creator, and it had the same bare default.
    expect(tables).toContain('migrations')
  })

  test('names the auth and RBAC tables whose defaults were actually wrong', () => {
    const tables = utcDefaultTables()

    for (const table of [
      'password_resets',
      'email_verifications',
      'two_factor_challenges',
      'two_factor_pending_secrets',
      'webauthn_challenges',
      'roles',
      'permissions',
      'user_roles',
      'user_permissions',
      'role_permissions',
    ]) {
      expect(tables).toContain(table)
    }
  })
})
