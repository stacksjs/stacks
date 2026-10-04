/**
 * A table rebuild may only copy columns its source table actually has.
 *
 * SQLite's table-rebuild recipe copies rows with
 * `INSERT INTO "_qb_tmp_t" (cols) SELECT cols FROM "t"`. `0000000134-auto-misc`
 * listed `"uuid"` on both sides for 35 tables whose CREATE never had a `uuid`
 * column - the snapshot believed it did. On a local SQLite file that is not an
 * error: SQLite's legacy double-quoted-string rule turns the unknown `"uuid"`
 * into the string literal 'uuid', so every copied row got `uuid = 'uuid'` and
 * the unique index created next failed as soon as a table held two rows. Only
 * an empty database, which is all CI ever migrates, got through.
 *
 * libSQL (Turso) disables that rule and rejects the statement outright -
 * `no such column: uuid` - which is how this was found (stacksjs/stacks#977).
 *
 * The check replays the committed corpus into an in-memory database and, before
 * each rebuild copy, asks the source table for its columns. A source table the
 * corpus never creates (the framework creates some tables outside it) is not
 * judged here.
 */

import { Database } from 'bun:sqlite'
import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sqlStatementsOf } from '../src/sql-statements'

const CORPUS = join(import.meta.dir, '../../../../../database/migrations')
const REBUILD_COPY = /^INSERT\s+INTO\s+"(_qb_tmp_\w+)"\s*\(([^)]*)\)\s*SELECT\s+(.+?)\s+FROM\s+"(\w+)"\s*;?\s*$/is

function columnsOf(db: Database, table: string): Set<string> {
  return new Set((db.query(`PRAGMA table_info("${table.replaceAll('"', '""')}")`).all() as Array<{ name: string }>).map(column => column.name))
}

describe('committed migration corpus', () => {
  it('never copies a column a rebuilt table does not have', () => {
    const db = new Database(':memory:')
    db.exec('PRAGMA foreign_keys = OFF')
    const offences: string[] = []

    try {
      for (const file of readdirSync(CORPUS).filter(f => f.endsWith('.sql')).sort()) {
        for (const statement of sqlStatementsOf(readFileSync(join(CORPUS, file), 'utf8'))) {
          const copy = REBUILD_COPY.exec(statement.trim())
          if (copy) {
            const source = copy[4]!
            const present = columnsOf(db, source)
            if (present.size > 0) {
              const absent = copy[3]!.split(',').map(c => c.trim().replace(/^"|"$/g, '')).filter(c => !present.has(c))
              if (absent.length > 0)
                offences.push(`${file}: rebuild of "${source}" copies ${absent.map(c => `"${c}"`).join(', ')}, which "${source}" does not have`)
            }
          }
          try {
            db.exec(statement)
          }
          catch {
            // Statements the real runner gates out or the framework satisfies
            // elsewhere (feature tables, catch-up renames) fail here too. They
            // are not what this test is about.
          }
        }
      }
    }
    finally {
      db.close()
    }

    expect(offences).toEqual([])
  })
})
