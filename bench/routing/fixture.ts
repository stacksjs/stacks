/**
 * The SQLite fixture the `db-roundtrip` scenario reads.
 *
 * Built by the runner into `bench/routing/.tmp/`, never into the project's own
 * `database/stacks.sqlite`: a benchmark that writes to the development database
 * is a benchmark nobody runs twice.
 *
 * Both sides read the same file. Stacks reaches it through its own query
 * builder (with `DB_DATABASE_PATH` pointed here); the other servers open it
 * with `bun:sqlite` directly, because that is their idiomatic path — none of
 * them ships an ORM. That asymmetry is deliberate and is stated in the README
 * rather than hidden behind a per-framework adapter that would make the
 * comparison look tidier than it is.
 */

import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export const FIXTURE_ROWS = 1000

export function createFixture(file: string): void {
  mkdirSync(dirname(file), { recursive: true })

  const db = new Database(file, { create: true })
  try {
    db.exec('PRAGMA journal_mode = WAL')
    db.exec('DROP TABLE IF EXISTS bench_items')
    db.exec('CREATE TABLE bench_items (id INTEGER PRIMARY KEY, name TEXT NOT NULL)')

    const insert = db.prepare('INSERT INTO bench_items (id, name) VALUES (?, ?)')
    const seed = db.transaction((count: number) => {
      for (let i = 1; i <= count; i++) insert.run(i, `item-${i}`)
    })
    seed(FIXTURE_ROWS)
  }
  finally {
    db.close()
  }
}
