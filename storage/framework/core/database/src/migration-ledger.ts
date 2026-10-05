/**
 * Migration ledger drift audit (stacksjs/stacks#2203).
 *
 * The `migrations` table keys on the FILENAME. That filename carries an
 * ordinal prefix, and regenerating the corpus from `app/Models`
 * ({@link regenerateMigrationCorpus}) renumbers the whole sequence. Same
 * logical migrations, different numbers — so every migration whose number
 * shifted reads as never-applied, and genuinely-new migrations queue behind it.
 *
 * The reported failure was silent for weeks: the ledger claimed 6 applied, the
 * schema reflected ~22, and the first symptom was a 500 from an unrelated
 * feature panel (`column p.repository does not exist`). Nothing compared the
 * two, because nothing ever had.
 *
 * This module supplies that comparison, across three sources rather than two:
 *
 *   1. the active dialect's migration corpus — what should exist
 *   2. the `migrations` table      — what the runner believes it has applied
 *   3. the live schema             — what is actually there
 *
 * The third is what makes the audit trustworthy. The ledger is precisely the
 * thing under suspicion, so a disk-vs-ledger diff alone cannot tell a
 * renumbered-but-applied migration (harmless once the row is rewritten) from a
 * genuinely pending one (must actually run). Only the schema can, and it is
 * what a human recovering by hand ends up reading anyway.
 *
 * Deliberately NOT automatic. Recording a migration that never ran, or
 * re-running one that did, are both worse than the drift. Everything here is
 * read-only until a caller opts in, and the reconciler refuses every case it
 * cannot prove.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import process from 'node:process'
import { join } from 'node:path'
import { resolveMigrationDirectory } from './migration-path'

export type LedgerDialect = 'sqlite' | 'mysql' | 'postgres'

/**
 * A schema change a migration makes that can be confirmed by looking at the
 * live database. Deliberately narrow: only effects whose presence is
 * unambiguous. An `ALTER COLUMN ... TYPE`, an `UPDATE`, or a `DELETE` leaves no
 * such trace, and guessing at those is how you end up recording a data
 * migration that never ran.
 */
export interface MigrationEffect {
  kind: 'table' | 'column' | 'index' | 'constraint' | 'enum'
  /** Owning table, for `column` and `constraint` effects. */
  table?: string
  /** Table / column / index / constraint / enum type name. */
  name: string
}

export type MigrationStatus =
  /** Recorded in the ledger, and every verifiable effect is present. */
  | 'applied'
  /** Not recorded, but every effect is already present — a renumber victim. */
  | 'stranded'
  /** Not recorded, and no effect is present — genuinely queued to run. */
  | 'pending'
  /** Not recorded, and only some effects are present — needs a human. */
  | 'partial'
  /** Nothing schema-visible to check (pure DML). Status cannot be inferred. */
  | 'unverifiable'
  /** Recorded, but effects are missing — the schema drifted away from history. */
  | 'reverted'

export interface MigrationLedgerEntry {
  file: string
  /** Filename minus its ordinal prefix and extension. Stable across renumbers. */
  logical: string
  recorded: boolean
  status: MigrationStatus
  effects: MigrationEffect[]
  present: MigrationEffect[]
  absent: MigrationEffect[]
}

export interface LedgerOrphan {
  /** The ledger row. */
  migration: string
  /**
   * The disk file carrying the same logical name, when exactly one does —
   * i.e. this row was renumbered rather than deleted.
   */
  renamedTo?: string
}

export interface MigrationLedgerAudit {
  /** False when the dialect has no introspection support here. */
  supported: boolean
  dialect: LedgerDialect | 'other'
  dir: string
  entries: MigrationLedgerEntry[]
  orphans: LedgerOrphan[]
  /** Files the runner skips because their feature is disabled; not classified. */
  gated: string[]
  counts: Record<MigrationStatus, number>
  /** Ledger rows read, for reporting "N files on disk, M recorded". */
  recordedCount: number
  /**
   * How ledger rows map onto the renumbered corpus. Carried on the result so
   * the reconciler acts on the same plan the report showed, rather than
   * recomputing one from a slightly different file list.
   */
  remapPlan: LedgerRemapPlan
  /** True when anything needs attention. */
  drift: boolean
}

export interface LedgerRemap {
  from: string
  to: string
}

export interface LedgerRemapPlan {
  /** Ledger rows to rewrite in place, matched by logical name. */
  remap: LedgerRemap[]
  /** Rows whose logical name matches more than one disk file — refused. */
  ambiguous: string[]
  /** Rows with no disk counterpart at all — the migration is simply gone. */
  dropped: string[]
  /**
   * Rows left over from a renumbering: the same migration is already recorded
   * under its current filename, so this row is a duplicate of a correct one.
   *
   * Distinct from `dropped`, which means the migration is genuinely gone. A
   * duplicate is safe to delete precisely because the row it duplicates is
   * still there, and leaving it reports drift that no amount of reconciling
   * can ever clear.
   */
  superseded: string[]
}

/**
 * Filenames the ledger writers will accept.
 *
 * Every write below inlines the filename as a SQL literal rather than binding
 * it, because the parameter placeholder differs by dialect and the ledger is
 * touched on all three. That is only safe because this pattern admits no quote,
 * backslash, or semicolon — so validate first, and refuse anything else rather
 * than trying to escape it.
 */
const SAFE_MIGRATION_FILE = /^[\w.-]+\.sql$/

/** `["`[]?ident["`\]]?` — accepts every identifier quoting style in play. */
const IDENT = String.raw`["\`\[]?([A-Za-z_]\w*)["\`\]]?`

/**
 * Strip a migration's SQL down to something safe to pattern-match.
 *
 * Blanks comments and single-quoted string literals while PRESERVING
 * double-quoted identifiers, which is the opposite of what
 * {@link stripSqlNoise} in `migration-dialect.ts` wants — that one is matching
 * dialect markers and has no use for names, whereas every effect here IS a
 * name. Blanking the literals still matters: without it a data migration whose
 * payload happens to contain `CREATE TABLE "x"` would register as creating a
 * table, and then be silently recorded as applied.
 *
 * Blanking preserves offsets and line count, so nothing downstream has to care.
 */
export function stripForEffects(sql: string): string {
  let out = ''
  let i = 0
  const blank = (text: string): string => text.replace(/[^\n]/g, ' ')

  while (i < sql.length) {
    const rest = sql.slice(i)

    const line = rest.match(/^--[^\n]*/)
    if (line) {
      out += blank(line[0])
      i += line[0].length
      continue
    }

    if (rest.startsWith('/*')) {
      const end = rest.indexOf('*/')
      const chunk = end === -1 ? rest : rest.slice(0, end + 2)
      out += blank(chunk)
      i += chunk.length
      continue
    }

    if (rest[0] === '\'') {
      let j = 1
      while (j < rest.length && rest[j] !== '\'') j++
      const chunk = rest.slice(0, Math.min(j + 1, rest.length))
      out += blank(chunk)
      i += chunk.length
      continue
    }

    out += sql[i]
    i += 1
  }

  return out
}

/** Split cleaned SQL into statements. */
function statementsOf(sql: string): string[] {
  return stripForEffects(sql)
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0)
}

/**
 * The migration's identity, independent of where it sits in the sequence.
 *
 * This is the whole basis for reconciliation: `0000000003-create-issues-table`
 * and `0000000002-create-issues-table` are the same migration, and the ledger
 * only failed to see that because it stored the ordinal.
 */
export function logicalName(file: string): string {
  return file.replace(/^\d+[-_]/, '').replace(/\.sql$/i, '')
}

/**
 * Schema objects a migration file explicitly REMOVES.
 *
 * The audit checks each migration against the live schema in isolation, which
 * cannot see that a later migration undid an earlier one on purpose. A widened
 * index is the ordinary case: one migration creates `(country, state)`, a
 * later one drops it, a third creates `(country, state, state_name)` in its
 * place. The schema is exactly right, and the first migration nonetheless
 * reported as REVERTED — "the effects are gone" — forever, because they are
 * gone, deliberately.
 *
 * Only drops in a LATER file count when this is applied; an earlier drop is
 * unrelated history.
 */
export function migrationRemovals(sql: string): MigrationEffect[] {
  const removals: MigrationEffect[] = []
  const seen = new Set<string>()

  const push = (effect: MigrationEffect): void => {
    const key = effectKey(effect)
    if (seen.has(key)) return
    seen.add(key)
    removals.push(effect)
  }

  for (const statement of statementsOf(sql)) {
    const index = new RegExp(String.raw`^DROP\s+INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+EXISTS\s+)?${IDENT}`, 'i').exec(statement)
    if (index?.[1]) {
      push({ kind: 'index', name: index[1] })
      continue
    }

    const table = new RegExp(String.raw`^DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?${IDENT}`, 'i').exec(statement)
    if (table?.[1]) {
      push({ kind: 'table', name: table[1] })
      continue
    }

    const enumType = new RegExp(String.raw`^DROP\s+TYPE\s+(?:IF\s+EXISTS\s+)?${IDENT}`, 'i').exec(statement)
    if (enumType?.[1]) {
      push({ kind: 'enum', name: enumType[1] })
      continue
    }

    const alter = new RegExp(String.raw`^ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?${IDENT}\s+(.*)$`, 'is').exec(statement)
    if (!alter?.[1]) continue
    const owner = alter[1]
    for (const clause of (alter[2] ?? '').split(',')) {
      // Constraints first, and the COLUMN keyword is optional in the pattern
      // below: `DROP CONSTRAINT x` otherwise matches it too, with the literal
      // word "CONSTRAINT" captured as the column name.
      const constraint = new RegExp(String.raw`^\s*DROP\s+CONSTRAINT\s+(?:IF\s+EXISTS\s+)?${IDENT}`, 'i').exec(clause)
      if (constraint?.[1]) {
        push({ kind: 'constraint', table: owner, name: constraint[1] })
        continue
      }

      const column = new RegExp(String.raw`^\s*DROP\s+(?:COLUMN\s+)?(?:IF\s+EXISTS\s+)?${IDENT}`, 'i').exec(clause)
      // Anything else that can follow DROP in an ALTER TABLE is a different
      // kind of object, not a bare column name.
      if (column?.[1] && !/^(?:constraint|index|key|primary|foreign|unique|check|default|partition)$/i.test(column[1]))
        push({ kind: 'column', table: owner, name: column[1] })
    }
  }

  return removals
}

/** Schema changes a migration file makes that the live database can confirm. */
export function migrationEffects(sql: string): MigrationEffect[] {
  const effects: MigrationEffect[] = []
  const seen = new Set<string>()
  // Tables this file renames away. bun-query-builder rebuilds a table by
  // creating `_qb_tmp_<name>`, copying into it, and renaming it into place, so
  // the scaffold is GONE once the migration succeeds. Counting its CREATE as an
  // effect makes every rebuild look permanently half-applied — which would
  // report the exact migrations #2203 is about as `partial` instead of
  // `stranded`, and put them beyond the reconciler's reach. Tracked by rename
  // rather than by the `_qb_tmp_` prefix so any naming scheme is covered.
  const renamedAway = new Set<string>()

  const push = (effect: MigrationEffect): void => {
    const key = effectKey(effect)
    if (seen.has(key)) return
    seen.add(key)
    effects.push(effect)
  }

  for (const statement of statementsOf(sql)) {
    const create = new RegExp(String.raw`^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?${IDENT}`, 'i').exec(statement)
    if (create?.[1]) {
      push({ kind: 'table', name: create[1] })
      continue
    }

    // SQLite rebuilds a table by creating `_qb_tmp_<name>` and renaming it into
    // place, so the rename is what actually leaves the final table behind.
    const rename = new RegExp(String.raw`^ALTER\s+TABLE\s+${IDENT}\s+RENAME\s+TO\s+${IDENT}`, 'i').exec(statement)
    if (rename?.[2]) {
      if (rename[1]) renamedAway.add(rename[1].toLowerCase())
      push({ kind: 'table', name: rename[2] })
      continue
    }

    const index = new RegExp(String.raw`^CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?${IDENT}(?:\s+ON\s+${IDENT})?`, 'i').exec(statement)
    if (index?.[1]) {
      // The owning table is captured so `effectPresent` can recognise the
      // legacy `<table>_<name>` spelling of the same index.
      push(index[2] ? { kind: 'index', name: index[1], table: index[2] } : { kind: 'index', name: index[1] })
      continue
    }

    const enumType = new RegExp(String.raw`^CREATE\s+TYPE\s+${IDENT}\s+AS\s+ENUM`, 'i').exec(statement)
    if (enumType?.[1]) {
      push({ kind: 'enum', name: enumType[1] })
      continue
    }

    const alter = new RegExp(String.raw`^ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?${IDENT}\s+(.*)$`, 'is').exec(statement)
    if (!alter?.[1] || !alter[2]) continue
    const table = alter[1]

    // One ALTER may carry several comma-separated actions. Matching globally
    // over the remainder catches all of them; anchoring would find only the
    // first and quietly under-report what the file does.
    const addColumn = new RegExp(String.raw`\bADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?${IDENT}`, 'gi')
    for (const m of alter[2].matchAll(addColumn)) {
      if (m[1]) push({ kind: 'column', table, name: m[1] })
    }

    const addConstraint = new RegExp(String.raw`\bADD\s+CONSTRAINT\s+(?:IF\s+NOT\s+EXISTS\s+)?${IDENT}`, 'gi')
    for (const m of alter[2].matchAll(addConstraint)) {
      if (m[1]) push({ kind: 'constraint', table, name: m[1] })
    }

    // MySQL's short form: `ADD <column> <type>`, no COLUMN keyword. Excluded
    // above by the explicit keyword; match it here, taking care not to re-read
    // CONSTRAINT / INDEX / KEY / PRIMARY / UNIQUE / FOREIGN as a column name.
    const addBare = new RegExp(
      String.raw`\bADD\s+(?!COLUMN\b|CONSTRAINT\b|INDEX\b|KEY\b|PRIMARY\b|UNIQUE\b|FOREIGN\b|FULLTEXT\b|SPATIAL\b|CHECK\b)${IDENT}\s+\w`,
      'gi',
    )
    for (const m of alter[2].matchAll(addBare)) {
      if (m[1]) push({ kind: 'column', table, name: m[1] })
    }
  }

  // A rename can appear before or after the CREATE that built the scaffold, so
  // the filter has to run once the whole file has been read.
  if (renamedAway.size === 0)
    return effects

  return effects.filter((effect) => {
    const owner = (effect.kind === 'table' ? effect.name : effect.table ?? '').toLowerCase()
    return !renamedAway.has(owner)
  })
}

function effectKey(effect: MigrationEffect): string {
  return `${effect.kind}:${(effect.table ?? '').toLowerCase()}.${effect.name.toLowerCase()}`
}

/**
 * Key for matching a CREATE against a later DROP.
 *
 * Indexes, tables and enum types are named globally, and `DROP INDEX` names no
 * table at all — so keying an index removal by table can never match the
 * CREATE that carries one, which is how the widened-index case went on
 * reporting as REVERTED after removals were already being parsed. Columns and
 * constraints keep their table, where it genuinely disambiguates two
 * same-named columns on different tables.
 */
function removalKey(effect: MigrationEffect): string {
  if (effect.kind === 'column' || effect.kind === 'constraint')
    return effectKey(effect)
  return `${effect.kind}:${effect.name.toLowerCase()}`
}

/**
 * Effects this dialect can actually confirm.
 *
 * SQLite has no named constraints reachable by introspection (foreign keys are
 * inline on CREATE TABLE) and no user-defined types, and the runner
 * deliberately records ADD CONSTRAINT / CREATE TYPE files as executed WITHOUT
 * running them so a later `DB_CONNECTION` flip can replay the file
 * (stacksjs/stacks#1916). Checking for those effects on SQLite would therefore
 * report every such file as `reverted`, which is both wrong and loud. MySQL has
 * no standalone enum type either.
 */
export function verifiableEffects(effects: MigrationEffect[], dialect: LedgerDialect): MigrationEffect[] {
  if (dialect === 'postgres') return effects
  if (dialect === 'mysql') return effects.filter(e => e.kind !== 'enum')
  return effects.filter(e => e.kind !== 'constraint' && e.kind !== 'enum')
}

export interface LiveSchema {
  tables: Set<string>
  /** table (lower) → set of column names (lower). */
  columns: Map<string, Set<string>>
  indexes: Set<string>
  constraints: Set<string>
  enums: Set<string>
}

function emptySchema(): LiveSchema {
  return { tables: new Set(), columns: new Map(), indexes: new Set(), constraints: new Set(), enums: new Set() }
}

function rowsOf(result: unknown): any[] {
  return Array.isArray(result) ? result : []
}

/**
 * Runs one SQL string and returns its rows.
 *
 * Injectable for the same reason `ensure-database.ts` takes its own `connect`:
 * everything here has to be exercisable against a database the caller controls.
 * The default binds to the process-wide `db`, which is a single shared handle —
 * fine in production, useless for a test that needs to build a specific
 * drift state, and unable to audit a database other than the configured one.
 */
export type SqlRunner = (sql: string) => Promise<any[]>

async function defaultRunner(): Promise<SqlRunner> {
  const { db } = await import('./utils')
  return async (sql: string) => rowsOf(await db.unsafe(sql).execute())
}

function pick(row: any, ...keys: string[]): string {
  for (const key of keys) {
    const value = row?.[key] ?? row?.[key.toLowerCase()] ?? row?.[key.toUpperCase()]
    if (typeof value === 'string' && value.length > 0) return value
  }
  return ''
}

/** Read the parts of the live schema an effect can be checked against. */
export async function readLiveSchema(dialect: LedgerDialect, runner?: SqlRunner): Promise<LiveSchema> {
  const schema = emptySchema()
  const run = runner ?? await defaultRunner()

  if (dialect === 'sqlite') {
    for (const row of await run(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`)) {
      const name = pick(row, 'name')
      if (name) schema.tables.add(name.toLowerCase())
    }
    for (const row of await run(`SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'`)) {
      const name = pick(row, 'name')
      if (name) schema.indexes.add(name.toLowerCase())
    }
    for (const table of schema.tables) {
      // Identifier interpolation — bounded by the charset check, same guard the
      // unique-index audit uses for its own PRAGMA calls.
      if (!/^[a-z_]\w*$/i.test(table)) continue
      const cols = new Set<string>()
      for (const row of await run(`PRAGMA table_info("${table}")`)) {
        const name = pick(row, 'name')
        if (name) cols.add(name.toLowerCase())
      }
      schema.columns.set(table, cols)
    }
    return schema
  }

  if (dialect === 'mysql') {
    for (const row of await run(`SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()`)) {
      const name = pick(row, 'name', 'TABLE_NAME')
      if (name) schema.tables.add(name.toLowerCase())
    }
    for (const row of await run(`SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()`)) {
      const table = pick(row, 'TABLE_NAME').toLowerCase()
      const column = pick(row, 'COLUMN_NAME').toLowerCase()
      if (!table || !column) continue
      if (!schema.columns.has(table)) schema.columns.set(table, new Set())
      schema.columns.get(table)!.add(column)
    }
    for (const row of await run(`SELECT DISTINCT INDEX_NAME AS name FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE()`)) {
      const name = pick(row, 'name', 'INDEX_NAME')
      if (name) schema.indexes.add(name.toLowerCase())
    }
    for (const row of await run(`SELECT CONSTRAINT_NAME AS name FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE()`)) {
      const name = pick(row, 'name', 'CONSTRAINT_NAME')
      if (name) schema.constraints.add(name.toLowerCase())
    }
    return schema
  }

  for (const row of await run(`SELECT tablename AS name FROM pg_tables WHERE schemaname = 'public'`)) {
    const name = pick(row, 'name', 'tablename')
    if (name) schema.tables.add(name.toLowerCase())
  }
  for (const row of await run(`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`)) {
    const table = pick(row, 'table_name').toLowerCase()
    const column = pick(row, 'column_name').toLowerCase()
    if (!table || !column) continue
    if (!schema.columns.has(table)) schema.columns.set(table, new Set())
    schema.columns.get(table)!.add(column)
  }
  for (const row of await run(`SELECT indexname AS name FROM pg_indexes WHERE schemaname = 'public'`)) {
    const name = pick(row, 'name', 'indexname')
    if (name) schema.indexes.add(name.toLowerCase())
  }
  for (const row of await run(`SELECT c.conname AS name FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public'`)) {
    const name = pick(row, 'name', 'conname')
    if (name) schema.constraints.add(name.toLowerCase())
  }
  for (const row of await run(`SELECT t.typname AS name FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typtype = 'e' AND n.nspname = 'public'`)) {
    const name = pick(row, 'name', 'typname')
    if (name) schema.enums.add(name.toLowerCase())
  }
  return schema
}

/** Whether a single effect can be found in the live schema. */
export function effectPresent(effect: MigrationEffect, schema: LiveSchema): boolean {
  const name = effect.name.toLowerCase()
  switch (effect.kind) {
    case 'table':
      return schema.tables.has(name)
    case 'column':
      return schema.columns.get((effect.table ?? '').toLowerCase())?.has(name) ?? false
    case 'index': {
      if (schema.indexes.has(name))
        return true

      /*
       * Older generators prefixed an index with its table even when the
       * declared name already began with it, producing
       * `saved_trails_saved_trails_user_trail_unique` for what the current
       * generator emits as `saved_trails_user_trail_unique`. The index is the
       * same index; only the spelling changed.
       *
       * Matching literally meant every such index read as ABSENT, so the
       * migration that created it was classified `pending` — "not applied yet,
       * will run on the next `buddy migrate`" — about a migration that had
       * demonstrably run, against tables holding thousands of rows. That is
       * the worst possible direction for this tool to be wrong in: it invites
       * an operator to run a migration on a production database to fix drift
       * that does not exist.
       */
      const table = (effect.table ?? '').toLowerCase()
      if (!table)
        return false

      // Unconditionally, including when the declared name already begins with
      // the table: the legacy generator prefixed regardless, which is how
      // `saved_trails_user_trail_unique` came to be stored as
      // `saved_trails_saved_trails_user_trail_unique`. Skipping the lookup for
      // names that look already-prefixed was the first attempt at this fix and
      // it missed every real case in the database that prompted it.
      //
      // This stays honest: `<table>_<name>` is one specific string. Finding it
      // means that exact index exists under the older spelling, not that some
      // other index on the table will do.
      return schema.indexes.has(`${table}_${name}`)
    }
    case 'constraint':
      return schema.constraints.has(name)
    case 'enum':
      return schema.enums.has(name)
  }
}

/**
 * Decide what a single migration file's state actually is.
 *
 * Pure, so the interesting cases are testable without a database. The order
 * matters: "no verifiable effects" has to be answered before "all present",
 * because vacuously-all-present is exactly the wrong answer for a data
 * migration — it is how a `DELETE FROM oauth_access_tokens` gets recorded as
 * applied on the strength of having nothing to check.
 */
export function classifyMigration(
  recorded: boolean,
  present: MigrationEffect[],
  absent: MigrationEffect[],
): MigrationStatus {
  const verifiable = present.length + absent.length
  if (recorded) {
    if (verifiable === 0 || absent.length === 0) return 'applied'
    return 'reverted'
  }
  if (verifiable === 0) return 'unverifiable'
  if (absent.length === 0) return 'stranded'
  if (present.length === 0) return 'pending'
  return 'partial'
}

function migrationsDir(dir?: string): string {
  if (dir) return dir
  const driver = String(process.env.DB_CONNECTION || 'sqlite').toLowerCase()
  return resolveMigrationDirectory(driver === 'singlestore' ? 'singlestore' : driver)
}

function listMigrationFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  try {
    return readdirSync(dir).filter(f => f.toLowerCase().endsWith('.sql')).sort()
  }
  catch {
    return []
  }
}

async function currentDialect(): Promise<LedgerDialect | 'other'> {
  const env = await import('@stacksjs/env')
  const driver = ((env as { env?: { DB_CONNECTION?: string } }).env?.DB_CONNECTION ?? 'sqlite').toLowerCase()
  if (driver === 'sqlite' || driver === 'mysql' || driver === 'postgres') return driver
  if (driver === 'vitess' || driver === 'singlestore') return 'mysql'
  // Turso / libSQL keeps its ledger in SQLite's shape.
  if (driver === 'turso' || driver === 'libsql') return 'sqlite'
  return 'other'
}

/**
 * Every filename the `migrations` table has recorded.
 *
 * An absent table is a legitimate state (nothing has ever migrated), so it
 * reads as an empty ledger rather than an error.
 */
export async function readLedger(runner?: SqlRunner): Promise<string[]> {
  try {
    const run = runner ?? await defaultRunner()
    const rows = await run('SELECT migration FROM migrations')
    return rows
      .map(row => pick(row, 'migration'))
      .filter(name => name.length > 0)
      .sort()
  }
  catch {
    return []
  }
}

/**
 * Match ledger rows to disk files by logical name, so a renumbered corpus can
 * have its bookkeeping rewritten instead of being re-run.
 *
 * Pure — takes the two lists and returns a plan. Refuses anything it cannot
 * prove: a logical name appearing on more than one disk file, or two ledger
 * rows converging on one file, are both reported as ambiguous rather than
 * guessed at. A wrong remap silently un-applies a migration, which is the very
 * failure this exists to fix.
 */
export function planLedgerRemap(ledger: string[], diskFiles: string[]): LedgerRemapPlan {
  const onDisk = new Set(diskFiles)
  const byLogical = new Map<string, string[]>()
  for (const file of diskFiles) {
    const key = logicalName(file)
    if (!byLogical.has(key)) byLogical.set(key, [])
    byLogical.get(key)!.push(file)
  }

  // A row that already names a file on disk is correct and claims that file,
  // so no other row may remap onto it.
  const claimed = new Set(ledger.filter(row => onDisk.has(row)))

  const remap: LedgerRemap[] = []
  const ambiguous: string[] = []
  const dropped: string[] = []
  const superseded: string[] = []
  const targets = new Map<string, string[]>()

  for (const row of ledger) {
    if (onDisk.has(row)) continue
    const sameLogical = byLogical.get(logicalName(row)) ?? []
    const candidates = sameLogical.filter(f => !claimed.has(f))
    if (candidates.length === 0) {
      /*
       * No FREE candidate is two different situations, and calling both
       * "the migration is gone" was wrong for one of them.
       *
       * If a file with this row's logical name exists but is already claimed
       * by another ledger row, the migration is not gone at all — it is
       * recorded twice, once under each numbering, because a renumbering
       * added the new spelling without removing the old. The row is a
       * duplicate of a correct one and can go.
       *
       * Only when NO file carries the logical name is the migration really
       * missing from disk, which is a human's call, not a reconciler's.
       */
      if (sameLogical.length > 0)
        superseded.push(row)
      else
        dropped.push(row)
      continue
    }
    if (candidates.length > 1) {
      ambiguous.push(row)
      continue
    }
    const to = candidates[0]!
    if (!targets.has(to)) targets.set(to, [])
    targets.get(to)!.push(row)
    remap.push({ from: row, to })
  }

  // Two rows resolving to one file means the logical names collided; neither
  // can be trusted.
  const contested = new Set([...targets.entries()].filter(([, rows]) => rows.length > 1).flatMap(([, rows]) => rows))
  if (contested.size === 0)
    return { remap, ambiguous, dropped, superseded }

  return {
    remap: remap.filter(r => !contested.has(r.from)),
    ambiguous: [...ambiguous, ...contested].sort(),
    dropped,
    superseded,
  }
}

/**
 * Compare the migration corpus, the ledger, and the live schema.
 *
 * Read-only. Nothing here writes, so it is safe to run on production and safe
 * to wire into `buddy doctor`.
 */
export async function auditMigrationLedger(options: {
  dir?: string
  /** Audit a specific dialect instead of the configured one. */
  dialect?: LedgerDialect
  /** Audit a database other than the process-wide one. */
  run?: SqlRunner
  /**
   * The runner's feature gate. A file it hides is not pending, since it will
   * not run, and a statement it strips from a file it keeps is not an effect
   * that file was meant to have - without this, every catch-all `auto-misc`
   * migration on an app with a disabled feature read as REVERTED.
   */
  gate?: CorpusGate
} = {}): Promise<MigrationLedgerAudit> {
  const dir = migrationsDir(options.dir)
  const dialect = options.dialect ?? await currentDialect()
  const files = listMigrationFiles(dir)

  const counts: Record<MigrationStatus, number> = {
    applied: 0,
    stranded: 0,
    pending: 0,
    partial: 0,
    unverifiable: 0,
    reverted: 0,
  }

  const emptyPlan: LedgerRemapPlan = { remap: [], ambiguous: [], dropped: [], superseded: [] }
  if (dialect === 'other') {
    return { supported: false, dialect, dir, entries: [], orphans: [], gated: [], counts, recordedCount: 0, remapPlan: emptyPlan, drift: false }
  }

  const run = options.run ?? await defaultRunner()
  const ledger = await readLedger(run)
  const recorded = new Set(ledger)
  const schema = await readLiveSchema(dialect, run)
  const gate = await resolveGate(options, dir)

  // Read once: the classification below needs every file's REMOVALS, not just
  // its own, to tell a deliberate later drop from a lost effect.
  const sources = new Map<string, string>()
  const gated = files.filter(file => gate?.exclude.has(file))
  for (const file of files) {
    if (gate?.exclude.has(file))
      continue
    try {
      const sql = readFileSync(join(dir, file), 'utf8')
      sources.set(file, gate ? gate.rewrite(sql) : sql)
    }
    catch {
      continue
    }
  }

  // Files sort by their numeric prefix, so everything after a file in this
  // list ran after it. Keyed by effect so the lookup is exact — dropping
  // `trails_country_state_index` must not excuse a missing table of the same
  // name, nor an index of that name on a different migration's behalf.
  const readFiles = [...sources.keys()]
  const removedLater = new Map<string, Set<string>>()
  // Tables a later migration drops. Everything ON a dropped table goes with it
  // - indexes, columns, constraints - and no engine records those individually,
  // so an index effect is not looked for by name once its table is gone.
  const tablesDroppedLater = new Map<string, Set<string>>()
  for (let i = 0; i < readFiles.length; i++) {
    const laterKeys = new Set<string>()
    const laterTables = new Set<string>()
    for (let j = i + 1; j < readFiles.length; j++) {
      for (const removal of migrationRemovals(sources.get(readFiles[j]!)!)) {
        laterKeys.add(removalKey(removal))
        if (removal.kind === 'table')
          laterTables.add(removal.name.toLowerCase())
      }
    }
    removedLater.set(readFiles[i]!, laterKeys)
    tablesDroppedLater.set(readFiles[i]!, laterTables)
  }

  const entries: MigrationLedgerEntry[] = []
  for (const file of readFiles) {
    const sql = sources.get(file)!

    const effects = verifiableEffects(migrationEffects(sql), dialect)
    const dropped = removedLater.get(file) ?? new Set<string>()
    /*
     * An effect a LATER migration explicitly drops counts as present.
     *
     * Not a fudge: the question this audit answers is "did this migration
     * run", and an effect that a subsequent migration deliberately removed is
     * evidence that it did. Widening an index is the ordinary case — create
     * (country, state), drop it, create (country, state, state_name) — and
     * treating the first as REVERTED reported healthy, intentional history as
     * drift that no command could ever clear.
     */
    const droppedTables = tablesDroppedLater.get(file) ?? new Set<string>()
    /*
     * …and so does an effect ON a table a later migration dropped.
     *
     * bun-query-builder rebuilds a SQLite table by creating `_qb_tmp_<name>`,
     * copying into it, dropping the original and renaming the scaffold into
     * place - which takes every index the original carried, under whatever name
     * it had then. `payments_payments_transaction_id_unique` (the doubled
     * spelling an older migration used) is gone for exactly that reason and the
     * correctly-named index is there instead, so the schema is right and the
     * migration that created the old one reported REVERTED forever. It was 22
     * of them here, on a database `migrate:fresh` had just built from the
     * corpus, which is the one state that has to come out clean.
     */
    const survives = (effect: MigrationEffect): boolean =>
      effectPresent(effect, schema)
      || dropped.has(removalKey(effect))
      || (effect.table !== undefined && droppedTables.has(effect.table.toLowerCase()))
    const present = effects.filter(survives)
    const absent = effects.filter(effect => !survives(effect))
    const isRecorded = recorded.has(file)
    const status = classifyMigration(isRecorded, present, absent)
    counts[status] += 1
    entries.push({ file, logical: logicalName(file), recorded: isRecorded, status, effects, present, absent })
  }

  // Planned against the files that were actually READ, which is what the
  // classification above used. Planning against the raw directory listing
  // instead would let an unreadable file produce a remap target that has no
  // entry, so the audit's report and the reconciler's actions could disagree.
  // Gated files are still the corpus: a ledger row naming one is not an
  // orphan, and a renumbered one still has a counterpart.
  const readable = [...entries.map(entry => entry.file), ...gated].sort()
  const remapPlan = planLedgerRemap(ledger, readable)
  const renamedTo = new Map(remapPlan.remap.map(r => [r.from, r.to]))
  const orphans: LedgerOrphan[] = ledger
    .filter(row => !readable.includes(row))
    .map(row => ({ migration: row, renamedTo: renamedTo.get(row) }))

  const drift = counts.stranded > 0 || counts.partial > 0 || counts.reverted > 0 || orphans.length > 0

  return { supported: true, dialect, dir, entries, orphans, gated, counts, recordedCount: ledger.length, remapPlan, drift }
}

/**
 * Ensure the ledger table exists before writing to it.
 *
 * Mirrors the shape bun-query-builder creates on the first `executeMigration`,
 * so reconciling a database that has never migrated does not then collide with
 * the runner's own CREATE.
 */
async function ensureLedgerTable(dialect: LedgerDialect, run: SqlRunner): Promise<void> {
  const id = dialect === 'postgres'
    ? 'id SERIAL PRIMARY KEY'
    : dialect === 'mysql'
      ? 'id INT AUTO_INCREMENT PRIMARY KEY'
      : 'id INTEGER PRIMARY KEY AUTOINCREMENT'
  const timestamp = dialect === 'postgres' ? 'TIMESTAMP' : 'DATETIME'

  /*
   * UTC, like every other timestamp default the framework writes.
   *
   * `executed_at` has no time zone in it, so a bare `CURRENT_TIMESTAMP` stores
   * the database *session's* local clock and silently drops the offset - and
   * the ledger then disagrees with every table it is a ledger for. SQLite's
   * `CURRENT_TIMESTAMP` is already UTC and it cannot alter a default anyway.
   */
  const utcNow = dialect === 'postgres'
    ? `(now() AT TIME ZONE 'utc')`
    : dialect === 'mysql' ? '(UTC_TIMESTAMP)' : 'CURRENT_TIMESTAMP'

  await run(
    `CREATE TABLE IF NOT EXISTS migrations (${id}, migration VARCHAR(255) NOT NULL UNIQUE, executed_at ${timestamp} DEFAULT ${utcNow})`,
  )

  /*
   * And fix a ledger that already exists.
   *
   * `IF NOT EXISTS` means the statement above does nothing on every database
   * that has ever migrated, so without this the default above only ever reaches
   * new installs. Tolerated rather than checked: on SQLite there is nothing to
   * alter, and a runner that refuses is not a reason to fail a migrate.
   */
  if (dialect !== 'sqlite') {
    try {
      await run(`ALTER TABLE migrations ALTER COLUMN executed_at SET DEFAULT ${utcNow}`)
    }
    catch {
      // Already correct, or a dialect that will not say so. Either way the
      // ledger is readable and the migration can proceed.
    }
  }
}

export interface ReconcileResult {
  /** Ledger rows rewritten from an old filename to its renumbered one. */
  remapped: LedgerRemap[]
  /** Files recorded as applied because every effect was already present. */
  recorded: string[]
  /** Duplicate ledger rows deleted — the migration stays recorded under its current name. */
  pruned: string[]
  /**
   * Ledger rows deleted so the next `buddy migrate` runs the file again, to
   * rebuild a table the database is missing (only with `requeueReverted`).
   */
  requeued: string[]
  /** Things the reconciler refused to touch, with why. */
  skipped: Array<{ file: string, reason: string }>
}

/** What one statement does to which tables, as far as a requeue cares. */
interface StatementShape {
  /** Data or schema changes, by table (lower-case). */
  modifies: string[]
  creates?: string
  drops?: string
  rename?: { from: string, to: string }
  index?: { name: string, table: string }
  /** Not something the requeue planner can reason about. */
  unknown?: boolean
}

const Q = (pattern: string): RegExp => new RegExp(pattern.replaceAll('{id}', IDENT), 'i')

const CREATE_TABLE = Q(String.raw`^CREATE\s+(?:TEMP(?:ORARY)?\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?{id}`)
const DROP_TABLE = Q(String.raw`^DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?{id}`)
const RENAME_TABLE = Q(String.raw`^ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?{id}\s+RENAME\s+TO\s+{id}`)
const ALTER_TABLE = Q(String.raw`^ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?{id}`)
const CREATE_INDEX = Q(String.raw`^CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?{id}\s+ON\s+(?:ONLY\s+)?{id}`)
const DROP_INDEX = Q(String.raw`^DROP\s+INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+EXISTS\s+)?{id}(?:\s+ON\s+{id})?`)
const DML = Q(String.raw`^(?:INSERT\s+(?:OR\s+\w+\s+)?INTO|REPLACE\s+INTO|UPDATE|DELETE\s+FROM)\s+{id}`)

/**
 * Statements that change nothing a second run could get wrong: transaction
 * brackets, connection pragmas, an integrity probe, and Postgres enum work,
 * which `buddy migrate` guards before running (`guardPostgresEnumTypes`) - an
 * enum type also survives the drop of the table that used it, so re-creating
 * it has to be a no-op anyway.
 */
const NEUTRAL = /^(?:BEGIN|COMMIT|END|PRAGMA|SET|SELECT\s+1|COMMENT\s+ON|CREATE\s+TYPE\s+\S+\s+AS\s+ENUM|ALTER\s+TYPE\s+\S+\s+ADD\s+VALUE|STACKS_ENUM_GUARD)\b/i

function statementShape(statement: string, indexTables: ReadonlyMap<string, string>): StatementShape {
  const lower = (name: string | undefined): string => (name ?? '').toLowerCase()

  if (NEUTRAL.test(statement))
    return { modifies: [] }

  let m = RENAME_TABLE.exec(statement)
  if (m)
    return { modifies: [lower(m[1]), lower(m[2])], rename: { from: lower(m[1]), to: lower(m[2]) } }

  m = CREATE_TABLE.exec(statement)
  if (m)
    return { modifies: [lower(m[1])], creates: lower(m[1]) }

  m = DROP_TABLE.exec(statement)
  if (m)
    return { modifies: [lower(m[1])], drops: lower(m[1]) }

  m = ALTER_TABLE.exec(statement)
  if (m)
    return { modifies: [lower(m[1])] }

  m = CREATE_INDEX.exec(statement)
  if (m)
    return { modifies: [lower(m[2])], index: { name: lower(m[1]), table: lower(m[2]) } }

  m = DROP_INDEX.exec(statement)
  if (m) {
    const table = m[2] ? lower(m[2]) : indexTables.get(lower(m[1]))
    return table ? { modifies: [table] } : { modifies: [], unknown: true }
  }

  m = DML.exec(statement)
  if (m)
    return { modifies: [lower(m[1])] }

  return { modifies: [], unknown: true }
}

/**
 * The statements of a migration file, with Postgres's guarded `DO` blocks
 * folded into one opaque statement first: they contain semicolons of their
 * own, which a plain split would cut into fragments nothing recognises.
 */
function requeueStatements(sql: string): string[] {
  const folded = stripForEffects(sql).replace(
    /\bDO\s+\$(\w*)\$([\s\S]*?)\$\1\$/gi,
    (block, _tag: string, body: string) =>
      /^\s*BEGIN\s+CREATE\s+TYPE\b[\s\S]*\bEXCEPTION\s+WHEN\s+duplicate_object\s+THEN\s+null\s*;\s*END\s*$/i.test(body)
        ? 'STACKS_ENUM_GUARD'
        : block,
  )
  return folded.split(';').map(statement => statement.trim()).filter(Boolean)
}

/**
 * What the runner hides for disabled features: whole files, and statements
 * against their tables inside files it keeps (the catch-all `auto-misc`
 * migration holds alters for every table). Anything that replays the corpus on
 * paper has to apply the same gate, or it expects tables no run will create.
 * Built by `featureGateForLedger()` in `migrations.ts`, which owns the gate.
 */
export interface CorpusGate {
  exclude: ReadonlySet<string>
  rewrite: (sql: string) => string
}

/**
 * The gate to audit with: the caller's, or - when auditing the configured
 * corpus rather than a directory the caller named - the runner's own, so
 * `migrate:status`, `doctor` and the dashboard all see what `migrate` sees.
 * Imported lazily: `migrations.ts` imports this module.
 */
async function resolveGate(options: { gate?: CorpusGate, dir?: string }, dir: string): Promise<CorpusGate | undefined> {
  if (options.gate || options.dir)
    return options.gate
  try {
    const { featureGateForLedger } = await import('./migrations')
    return await featureGateForLedger(dir)
  }
  catch {
    return undefined
  }
}

export interface RequeuePlan {
  /** Tables the corpus creates and leaves in place, but the database lacks. */
  missing: string[]
  /** Recorded files to un-record, in the order the next migrate runs them. */
  requeue: string[]
  /** Missing tables that cannot be rebuilt this way, with why. */
  refused: Array<{ table: string, reason: string }>
}

/**
 * Which recorded migrations to un-record so `buddy migrate` rebuilds the
 * tables the database is missing (stacksjs/stacks#2860).
 *
 * The ledger says the table was created and it is not there - dropped by
 * hand, lost in a restore, or never created by a runner that recorded it
 * anyway. `migrate` skips the file because it is recorded, and the only way
 * back used to be `migrate:fresh`, which drops every other table to recreate
 * one.
 *
 * Re-running is safe exactly when it can only rebuild what is missing, so a
 * table is requeued as its WHOLE history or not at all:
 *
 *   - every file that ever touched it, in order, because a later file may
 *     rebuild or alter what an earlier one created, and replaying only the
 *     last one fails on a table that does not exist yet;
 *   - and only when each of those files changes nothing but missing tables
 *     and the scaffolding it creates and removes itself. A file that also
 *     alters a table that is still there, or writes data to one, has already
 *     run once against it, and a second run is not ours to decide.
 *
 * Pure: works from the corpus and the set of live tables, so it can be
 * exercised without a database.
 */
export function planRequeue(
  files: ReadonlyArray<{ file: string, sql: string, recorded: boolean }>,
  liveTables: ReadonlySet<string>,
): RequeuePlan {
  const ordered = [...files].sort((a, b) => a.file.localeCompare(b.file))
  const indexTables = new Map<string, string>()
  const expected = new Set<string>()

  // Names joined by a rename are one table's history: `a` renamed to `b` is
  // rebuilt by replaying the file that created `a`, too.
  const lineageOf = new Map<string, Set<string>>()
  const lineage = (table: string): Set<string> => {
    let group = lineageOf.get(table)
    if (!group) {
      group = new Set([table])
      lineageOf.set(table, group)
    }
    return group
  }
  const link = (a: string, b: string): void => {
    const merged = new Set([...lineage(a), ...lineage(b)])
    for (const name of merged)
      lineageOf.set(name, merged)
  }

  // Replay the corpus on paper: which tables does it leave in place, and
  // what does each file touch?
  const shapes = ordered.map(({ file, sql, recorded }) => {
    const statements = requeueStatements(sql).map(statement => statementShape(statement, indexTables))
    for (const shape of statements) {
      if (shape.index)
        indexTables.set(shape.index.name, shape.index.table)
      if (shape.creates)
        expected.add(shape.creates)
      if (shape.drops)
        expected.delete(shape.drops)
      if (shape.rename) {
        expected.delete(shape.rename.from)
        expected.add(shape.rename.to)
        link(shape.rename.from, shape.rename.to)
      }
    }

    // Scaffolding: a table this file creates and also drops or renames away.
    const created = new Set(statements.flatMap(shape => shape.creates ? [shape.creates] : []))
    const removed = new Set(statements.flatMap(shape => [shape.drops, shape.rename?.from].filter((t): t is string => Boolean(t))))
    const scaffold = new Set([...created].filter(table => removed.has(table) || statements.some(shape => shape.rename?.from === table)))

    return {
      file,
      recorded,
      unknown: statements.some(shape => shape.unknown),
      modifies: new Set(statements.flatMap(shape => shape.modifies)),
      scaffold,
    }
  })

  const missing = [...expected].filter(table => !liveTables.has(table)).sort()

  // What a requeued file may touch: a missing table under any of the names it
  // has had, provided none of those names is a table the database has now.
  const rebuildable = new Set(missing.flatMap(table => [...lineage(table)]).filter(table => !liveTables.has(table)))
  const chains = new Map(missing.map((table) => {
    const names = lineage(table)
    return [table, shapes.filter(shape => [...shape.modifies].some(name => names.has(name)))]
  }))

  const why = new Map<string, string>()
  for (const [table, chain] of chains) {
    for (const shape of chain) {
      if (shape.unknown) {
        why.set(table, `${shape.file} contains a statement the planner cannot classify`)
        break
      }
      const elsewhere = [...shape.modifies].filter(t => !rebuildable.has(t) && !shape.scaffold.has(t))
      if (elsewhere.length > 0) {
        why.set(table, `${shape.file} also changes ${elsewhere.join(', ')}, which ${elsewhere.length === 1 ? 'is' : 'are'} not missing`)
        break
      }
    }
  }

  // A file shared between two missing tables can only be requeued if both
  // can, so one refusal can refuse the other. Repeat until nothing changes.
  let changed = true
  while (changed) {
    changed = false
    for (const [table, chain] of chains) {
      if (why.has(table))
        continue
      const blocker = chain.flatMap(shape => [...shape.modifies]).find(other => other !== table && missing.some(t => why.has(t) && lineage(t).has(other)))
      if (blocker) {
        why.set(table, `shares a migration with ${blocker}, which cannot be rebuilt`)
        changed = true
      }
    }
  }

  const requeue = new Set<string>()
  for (const [table, chain] of chains) {
    if (why.has(table))
      continue
    for (const shape of chain) {
      if (shape.recorded)
        requeue.add(shape.file)
    }
  }

  return {
    missing,
    requeue: ordered.map(({ file }) => file).filter(file => requeue.has(file)),
    refused: [...why].map(([table, reason]) => ({ table, reason })),
  }
}

/**
 * Tables the RECORDED migrations create and leave in place, which the
 * database does not have (stacksjs/stacks#2860).
 *
 * The model drift probe only knows the app's own models, so a framework table
 * - or any table in an app with no `app/Models` - could vanish without a word,
 * while `buddy migrate` skipped its recorded file and reported the database up
 * to date. This asks the ledger instead: everything it says ran, replayed on
 * paper, against what is actually there, through the same feature gate the
 * runner applies (see {@link CorpusGate}).
 */
export async function auditMissingTables(options: {
  dir?: string
  dialect?: LedgerDialect
  run?: SqlRunner
  gate?: CorpusGate
} = {}): Promise<{ supported: boolean, missing: string[], live: Set<string> }> {
  const dialect = options.dialect ?? await currentDialect()
  if (dialect === 'other')
    return { supported: false, missing: [], live: new Set() }

  const dir = migrationsDir(options.dir)
  const run = options.run ?? await defaultRunner()
  const recorded = new Set(await readLedger(run))
  const gate = await resolveGate(options, dir)
  const files = listMigrationFiles(dir)
    .filter(file => recorded.has(file) && !gate?.exclude.has(file))
    .flatMap((file) => {
      try {
        const sql = readFileSync(join(dir, file), 'utf8')
        return [{ file, sql: gate ? gate.rewrite(sql) : sql, recorded: true }]
      }
      catch {
        return []
      }
    })

  const live = await readLiveSchema(dialect, run)
  return { supported: true, missing: planRequeue(files, live.tables).missing, live: live.tables }
}

/**
 * Bring the ledger back in line with what the schema proves.
 *
 * Two operations, both conservative:
 *
 *   1. **Remap** a ledger row onto its renumbered file. Nothing runs; only the
 *      recorded name changes. This is the direct undo of #2203.
 *   2. **Record** a `stranded` file — one whose every effect is already in the
 *      schema — so the runner stops treating it as pending.
 *
 * Everything else is refused and reported. `partial` files have half-applied
 * effects and no safe automatic answer; `unverifiable` ones (pure DML, like the
 * `DELETE FROM oauth_access_tokens` token revocation in the shipped corpus)
 * leave no trace to check, and recording one on a hunch would skip a migration
 * that never ran. Those are exactly the cases worth a human's attention, which
 * is why they are listed rather than silently handled.
 */
/** The disk file a superseded ledger row duplicates, by logical name. */
function byLogicalOnDisk(row: string, diskFiles: string[]): string | undefined {
  const key = logicalName(row)
  const matches = diskFiles.filter(f => logicalName(f) === key)
  return matches.length === 1 ? matches[0] : undefined
}

export async function reconcileMigrationLedger(options: {
  dir?: string
  /** Report what would change without writing. */
  dryRun?: boolean
  /** Also record `partial` files. Off by default, and rarely right. */
  includePartial?: boolean
  /**
   * Un-record the migrations that built a table the database is missing (see
   * {@link planRequeue}), so the next `buddy migrate` rebuilds it. The one
   * repair for "the ledger says this table was created, and it is not there"
   * short of `migrate:fresh`, which drops everything else with it.
   */
  requeueReverted?: boolean
  /** The runner's feature gate, so requeueing never plans around a hidden file. */
  gate?: CorpusGate
  /** Reconcile a specific dialect instead of the configured one. */
  dialect?: LedgerDialect
  /** Reconcile a database other than the process-wide one. */
  run?: SqlRunner
} = {}): Promise<ReconcileResult> {
  const run = options.run ?? await defaultRunner()
  const gate = await resolveGate(options, migrationsDir(options.dir))
  const audit = await auditMigrationLedger({ dir: options.dir, dialect: options.dialect, run, gate })
  const result: ReconcileResult = { remapped: [], recorded: [], pruned: [], requeued: [], skipped: [] }
  if (!audit.supported) {
    result.skipped.push({ file: '*', reason: `dialect "${audit.dialect}" is not audited` })
    return result
  }

  const plan = audit.remapPlan

  for (const row of plan.ambiguous)
    result.skipped.push({ file: row, reason: 'ledger row matches more than one file by logical name' })
  for (const row of plan.dropped)
    result.skipped.push({ file: row, reason: 'recorded migration no longer exists on disk' })

  // Safe because the migration remains recorded under its current filename:
  // this deletes the stale spelling, never the last record of a migration.
  const prunable = plan.superseded.filter(row => SAFE_MIGRATION_FILE.test(row))
  for (const row of plan.superseded.filter(row => !SAFE_MIGRATION_FILE.test(row)))
    result.skipped.push({ file: row, reason: 'ledger row is not safe to write to the ledger' })

  const toRecord: string[] = []
  const revertedEntries: MigrationLedgerEntry[] = []
  for (const entry of audit.entries) {
    if (entry.status === 'stranded') {
      toRecord.push(entry.file)
      continue
    }
    if (entry.status === 'partial') {
      if (options.includePartial) {
        toRecord.push(entry.file)
        continue
      }
      result.skipped.push({
        file: entry.file,
        reason: `${entry.present.length}/${entry.effects.length} effects present - resolve by hand, or pass --include-partial`,
      })
      continue
    }
    if (entry.status === 'reverted')
      revertedEntries.push(entry)
  }

  const toRequeue: string[] = []
  if (options.requeueReverted) {
    const live = await readLiveSchema(audit.dialect as LedgerDialect, run)
    const recordedFiles = new Set(audit.entries.filter(entry => entry.recorded).map(entry => entry.file))
    // Entries already exclude gated files (see auditMigrationLedger).
    const corpus = audit.entries.flatMap((entry) => {
      try {
        const sql = readFileSync(join(audit.dir, entry.file), 'utf8')
        return [{ file: entry.file, sql: gate ? gate.rewrite(sql) : sql, recorded: recordedFiles.has(entry.file) }]
      }
      catch {
        return []
      }
    })
    const plan = planRequeue(corpus, live.tables)
    toRequeue.push(...plan.requeue)
    for (const { table, reason } of plan.refused)
      result.skipped.push({ file: table, reason: `missing table not rebuilt: ${reason}` })
  }

  // Reported after the requeue plan, so a file it is about to re-run is not
  // also listed as left alone.
  for (const entry of revertedEntries.filter(entry => !toRequeue.includes(entry.file))) {
    result.skipped.push({
      file: entry.file,
      reason: options.requeueReverted
        ? `recorded, but ${entry.absent.length} effect(s) are missing from the schema`
        : `recorded, but ${entry.absent.length} effect(s) are missing from the schema - --requeue-reverted rebuilds a table that is gone entirely`,
    })
  }

  // Anything the ledger writers would refuse is dropped HERE, before any write
  // happens. Throwing partway through would leave the ledger half-repaired,
  // which is a worse state than the drift it was called to fix. Ledger rows in
  // particular come out of the database, so they are not guaranteed to look
  // like anything this ever wrote.
  const unsafe = (file: string): boolean => !SAFE_MIGRATION_FILE.test(file)
  for (const { from, to } of plan.remap.filter(r => unsafe(r.from) || unsafe(r.to)))
    result.skipped.push({ file: unsafe(from) ? from : to, reason: 'migration filename is not safe to write to the ledger' })
  for (const file of toRecord.filter(unsafe))
    result.skipped.push({ file, reason: 'migration filename is not safe to write to the ledger' })

  // A remap changes the row a later record would collide with, so it goes
  // first. Ordering matters only in the dry run's report, but a report that
  // does not match the write order is its own trap.
  const remapped = plan.remap.filter(r => !unsafe(r.from) && !unsafe(r.to))
  const recordable = toRecord.filter(file => !unsafe(file) && !remapped.some(r => r.to === file))

  const requeueable = toRequeue.filter(file => !unsafe(file))
  for (const file of toRequeue.filter(unsafe))
    result.skipped.push({ file, reason: 'migration filename is not safe to write to the ledger' })

  if (options.dryRun) {
    result.remapped = remapped
    result.recorded = recordable
    result.pruned = prunable
    result.requeued = requeueable
    return result
  }

  await ensureLedgerTable(audit.dialect as LedgerDialect, run)

  for (const { from, to } of remapped) {
    await run(`UPDATE migrations SET migration = '${to}' WHERE migration = '${from}'`)
    result.remapped.push({ from, to })
  }

  for (const file of recordable) {
    // The row may already exist when a remap just landed on it; a duplicate
    // insert against the UNIQUE index would abort the rest of the run.
    const existing = await run(`SELECT migration FROM migrations WHERE migration = '${file}'`)
    if (existing.length > 0) continue
    await run(`INSERT INTO migrations (migration) VALUES ('${file}')`)
    result.recorded.push(file)
  }

  /*
   * Deletions go LAST, and each one re-checks that the row it duplicates is
   * really present first.
   *
   * The planner already established that, but it read the ledger before the
   * writes above; re-reading here means a delete can only ever remove the
   * second record of a migration, never the only one. Getting this wrong
   * would silently queue a migration to re-run against a live database, which
   * is the exact failure this whole command exists to prevent.
   */
  for (const row of prunable) {
    const survivor = byLogicalOnDisk(row, audit.entries.map(e => e.file))
    if (!survivor) continue
    const kept = await run(`SELECT migration FROM migrations WHERE migration = '${survivor}'`)
    if (kept.length === 0) {
      result.skipped.push({ file: row, reason: `would leave ${survivor} unrecorded` })
      continue
    }
    await run(`DELETE FROM migrations WHERE migration = '${row}'`)
    result.pruned.push(row)
  }

  // Last, and only rows the audit classified a moment ago: deleting one is
  // what makes the next `buddy migrate` run that file again.
  for (const file of requeueable) {
    await run(`DELETE FROM migrations WHERE migration = '${file}'`)
    result.requeued.push(file)
  }

  return result
}
