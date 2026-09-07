import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * No migration touches a table before another migration creates it.
 *
 * Migrations run in `readdirSync(dir).sort()` order, so the leading ordinal IS
 * the run order. `buddy make:migration` names its files `${Date.now()}-…`,
 * thirteen digits, which the package band's open-ended `>= 9_000_000_000` test
 * read as a package migration - so `nextMigrationNumber` skipped all fifty of
 * them and gave the next generated file ordinal 172.
 * `0000000172-alter-pledges-columns.sql` therefore ran before
 * `1785502251845-create-pledges-table.sql` created the table, and
 * `buddy migrate:fresh` died on `no such table: pledges` for every developer
 * and every fresh deploy.
 *
 * The ordinal is not checkable on its own - what matters is the order the
 * statements end up in - so this reads the corpus the way the runner does.
 */

const dir = join(import.meta.dir, '..', '..', '..', '..', '..', 'database', 'migrations')

/** SQL without its comments: an ALTER named in a comment is not an ALTER. */
function withoutComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
}

describe('the migration corpus', () => {
  const files = readdirSync(dir).filter(file => file.endsWith('.sql')).sort()
  const sql = new Map(files.map(file => [file, withoutComments(readFileSync(join(dir, file), 'utf8'))]))

  it('has migrations to check', () => {
    expect(files.length).toBeGreaterThan(100)
  })

  it('never touches a table before it is created', () => {
    /** First file that brings each table into existence. */
    const createdAt = new Map<string, number>()
    for (const [index, file] of files.entries()) {
      const body = sql.get(file)!
      for (const m of body.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?"?([A-Za-z_]\w*)"?/gi)) {
        if (!createdAt.has(m[1]))
          createdAt.set(m[1], index)
      }
      // A rebuild renames its scaffold into place, which is what creates the
      // table under its real name.
      for (const m of body.matchAll(/RENAME\s+TO\s+"?([A-Za-z_]\w*)"?/gi)) {
        if (!createdAt.has(m[1]))
          createdAt.set(m[1], index)
      }
    }

    const tooEarly: string[] = []
    for (const [index, file] of files.entries()) {
      for (const m of sql.get(file)!.matchAll(
        /(?:ALTER\s+TABLE\s+|CREATE(?:\s+UNIQUE)?\s+INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?"?[\w]+"?\s+ON\s+)"?([A-Za-z_]\w*)"?/gi,
      )) {
        const table = m[1]
        if (table.startsWith('_qb_tmp_'))
          continue

        const created = createdAt.get(table)
        if (created === undefined)
          tooEarly.push(`${file} touches "${table}", which no migration creates`)
        else if (created > index)
          tooEarly.push(`${file} touches "${table}" before ${files[created]} creates it`)
      }
    }

    expect([...new Set(tooEarly)].sort()).toEqual([])
  })
})
