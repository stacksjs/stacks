import { describe, expect, test } from 'bun:test'
import { ensureUtcDatetimeColumns, frameworkDatetimeTables, modifyToDatetimeSql } from '../src/datetime-columns'
import { notificationsTableSql } from '../src/notification-tables'
import { rolesTableSql } from '../src/rbac-tables'
import { sqlHelpers } from '../src/sql-helpers'

/**
 * MySQL `TIMESTAMP` columns are converted from the session timezone on write
 * and back to it on read, so the same row read from two sessions yields two
 * different instants — measured at a 12.5 hour gap between a `-07:00` and a
 * `+05:30` session. The framework stores naive UTC, and `DATETIME` is MySQL's
 * naive type.
 *
 * Pinning the session timezone was the alternative and is not reachable:
 * Bun's `SQL` is a pool with no connection-string parameter, option, or
 * connect hook for it, so a `SET time_zone` reached 1 of 8 connections.
 */

describe('the datetime column type', () => {
  test('is DATETIME on MySQL and TIMESTAMP everywhere else', () => {
    expect(sqlHelpers('mysql').datetime).toBe('DATETIME')
    expect(sqlHelpers('sqlite').datetime).toBe('TIMESTAMP')
    expect(sqlHelpers('postgres').datetime).toBe('TIMESTAMP')
  })

  test('MySQL-wire dialects inherit DATETIME', () => {
    // SingleStore and Vitess speak MySQL's wire protocol and share its
    // TIMESTAMP semantics, so they need the same naive type.
    expect(sqlHelpers('singlestore').datetime).toBe('DATETIME')
    expect(sqlHelpers('vitess').datetime).toBe('DATETIME')
  })

  test('nullable datetimes keep MySQL\'s explicit NULL modifier', () => {
    // Without it MySQL makes the column implicitly NOT NULL with a
    // zero-date default, which trips the strict-mode insert path.
    expect(sqlHelpers('mysql').nullableTimestamp).toBe('DATETIME NULL')
    expect(sqlHelpers('sqlite').nullableTimestamp).toBe('TIMESTAMP')
    expect(sqlHelpers('postgres').nullableTimestamp).toBe('TIMESTAMP')
  })

  test('the framework table creators emit it', () => {
    expect(notificationsTableSql(sqlHelpers('mysql'))).toContain('created_at DATETIME')
    expect(rolesTableSql(sqlHelpers('mysql'))).toContain('created_at DATETIME')
    // and nothing changes for the other two engines
    expect(notificationsTableSql(sqlHelpers('sqlite'))).toContain('created_at TIMESTAMP')
    expect(notificationsTableSql(sqlHelpers('postgres'))).toContain('created_at TIMESTAMP')
  })

  test('no framework table still declares a bare TIMESTAMP on MySQL', () => {
    const mysql = sqlHelpers('mysql')
    for (const ddl of [notificationsTableSql(mysql), rolesTableSql(mysql)])
      expect(ddl).not.toMatch(/\bTIMESTAMP\b/)
  })
})

describe('the legacy-column guarantee', () => {
  test('exports the migrator and its table list', () => {
    expect(typeof ensureUtcDatetimeColumns).toBe('function')
    expect(frameworkDatetimeTables().length).toBeGreaterThan(0)
  })

  test('covers the tables the framework creators actually make', () => {
    const listed = frameworkDatetimeTables()
    for (const table of [
      'notifications', 'notification_preferences', 'notification_deliveries',
      'roles', 'permissions', 'user_roles', 'user_permissions', 'role_permissions',
      'passkeys', 'password_resets', 'oauth_clients', 'oauth_access_tokens',
      'oauth_refresh_tokens', 'two_factor_challenges', 'two_factor_pending_secrets',
      'webauthn_challenges',
    ]) expect(listed).toContain(table)
  })

  test('lists no duplicates', () => {
    const listed = frameworkDatetimeTables()
    expect(listed).toHaveLength(new Set(listed).size)
  })

  describe('the MODIFY it builds', () => {
    const base = { table: 'notifications', column: 'created_at', nullable: true, columnDefault: null, extra: '' }

    test('converts to DATETIME preserving nullability', () => {
      expect(modifyToDatetimeSql(base))
        .toBe('ALTER TABLE `notifications` MODIFY `created_at` DATETIME NULL')
      expect(modifyToDatetimeSql({ ...base, nullable: false }))
        .toBe('ALTER TABLE `notifications` MODIFY `created_at` DATETIME NOT NULL')
    })

    test('keeps CURRENT_TIMESTAMP unquoted — it is a function, not a literal', () => {
      expect(modifyToDatetimeSql({ ...base, columnDefault: 'CURRENT_TIMESTAMP' }))
        .toContain('DEFAULT CURRENT_TIMESTAMP')
      expect(modifyToDatetimeSql({ ...base, columnDefault: 'CURRENT_TIMESTAMP' }))
        .not.toContain(`'CURRENT_TIMESTAMP'`)
    })

    test('quotes a literal default and escapes quotes in it', () => {
      expect(modifyToDatetimeSql({ ...base, columnDefault: '2026-01-01 00:00:00' }))
        .toContain(`DEFAULT '2026-01-01 00:00:00'`)
      expect(modifyToDatetimeSql({ ...base, columnDefault: "it's" }))
        .toContain(`DEFAULT 'it''s'`)
    })

    test('carries ON UPDATE CURRENT_TIMESTAMP across', () => {
      expect(modifyToDatetimeSql({ ...base, extra: 'on update CURRENT_TIMESTAMP' }))
        .toContain('ON UPDATE CURRENT_TIMESTAMP')
      expect(modifyToDatetimeSql(base)).not.toContain('ON UPDATE')
    })

    test('refuses an unsafe identifier rather than splicing it into DDL', () => {
      // Names come from information_schema, but DDL cannot take a placeholder,
      // so they are re-validated before interpolation.
      expect(() => modifyToDatetimeSql({ ...base, table: 'notifications`; DROP TABLE users; --' })).toThrow()
      expect(() => modifyToDatetimeSql({ ...base, column: 'created_at` , ADD x INT' })).toThrow()
    })
  })

  test('is a no-op on dialects that do not convert on read', () => {
    // SQLite stores text and Postgres' `timestamp without time zone` is
    // already naive, so there is nothing to repair there.
    const original = process.env.DB_CONNECTION
    try {
      for (const driver of ['sqlite', 'postgres']) {
        process.env.DB_CONNECTION = driver
        expect(ensureUtcDatetimeColumns()).resolves.toEqual({ success: true, converted: 0 })
      }
    }
    finally {
      if (original === undefined) delete process.env.DB_CONNECTION
      else process.env.DB_CONNECTION = original
    }
  })
})
