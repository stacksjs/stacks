import { describe, expect, test } from 'bun:test'
import { AWARE_TIMESTAMP_CONVERSION_ENV, convertAwareTimestampsRequested, convertToNaiveSql, ensureUtcDatetimeColumns, formatAwareTimestampWarning, frameworkDatetimeTables, modifyToDatetimeSql } from '../src/datetime-columns'
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

    test('keeps CURRENT_TIMESTAMP unquoted - it is a function, not a literal', () => {
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

/**
 * What the database writes when nobody hands it a value.
 *
 * The column type was never the bug. This framework stores **naive UTC** - a
 * zoneless column holding UTC wall clock - because MySQL has nothing
 * equivalent to `timestamptz` and one convention across drivers is worth more
 * than the best type on each. Application writes already honour it: the ORM
 * persists `Date.toISOString()`.
 *
 * `DEFAULT CURRENT_TIMESTAMP` did not. On PostgreSQL and MySQL it is the
 * session's *local* wall clock, so a host set to anything but UTC wrote digits
 * that never happened in UTC and every reader was out by the offset. Found in
 * ReviewOS as "7 hours ago" on a row written seconds earlier.
 */
describe('the default that fills a timestamp in', () => {
  test('writes UTC on every dialect', () => {
    expect(sqlHelpers('postgres').utcNow).toBe(`(now() AT TIME ZONE 'utc')`)
    // Bracketed, because a column default is the one place MySQL will not take
    // a bare function other than CURRENT_TIMESTAMP.
    expect(sqlHelpers('mysql').utcNow).toBe('(UTC_TIMESTAMP)')

    // SQLite's CURRENT_TIMESTAMP is already UTC: the one dialect that was
    // right by accident.
    expect(sqlHelpers('sqlite').utcNow).toBe('CURRENT_TIMESTAMP')
  })

  test('and MySQL-wire dialects inherit it', () => {
    expect(sqlHelpers('singlestore').utcNow).toBe('(UTC_TIMESTAMP)')
    expect(sqlHelpers('vitess').utcNow).toBe('(UTC_TIMESTAMP)')
  })

  test('the framework tables use it rather than CURRENT_TIMESTAMP', () => {
    // The regression that matters: a table defined later with the old spelling
    // reintroduces the bug for its own rows only, which is the hardest kind to
    // notice.
    const sql = [
      rolesTableSql(sqlHelpers('postgres')),
      notificationsTableSql(sqlHelpers('postgres')),
    ].join('\n')

    expect(sql).toContain(`AT TIME ZONE 'utc'`)
    expect(sql).not.toContain('DEFAULT CURRENT_TIMESTAMP')
  })

  test('and the column type is deliberately still naive', () => {
    // Changing this to `timestamptz` was tried and reverted: it contradicts the
    // cross-driver convention above, and it broke five tests that exist to
    // state it.
    expect(sqlHelpers('postgres').datetime).toBe('TIMESTAMP')
  })
})

/**
 * The Postgres mirror of the same failure (stacksjs/stacks#2902).
 *
 * The framework writes a naive UTC literal, and Postgres interprets one
 * written into a `timestamptz` column in the session timezone, so every value
 * in such a column is shifted by that offset. Measured: with the session zone
 * at `Asia/Manila`, `2026-10-14T12:00:00.000` read back as
 * `2026-10-14T04:00:00.000Z`, and that was enough for token issuance to fail
 * with `Failed to persist the requested access token` under `TZ=UTC` - the
 * read-back check compares the stored expiry against the instant it asked for,
 * and the two genuinely differ.
 *
 * Reported rather than altered by default, because the repair is DDL on a
 * column that may be large and on a table the application is serving.
 */
describe('an aware timestamp column on Postgres', () => {
  const column = { table: 'oauth_access_tokens', column: 'expires_at' }

  describe('the conversion flag', () => {
    test('is off unless it is set to 1 or true', () => {
      expect(convertAwareTimestampsRequested({})).toBe(false)
      expect(convertAwareTimestampsRequested({ [AWARE_TIMESTAMP_CONVERSION_ENV]: '' })).toBe(false)
      expect(convertAwareTimestampsRequested({ [AWARE_TIMESTAMP_CONVERSION_ENV]: '0' })).toBe(false)
      expect(convertAwareTimestampsRequested({ [AWARE_TIMESTAMP_CONVERSION_ENV]: 'false' })).toBe(false)
      expect(convertAwareTimestampsRequested({ [AWARE_TIMESTAMP_CONVERSION_ENV]: 'yes' })).toBe(false)
    })

    test('is on for either spelling, whatever the case and spacing', () => {
      expect(convertAwareTimestampsRequested({ [AWARE_TIMESTAMP_CONVERSION_ENV]: '1' })).toBe(true)
      expect(convertAwareTimestampsRequested({ [AWARE_TIMESTAMP_CONVERSION_ENV]: 'true' })).toBe(true)
      expect(convertAwareTimestampsRequested({ [AWARE_TIMESTAMP_CONVERSION_ENV]: ' TRUE ' })).toBe(true)
    })
  })

  describe('the ALTER it builds', () => {
    test('casts through the session timezone, recovering what was written', () => {
      // `::timestamp` from `timestamptz` reads the instant through the session
      // zone - the same interpretation applied when the naive literal was
      // written - so the value that lands is the literal the app wrote.
      expect(convertToNaiveSql(column))
        .toBe('ALTER TABLE "oauth_access_tokens" ALTER COLUMN "expires_at" TYPE timestamp USING "expires_at"::timestamp')
    })

    test('refuses an identifier it cannot vouch for', () => {
      // `information_schema` is the source, but the names are spliced into DDL,
      // which takes no placeholder.
      expect(() => convertToNaiveSql({ table: 'users"; DROP TABLE users; --', column: 'expires_at' })).toThrow('unsafe identifier')
      expect(() => convertToNaiveSql({ table: 'users', column: 'expires_at, x int' })).toThrow('unsafe identifier')
    })
  })

  describe('what the operator is told', () => {
    const report = formatAwareTimestampWarning([column, { table: 'sessions', column: 'created_at' }])

    test('names every column, the cause and the symptom', () => {
      expect(report).toContain('oauth_access_tokens.expires_at')
      expect(report).toContain('sessions.created_at')
      expect(report).toContain('session')
      expect(report).toContain('#2902')
    })

    test('gives both ways out: the flag and the statement', () => {
      expect(report).toContain(`${AWARE_TIMESTAMP_CONVERSION_ENV}=1`)
      expect(report).toContain(convertToNaiveSql(column))
    })

    test('does not print a hundred columns at an operator', () => {
      const many = Array.from({ length: 12 }, (_, index) => ({ table: `t${index}`, column: 'created_at' }))
      const long = formatAwareTimestampWarning(many)

      expect(long).toContain('t0.created_at')
      expect(long).toContain('and 7 more')
      expect(long).not.toContain('t11.created_at')
    })
  })
})
