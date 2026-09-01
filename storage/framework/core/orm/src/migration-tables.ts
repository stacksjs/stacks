/**
 * Codegen input: the tables an app's migration corpus creates.
 *
 * `buildDatabaseSchema` derives `database/types.d.ts` from `defineModel`
 * definitions, which types every table a model owns and no others. The
 * framework's own corpus creates ~25 tables that no model declares - the trait
 * pivots (`taggables`, `commentables`, `role_permissions`, ...) and the
 * model-less framework tables (`roles`, `permissions`, `job_batches`,
 * `magic_link_tokens`, `forms`, the `ci_*` set) - and a query against one of
 * those got no column checking at all (stacksjs/stacks#2409).
 *
 * That gap is not cosmetic. `where('totally_made_up_column', '=', 1)` is a type
 * error on a table that has a model and compiles on one that does not, so the
 * same typo fails at build time or at runtime depending on a distinction the
 * caller has no reason to know about. Several of the untyped tables are the
 * authorisation tables, where a `where` that silently matches nothing is a
 * security-relevant failure rather than a 500.
 *
 * ## Why this replays the SQL instead of parsing it
 *
 * The obvious implementation reads `CREATE TABLE` with a regex. It is wrong
 * here: the corpus carries 161 `ALTER TABLE ... ADD COLUMN` statements, so the
 * columns a table ends up with are not the columns its `CREATE` declares. A
 * parser would have to model `ALTER`, quoting, and every type spelling the
 * corpus uses, and would drift from SQLite's own reading of the same text.
 *
 * Replaying the corpus into a throwaway in-memory database and asking
 * `PRAGMA table_info` delegates all of that to the engine that will actually
 * answer the query.
 */

import { Database } from 'bun:sqlite'
import { existsSync, readdirSync, readFileSync } from 'node:fs'

export type MigrationDialect = 'sqlite' | 'mysql' | 'postgres'

export interface MigrationTable {
  table: string
  columns: Record<string, string>
}

export interface DeriveMigrationTablesResult {
  tables: MigrationTable[]
  /** Files that could not be applied at all, for the caller to surface. */
  errors: Array<{ file: string, error: string }>
}

/**
 * Tables that exist in a scratch database but describe nothing an app queries:
 * SQLite's own bookkeeping, and the `_qb_tmp_*` scratch tables the query
 * builder creates while rewriting a table.
 */
function isInternalTable(name: string): boolean {
  return name.startsWith('sqlite_') || name.startsWith('_qb_tmp_')
}

/**
 * A SQLite declared type to a TS type.
 *
 * Follows SQLite's own affinity rules rather than an exact-match table, because
 * a declared type is free text: the corpus contains `INTEGER`, `TEXT`,
 * `DATETIME`, `VARCHAR(255)` and `DECIMAL(10,2)` for what are four affinities.
 * Checked most specific first - `BOOLEAN` before the `INT` substring rule would
 * otherwise be unreachable is not the risk, but `DATETIME` matching `TEXT`
 * would be if the order were reversed.
 */
function sqliteTypeToTs(declared: string, dialect: MigrationDialect): string {
  const type = declared.toUpperCase()

  /*
   * Same rule as the model-derived columns: a raw row is whatever the driver
   * hands back, and only Postgres answers a real boolean. SQLite stores 0/1 in
   * an INTEGER and MySQL's BOOLEAN is a TINYINT(1), so typing these `boolean`
   * would make `row.is_active === true` false on a row whose flag is set.
   */
  if (type.includes('BOOL'))
    return dialect === 'postgres' ? 'boolean' : 'number'

  // Dates come back as strings, matching `created_at` on the model-derived side.
  if (type.includes('DATE') || type.includes('TIME'))
    return 'string'

  if (type.includes('INT'))
    return 'number'

  if (type.includes('CHAR') || type.includes('CLOB') || type.includes('TEXT'))
    return 'string'

  if (type.includes('REAL') || type.includes('FLOA') || type.includes('DOUB') || type.includes('NUMERIC') || type.includes('DEC'))
    return 'number'

  if (type.includes('BLOB'))
    return 'Uint8Array'

  /*
   * A column with no declared type has BLOB affinity in SQLite and can hold
   * anything. `unknown` forces the call site to narrow, which is the same
   * choice the model-derived side makes for an attribute it cannot type.
   */
  return 'unknown'
}

/**
 * Apply one migration file, falling back to statement-at-a-time when the file
 * as a whole fails.
 *
 * Four files in the framework's own corpus fail as a unit, because they `ALTER`
 * a table that a *model* creates rather than a migration - the corpus is not
 * self-sufficient. Aborting the file on the first such statement loses every
 * later statement in it, and one of those files carries 554 of them. Running
 * the rest individually recovers all but a handful.
 *
 * Splitting on `;` is only safe because a trigger body contains its own
 * statements, so files defining one are left atomic rather than shredded.
 */
function applyMigration(db: Database, sql: string): { ok: boolean, error?: string } {
  try {
    db.exec(sql)
    return { ok: true }
  }
  catch (err) {
    if (/CREATE\s+TRIGGER/i.test(sql))
      return { ok: false, error: (err as Error).message }

    let applied = 0
    for (const statement of sql.split(/;\s*$/m)) {
      if (!statement.trim())
        continue
      try {
        db.exec(statement)
        applied++
      }
      catch {
        // Expected: the statement that depends on a model-owned table. The
        // model derivation types that table anyway.
      }
    }

    return applied > 0 ? { ok: true } : { ok: false, error: (err as Error).message }
  }
}

/**
 * Replay `migrationsDir` into an in-memory database and report the shape of
 * every table it creates.
 *
 * Non-fatal throughout: a corpus that cannot be replayed at all yields no
 * tables and the model-derived schema stands, which is what shipped before
 * this existed.
 */
export function deriveMigrationTables(
  migrationsDir: string,
  dialect: MigrationDialect = 'sqlite',
): DeriveMigrationTablesResult {
  const errors: DeriveMigrationTablesResult['errors'] = []

  if (!existsSync(migrationsDir))
    return { tables: [], errors }

  let files: string[]
  try {
    files = readdirSync(migrationsDir).filter(name => name.endsWith('.sql')).sort()
  }
  catch (err) {
    return { tables: [], errors: [{ file: migrationsDir, error: (err as Error).message }] }
  }

  const db = new Database(':memory:')

  try {
    for (const file of files) {
      const full = `${migrationsDir}/${file}`
      let sql: string
      try {
        sql = readFileSync(full, 'utf-8')
      }
      catch (err) {
        errors.push({ file: full, error: (err as Error).message })
        continue
      }

      const result = applyMigration(db, sql)
      if (!result.ok)
        errors.push({ file: full, error: result.error ?? 'could not be applied' })
    }

    const names = db
      .query<{ name: string }, []>(
        `SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`,
      )
      .all()
      .map(row => row.name)
      .filter(name => !isInternalTable(name))

    const tables: MigrationTable[] = []
    for (const name of names) {
      // Identifier comes from sqlite_master, so it is a real table name; quoted
      // anyway because a migration is free to create `"order"`.
      const info = db
        .query<{ name: string, type: string, notnull: number, pk: number }, []>(
          `PRAGMA table_info("${name.replace(/"/g, '""')}")`,
        )
        .all()

      if (info.length === 0)
        continue

      const columns: Record<string, string> = {}
      for (const column of info) {
        const base = sqliteTypeToTs(column.type ?? '', dialect)
        /*
         * `INTEGER PRIMARY KEY` reports notnull = 0 because it aliases the
         * rowid, which SQLite fills in. Typing it `number | null` would make
         * every `row.id` need a narrow it does not deserve.
         */
        const nullable = column.notnull === 0 && column.pk === 0
        columns[column.name] = nullable && base !== 'unknown' ? `${base} | null` : base
      }

      tables.push({ table: name, columns })
    }

    return { tables, errors }
  }
  finally {
    db.close()
  }
}
