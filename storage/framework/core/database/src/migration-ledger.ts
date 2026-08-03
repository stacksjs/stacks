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
 *   1. `database/migrations/*.sql` — what the corpus says should exist
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

    const index = new RegExp(String.raw`^CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?${IDENT}`, 'i').exec(statement)
    if (index?.[1]) {
      push({ kind: 'index', name: index[1] })
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
  return async (sql: string) => rowsOf(await (db as any).unsafe(sql).execute())
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
    case 'index':
      return schema.indexes.has(name)
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
  return dir ?? join(process.cwd(), 'database', 'migrations')
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
  const targets = new Map<string, string[]>()

  for (const row of ledger) {
    if (onDisk.has(row)) continue
    const candidates = (byLogical.get(logicalName(row)) ?? []).filter(f => !claimed.has(f))
    if (candidates.length === 0) {
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
    return { remap, ambiguous, dropped }

  return {
    remap: remap.filter(r => !contested.has(r.from)),
    ambiguous: [...ambiguous, ...contested].sort(),
    dropped,
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

  const emptyPlan: LedgerRemapPlan = { remap: [], ambiguous: [], dropped: [] }
  if (dialect === 'other') {
    return { supported: false, dialect, dir, entries: [], orphans: [], counts, recordedCount: 0, remapPlan: emptyPlan, drift: false }
  }

  const run = options.run ?? await defaultRunner()
  const ledger = await readLedger(run)
  const recorded = new Set(ledger)
  const schema = await readLiveSchema(dialect, run)

  const entries: MigrationLedgerEntry[] = []
  for (const file of files) {
    let sql = ''
    try {
      sql = readFileSync(join(dir, file), 'utf8')
    }
    catch {
      continue
    }

    const effects = verifiableEffects(migrationEffects(sql), dialect)
    const present = effects.filter(effect => effectPresent(effect, schema))
    const absent = effects.filter(effect => !effectPresent(effect, schema))
    const isRecorded = recorded.has(file)
    const status = classifyMigration(isRecorded, present, absent)
    counts[status] += 1
    entries.push({ file, logical: logicalName(file), recorded: isRecorded, status, effects, present, absent })
  }

  // Planned against the files that were actually READ, which is what the
  // classification above used. Planning against the raw directory listing
  // instead would let an unreadable file produce a remap target that has no
  // entry, so the audit's report and the reconciler's actions could disagree.
  const readable = entries.map(entry => entry.file)
  const remapPlan = planLedgerRemap(ledger, readable)
  const renamedTo = new Map(remapPlan.remap.map(r => [r.from, r.to]))
  const orphans: LedgerOrphan[] = ledger
    .filter(row => !readable.includes(row))
    .map(row => ({ migration: row, renamedTo: renamedTo.get(row) }))

  const drift = counts.stranded > 0 || counts.partial > 0 || counts.reverted > 0 || orphans.length > 0

  return { supported: true, dialect, dir, entries, orphans, counts, recordedCount: ledger.length, remapPlan, drift }
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
  await run(
    `CREATE TABLE IF NOT EXISTS migrations (${id}, migration VARCHAR(255) NOT NULL UNIQUE, executed_at ${timestamp} DEFAULT CURRENT_TIMESTAMP)`,
  )
}

export interface ReconcileResult {
  /** Ledger rows rewritten from an old filename to its renumbered one. */
  remapped: LedgerRemap[]
  /** Files recorded as applied because every effect was already present. */
  recorded: string[]
  /** Things the reconciler refused to touch, with why. */
  skipped: Array<{ file: string, reason: string }>
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
export async function reconcileMigrationLedger(options: {
  dir?: string
  /** Report what would change without writing. */
  dryRun?: boolean
  /** Also record `partial` files. Off by default, and rarely right. */
  includePartial?: boolean
  /** Reconcile a specific dialect instead of the configured one. */
  dialect?: LedgerDialect
  /** Reconcile a database other than the process-wide one. */
  run?: SqlRunner
} = {}): Promise<ReconcileResult> {
  const run = options.run ?? await defaultRunner()
  const audit = await auditMigrationLedger({ dir: options.dir, dialect: options.dialect, run })
  const result: ReconcileResult = { remapped: [], recorded: [], skipped: [] }
  if (!audit.supported) {
    result.skipped.push({ file: '*', reason: `dialect "${audit.dialect}" is not audited` })
    return result
  }

  const plan = audit.remapPlan

  for (const row of plan.ambiguous)
    result.skipped.push({ file: row, reason: 'ledger row matches more than one file by logical name' })
  for (const row of plan.dropped)
    result.skipped.push({ file: row, reason: 'recorded migration no longer exists on disk' })

  const toRecord: string[] = []
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
        reason: `${entry.present.length}/${entry.effects.length} effects present — resolve by hand, or pass --include-partial`,
      })
      continue
    }
    if (entry.status === 'reverted') {
      result.skipped.push({
        file: entry.file,
        reason: `recorded, but ${entry.absent.length} effect(s) are missing from the schema`,
      })
    }
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

  if (options.dryRun) {
    result.remapped = remapped
    result.recorded = recordable
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

  return result
}
