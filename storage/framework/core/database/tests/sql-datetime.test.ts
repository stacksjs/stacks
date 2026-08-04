import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import { parseSqlDateTime, sqlDateTime, sqlDateTimeLiteral } from '../src/sql-helpers'

/**
 * The framework's canonical datetime format.
 *
 * Two defects motivated it, both found by running real engines:
 *
 * 1. Every writer sent `new Date().toISOString()` into TIMESTAMP columns, and
 *    MySQL rejects the trailing `Z` outright — so `notify(..., ['database'])`,
 *    token issuance and session creation all threw on MySQL.
 * 2. Those app-written values were compared against the DATABASE clock
 *    (`datetime('now')` / `NOW()`), which renders space-separated. On SQLite
 *    these columns hold text and `'T' > ' '`, so `expires_at > datetime('now')`
 *    was true for any same-day row no matter how long ago it expired.
 */

const INSTANT = new Date('2026-08-04T01:52:47.417Z')

describe('sqlDateTime — the write format', () => {
  test('is ISO without the trailing Z', () => {
    expect(sqlDateTime(INSTANT)).toBe('2026-08-04T01:52:47.417')
  })

  test('defaults to now', () => {
    const before = Date.now()
    const parsed = parseSqlDateTime(sqlDateTime())!
    expect(parsed.getTime()).toBeGreaterThanOrEqual(before - 1000)
    expect(parsed.getTime()).toBeLessThanOrEqual(Date.now() + 1000)
  })

  test('keeps the T, because a space would break ordering against stored ISO rows', () => {
    // SQLite holds these as text. ' ' (0x20) sorts before 'T' (0x54), so a
    // space-separated value would sort before every row already written in ISO.
    const value = sqlDateTime(INSTANT)
    expect(value).toContain('T')
    expect(value).not.toContain(' ')
  })

  test('sorts correctly against rows written in the old Z format', () => {
    const older = new Date('2026-08-04T00:00:00.000Z').toISOString() // legacy row
    const newer = sqlDateTime(new Date('2026-08-04T02:00:00.000Z'))
    expect(older < newer).toBe(true)
  })

  test('the literal form is quoted', () => {
    expect(sqlDateTimeLiteral(INSTANT)).toBe(`'2026-08-04T01:52:47.417'`)
  })
})

describe('parseSqlDateTime — the read format', () => {
  test('reads the canonical format back as the same instant', () => {
    expect(parseSqlDateTime(sqlDateTime(INSTANT))!.getTime()).toBe(INSTANT.getTime())
  })

  test('treats an offset-less value as UTC, not local', () => {
    // This is the whole point: `new Date('2026-08-04T01:52:47.417')` is LOCAL
    // per the ES spec, so a bare parse shifts every expiry by the host offset.
    expect(parseSqlDateTime('2026-08-04T01:52:47.417')!.toISOString())
      .toBe('2026-08-04T01:52:47.417Z')
  })

  test('still reads legacy values that carry a Z', () => {
    expect(parseSqlDateTime('2026-08-04T01:52:47.417Z')!.getTime()).toBe(INSTANT.getTime())
  })

  test('reads the space-separated form the database clocks emit', () => {
    expect(parseSqlDateTime('2026-08-04 01:52:47')!.toISOString())
      .toBe('2026-08-04T01:52:47.000Z')
  })

  test('respects an explicit offset when one is present', () => {
    expect(parseSqlDateTime('2026-08-04T03:52:47.417+02:00')!.getTime()).toBe(INSTANT.getTime())
  })

  test('passes through the Date objects the MySQL driver returns', () => {
    expect(parseSqlDateTime(INSTANT)).toBe(INSTANT)
  })

  test('returns null for missing or unparseable input so callers fail closed', () => {
    for (const bad of [null, undefined, '', '   ', 'not-a-date', {}, Number.NaN])
      expect(parseSqlDateTime(bad)).toBeNull()
  })
})

describe('expiry comparison against the database clock', () => {
  test('the old pattern let an expired row through on SQLite', () => {
    // Regression guard: this is the bug, reproduced. `expires_at` was written
    // as ISO and compared against `datetime('now')`, which is space-separated.
    const db = new Database(':memory:')
    db.run(`CREATE TABLE t (id INTEGER PRIMARY KEY, expires_at TIMESTAMP)`)
    const anHourAgo = new Date(Date.now() - 3600_000).toISOString()
    db.run(`INSERT INTO t (expires_at) VALUES (?)`, [anHourAgo])

    const viaDbClock = db.query(
      `SELECT * FROM t WHERE expires_at IS NULL OR expires_at > datetime('now')`,
    ).all()
    expect(viaDbClock).toHaveLength(1) // <- expired, yet returned

    db.close()
  })

  test('comparing against sqlDateTime() excludes it', () => {
    const db = new Database(':memory:')
    db.run(`CREATE TABLE t (id INTEGER PRIMARY KEY, expires_at TIMESTAMP)`)
    db.run(`INSERT INTO t (expires_at) VALUES (?)`, [sqlDateTime(new Date(Date.now() - 3600_000))])

    const expired = db.query(
      `SELECT * FROM t WHERE expires_at IS NULL OR expires_at > ${sqlDateTimeLiteral()}`,
    ).all()
    expect(expired).toHaveLength(0)

    // and a live row is still returned
    db.run(`INSERT INTO t (expires_at) VALUES (?)`, [sqlDateTime(new Date(Date.now() + 3600_000))])
    const live = db.query(
      `SELECT * FROM t WHERE expires_at IS NULL OR expires_at > ${sqlDateTimeLiteral()}`,
    ).all()
    expect(live).toHaveLength(1)
    db.close()
  })

  test('the prune query now matches expired rows', () => {
    // The mirror of the same bug: `expires_at < datetime('now')` matched
    // nothing, so expired tokens were never swept.
    const db = new Database(':memory:')
    db.run(`CREATE TABLE t (id INTEGER PRIMARY KEY, expires_at TIMESTAMP)`)
    db.run(`INSERT INTO t (expires_at) VALUES (?)`, [sqlDateTime(new Date(Date.now() - 3600_000))])

    expect(db.query(`SELECT * FROM t WHERE expires_at < datetime('now')`).all()).toHaveLength(0)
    expect(db.query(`SELECT * FROM t WHERE expires_at < ${sqlDateTimeLiteral()}`).all()).toHaveLength(1)
    db.close()
  })

  test('a legacy row written with Z is still evaluated correctly', () => {
    const db = new Database(':memory:')
    db.run(`CREATE TABLE t (id INTEGER PRIMARY KEY, expires_at TIMESTAMP)`)
    db.run(`INSERT INTO t (expires_at) VALUES (?)`, [new Date(Date.now() - 3600_000).toISOString()])
    db.run(`INSERT INTO t (expires_at) VALUES (?)`, [new Date(Date.now() + 3600_000).toISOString()])

    const live = db.query(
      `SELECT * FROM t WHERE expires_at > ${sqlDateTimeLiteral()}`,
    ).all()
    expect(live).toHaveLength(1)
    db.close()
  })
})
