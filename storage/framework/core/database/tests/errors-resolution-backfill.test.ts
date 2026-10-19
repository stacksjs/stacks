import { Database } from 'bun:sqlite'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'

/**
 * stacksjs/stacks#2923 — `errors.status` carried both the HTTP status and the
 * triage state, and writing either destroyed the other. The split moves triage
 * into `resolution`, and this runs the two migrations that do it against a
 * real SQLite so the lossy half is a measured result rather than a claim.
 */

const MIGRATIONS = join(import.meta.dir, '../../../../../database/migrations')

function migration(name: string): string {
  return readFileSync(join(MIGRATIONS, name), 'utf8')
}

function statements(sql: string): string[] {
  return sql
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map(s => s.trim())
    .filter(Boolean)
}

/** The errors table as it stood before the split, seeded with pre-split rows. */
function seeded(): Database {
  const db = new Database(':memory:')
  db.run(`CREATE TABLE "errors" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "type" TEXT, "message" TEXT, "stack" TEXT,
    "status" REAL, "additional_info" TEXT,
    "created_at" TEXT not null default CURRENT_TIMESTAMP, "updated_at" TEXT
  )`)
  const insert = db.prepare('INSERT INTO errors (id, type, message, status) VALUES (?, ?, ?, ?)')
  insert.run(1, 'TypeError', 'resolved by someone', 1)
  insert.run(2, 'RangeError', 'ignored by someone', 2)
  insert.run(3, 'TypeError', 'explicitly unresolved', 0)
  insert.run(4, 'HttpError', 'never triaged, a real 500', 500)
  insert.run(5, 'HttpError', 'never triaged, a real 404', 404)
  insert.run(6, 'OddError', 'no status at all', null)
  return db
}

function migrate(db: Database): void {
  for (const name of ['1789486698563-alter-errors-columns.sql', '1789486698564-backfill-errors-resolution.sql'])
    for (const statement of statements(migration(name)))
      db.run(statement)
}

describe('errors.resolution backfill', () => {
  it('moves the triage values out of status', () => {
    const db = seeded()
    migrate(db)
    const rows = db.query('SELECT id, status, resolution FROM errors ORDER BY id').all() as Array<{ id: number, status: number | null, resolution: string }>

    expect(rows.map(r => [r.id, r.resolution])).toEqual([
      [1, 'resolved'],
      [2, 'ignored'],
      [3, 'unresolved'],
      [4, 'unresolved'],
      [5, 'unresolved'],
      [6, 'unresolved'],
    ])
    db.close()
  })

  it('keeps a real HTTP status, and clears the ones that were never one', () => {
    const db = seeded()
    migrate(db)
    const rows = db.query('SELECT id, status FROM errors ORDER BY id').all() as Array<{ id: number, status: number | null }>

    // 500 and 404 were never triaged, so they are genuine and survive.
    expect(rows[3]).toEqual({ id: 4, status: 500 })
    expect(rows[4]).toEqual({ id: 5, status: 404 })

    // 0, 1 and 2 were triage values wearing a status column. The HTTP status
    // they overwrote is gone, and leaving 1 there would keep asserting it was
    // a status. Cleared rather than kept.
    expect(rows[0]).toEqual({ id: 1, status: null })
    expect(rows[1]).toEqual({ id: 2, status: null })
    expect(rows[2]).toEqual({ id: 3, status: null })
    db.close()
  })

  it('refuses a resolution outside the three states', () => {
    const db = seeded()
    migrate(db)
    expect(() => db.run(`UPDATE errors SET resolution = 'wontfix' WHERE id = 1`)).toThrow()
    db.close()
  })

  it('defaults a newly inserted error to unresolved', () => {
    const db = seeded()
    migrate(db)
    db.run(`INSERT INTO errors (id, type, message, status) VALUES (7, 'NewError', 'fresh', 503)`)
    const row = db.query('SELECT status, resolution FROM errors WHERE id = 7').get() as { status: number, resolution: string }
    expect(row).toEqual({ status: 503, resolution: 'unresolved' })
    db.close()
  })
})
