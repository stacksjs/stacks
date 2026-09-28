/**
 * Unique indexes the migration corpus declares, and putting back the ones a
 * later table rebuild dropped.
 *
 * SQLite has no `ALTER TABLE ... ALTER COLUMN`, so the generator changes a
 * table by rebuilding it: create `_qb_tmp_<table>`, copy the rows, drop the
 * original, rename. `DROP TABLE` takes every index on the table with it, and
 * the rebuild re-creates only the indexes the MODEL declares, under the
 * generator's own names. An index some earlier migration created - a
 * hand-written one, or one under a name the generator does not use - is gone
 * once a later rebuild of that table runs.
 *
 * `preprocessSqliteMigrations` already noticed this, but only on the NEXT
 * migrate: it re-queues a unique-index file whose index is missing, the runner
 * replays it, and a third migrate finally comes back clean. A fresh database
 * therefore needed two migrates to reach its schema, and CI - which migrates
 * once - tested against a database without them. That was the shape of
 * `categorizable_models_owner_unique` (dropped by the rebuild in
 * `1789486698554-repair-categorizable-models-category-fk.sql`), of
 * `taggable_models_owner_unique` (dropped by `1785502251816-auto-misc.sql`),
 * and of the commerce indexes (payments, coupons, customers, gift cards,
 * manufacturers) in an app with commerce installed.
 *
 * {@link restoreDroppedUniqueIndexes} runs the same reconciliation AFTER the
 * batch, so one migrate converges on the schema the second one used to reach.
 * It covers corpora already committed in apps, because it reads what the files
 * declare rather than requiring any of them to change.
 *
 * The set is exactly what the re-queue treats as authoritative: files that
 * consist ONLY of `CREATE UNIQUE INDEX` statements. A unique index created
 * inside a larger migration is not put back, because nothing says the later
 * rebuild did not mean to remove it. Three things still mean "leave it gone",
 * and both passes honour them:
 *
 * - a later `DROP INDEX` of the same name,
 * - the table no longer existing,
 * - a column the index covers no longer existing (a rebuild that removed the
 *   column removed the index on purpose).
 */

import type { Database } from 'bun:sqlite'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sqlStatementsOf } from './sql-statements'

export interface DeclaredUniqueIndex {
  /** The migration file that declares it. */
  file: string
  name: string
  table: string
  /**
   * The plain columns it covers. An expression term is left out, so a missing
   * column can only ever make the index LESS likely to be restored.
   */
  columns: string[]
  /** The statement exactly as the file wrote it. */
  statement: string
}

const quoted = `["'\`]?(\\w+)["'\`]?`
const CREATE_UNIQUE_INDEX = new RegExp(`^\\s*CREATE\\s+UNIQUE\\s+INDEX\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${quoted}\\s+ON\\s+${quoted}\\s*\\(`, 'i')
const DROP_INDEX = new RegExp(`^\\s*DROP\\s+INDEX\\s+(?:IF\\s+EXISTS\\s+)?${quoted}`, 'i')
const PLAIN_COLUMN = new RegExp(`^${quoted}(?:\\s+COLLATE\\s+\\w+)?(?:\\s+(?:ASC|DESC))?$`, 'i')

/** The comma-separated terms of the parenthesised list that opens at `start`. */
function columnTerms(statement: string, start: number): string[] {
  const terms: string[] = []
  let depth = 0
  let current = ''
  for (let i = start; i < statement.length; i++) {
    const char = statement[i]!
    if (char === '(') {
      depth++
      if (depth === 1)
        continue
    }
    else if (char === ')') {
      depth--
      if (depth === 0) {
        terms.push(current.trim())
        return terms
      }
    }
    else if (char === ',' && depth === 1) {
      terms.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  return terms
}

/** Parse one `CREATE UNIQUE INDEX`, or `null` when the statement is anything else. */
export function parseUniqueIndex(statement: string, file: string): DeclaredUniqueIndex | null {
  const match = CREATE_UNIQUE_INDEX.exec(statement)
  if (!match?.[1] || !match[2])
    return null

  const columns = columnTerms(statement, match[0].length - 1)
    .map(term => PLAIN_COLUMN.exec(term)?.[1])
    .filter((column): column is string => Boolean(column))

  return { file, name: match[1], table: match[2], columns, statement }
}

/**
 * The unique indexes a file declares when that is ALL it does, else `null`.
 *
 * A file that mixes them with anything else is not a unique-index file: its
 * other statements decide what the file means, and replaying it is not safe.
 */
export function uniqueIndexOnlyFile(content: string, file: string): DeclaredUniqueIndex[] | null {
  const statements = sqlStatementsOf(content)
  if (statements.length === 0)
    return null

  const declared = statements.map(statement => parseUniqueIndex(statement, file))
  return declared.every((index): index is DeclaredUniqueIndex => index !== null) ? declared : null
}

/**
 * Every unique-index-only file in the corpus, keyed by file name, with the
 * indexes a later `DROP INDEX` retired already removed.
 *
 * A file whose indexes were all retired stays in the map with an empty list,
 * so a caller can still tell it apart from an ordinary migration.
 */
export function corpusUniqueIndexes(corpus: Array<{ file: string, content: string }>): Map<string, DeclaredUniqueIndex[]> {
  const ordered = [...corpus].sort((a, b) => a.file.localeCompare(b.file))
  const declared = new Map<string, DeclaredUniqueIndex[]>()
  // The last thing the corpus does to each index name, in run order.
  const lastEvent = new Map<string, 'create' | 'drop'>()

  for (const { file, content } of ordered) {
    const only = uniqueIndexOnlyFile(content, file)
    if (only)
      declared.set(file, only)

    for (const statement of sqlStatementsOf(content)) {
      const created = CREATE_UNIQUE_INDEX.exec(statement)?.[1]
      if (created) {
        lastEvent.set(created.toLowerCase(), 'create')
        continue
      }
      const dropped = DROP_INDEX.exec(statement)?.[1]
      if (dropped)
        lastEvent.set(dropped.toLowerCase(), 'drop')
    }
  }

  for (const [file, indexes] of declared)
    declared.set(file, indexes.filter(index => lastEvent.get(index.name.toLowerCase()) !== 'drop'))

  return declared
}

/** Read the corpus directory. A missing directory is an empty corpus. */
export function readCorpus(migrationsDir: string): Array<{ file: string, content: string }> {
  let files: string[]
  try {
    files = readdirSync(migrationsDir).filter(file => file.endsWith('.sql'))
  }
  catch {
    return []
  }
  return files.map(file => ({ file, content: readFileSync(join(migrationsDir, file), 'utf8') }))
}

export function hasIndex(db: Database, name: string): boolean {
  return Boolean(db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'index' AND lower(name) = lower(?)`).get(name))
}

/**
 * Whether the index can still be put back: its table exists and so does every
 * plain column it covers. Either one missing means a later migration removed
 * it deliberately, and replaying the index would fail rather than repair.
 */
export function uniqueIndexIsRestorable(db: Database, index: DeclaredUniqueIndex): boolean {
  const table = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND lower(name) = lower(?)`).get(index.table) as { name: string } | null
  if (!table)
    return false

  const present = new Set(
    (db.prepare(`SELECT name FROM pragma_table_info(?)`).all(table.name) as Array<{ name: string }>)
      .map(column => column.name.toLowerCase()),
  )
  return index.columns.every(column => present.has(column.toLowerCase()))
}

/**
 * Re-create every declared unique index a later rebuild dropped. Returns what
 * it restored, in corpus order.
 *
 * A failure is thrown, not swallowed: it is a UNIQUE violation, meaning
 * duplicate rows got in while the index was missing, and the migrate must say
 * so rather than finish green on a table that no longer enforces the rule.
 */
export function restoreDroppedUniqueIndexes(db: Database, migrationsDir: string): DeclaredUniqueIndex[] {
  const restored: DeclaredUniqueIndex[] = []

  for (const indexes of corpusUniqueIndexes(readCorpus(migrationsDir)).values()) {
    for (const index of indexes) {
      if (hasIndex(db, index.name) || !uniqueIndexIsRestorable(db, index))
        continue

      try {
        db.exec(index.statement)
      }
      catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        throw new Error(`Could not restore unique index "${index.name}" on "${index.table}" (declared in ${index.file}), which a later table rebuild dropped: ${detail}`)
      }
      restored.push(index)
    }
  }

  return restored
}
