import type { Model } from '@stacksjs/types'
import { existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { plural, singular, snakeCase } from '@stacksjs/strings'
import { path } from '@stacksjs/path'
import { globSync } from '@stacksjs/storage'

/**
 * Glob, but resilient to "directory doesn't exist yet" (the userland
 * `app/Models/` directory in particular often doesn't exist when the
 * audit runs in framework tests or scaffolded apps that haven't
 * created any models yet). Avoids the Bun Glob ENOENT.
 */
export function safeGlob(pattern: string): string[] {
  // Pull off the prefix up to the first glob metachar; if that root
  // dir doesn't exist, skip the glob entirely.
  const metaIdx = pattern.search(/[*?[]/)
  const root = metaIdx === -1 ? dirname(pattern) : dirname(pattern.slice(0, metaIdx))
  if (!existsSync(root)) return []
  try {
    return globSync(pattern, { absolute: true })
  }
  catch {
    return []
  }
}

// stacksjs/stacks#1916 — Foreign-key audit. Compares each model's
// declared `belongsTo` relationships against the FKs that actually
// exist in the live database. Drives `buddy doctor`'s FK integrity
// check, surfaces the "you flipped DB_CONNECTION but the FKs didn't
// follow" failure mode that motivated #1915 and #1916.
//
// Two halves:
//
//   1. Declared FKs: walk model files, look at `belongsTo`, compute
//      the implied FK shape `{ fromTable, fromColumn, toTable,
//      toColumn }`. Convention is `<related>_id` → `<related>.id`,
//      same as the migration generator.
//
//   2. Live FKs: query the live database. SQLite via
//      `PRAGMA foreign_key_list("…")`, MySQL/Postgres via
//      `information_schema.key_column_usage`.

export interface DeclaredFK {
  fromTable: string
  fromColumn: string
  toTable: string
  toColumn: string
  model: string
}

export interface LiveFK {
  fromTable: string
  fromColumn: string
  toTable: string
  toColumn: string
}

export interface FkAuditResult {
  declared: DeclaredFK[]
  live: LiveFK[]
  /** Declared FKs that are NOT present in the live database. */
  missing: DeclaredFK[]
}

/**
 * Walk every model file (user + framework defaults) and return the
 * full list of declared `belongsTo` foreign keys.
 *
 * Convention: `Comment` with `belongsTo: ['Post']` implies the FK
 * `comments.post_id → posts.id`. Same shape the migration generator
 * uses, so we keep it consistent here. Other relationship types
 * (`hasOne`, `hasMany`, `belongsToMany` through tables) imply FKs in
 * the *other* direction or in pivot tables — we only check
 * `belongsTo` here for the simplest, highest-signal audit.
 */
export async function getDeclaredFKs(): Promise<DeclaredFK[]> {
  const modelFiles = [
    ...safeGlob(path.userModelsPath('*.ts')),
    ...safeGlob(path.storagePath('framework/defaults/app/Models/**/*.ts')),
  ]

  const declared: DeclaredFK[] = []
  for (const modelFile of modelFiles) {
    let model: Model
    try {
      model = (await import(modelFile)).default as Model
    }
    catch {
      // A model file with a syntax error or missing dep shouldn't
      // crash the whole audit — skip and move on. Other doctor
      // checks (typecheck, lint) will catch the underlying issue.
      continue
    }
    if (!model || typeof model !== 'object') continue

    const fromTable = (model.table as string) || plural(snakeCase((model.name as string) || ''))
    const belongsTo = (model as { belongsTo?: unknown }).belongsTo

    if (Array.isArray(belongsTo)) {
      for (const entry of belongsTo) {
        const related = typeof entry === 'string' ? entry : ((entry as { model?: string })?.model ?? '')
        if (!related) continue
        const fromColumn = `${snakeCase(singular(related))}_id`
        const toTable = plural(snakeCase(related))
        declared.push({
          fromTable,
          fromColumn,
          toTable,
          toColumn: 'id',
          model: (model.name as string) || '',
        })
      }
    }
    else if (belongsTo && typeof belongsTo === 'object') {
      // Object form: `belongsTo: { Post: 'Post', User: 'User' }`
      // (the `as any` shape some scaffolds emit). Each key is a
      // related model name.
      for (const related of Object.keys(belongsTo)) {
        const fromColumn = `${snakeCase(singular(related))}_id`
        const toTable = plural(snakeCase(related))
        declared.push({
          fromTable,
          fromColumn,
          toTable,
          toColumn: 'id',
          model: (model.name as string) || '',
        })
      }
    }
  }

  return declared
}

/**
 * Query the live database for every foreign key constraint, returning
 * a normalised shape. Dialect-aware: PRAGMA on SQLite,
 * information_schema on MySQL / PostgreSQL.
 */
export async function getLiveFKs(): Promise<LiveFK[]> {
  const { db } = await import('./utils')
  const dialect = await currentDialect()

  if (dialect === 'sqlite')
    return getSqliteLiveFKs(db)
  if (dialect === 'mysql')
    return getMysqlLiveFKs(db)
  if (dialect === 'postgres')
    return getPostgresLiveFKs(db)

  return []
}

/**
 * Diff declared FKs against live FKs. Returns the declared FKs that
 * have no matching row in the live database — these are the silent
 * "FK should be enforcing referential integrity but isn't" cases that
 * motivated this audit.
 *
 * Match key is `fromTable.fromColumn → toTable.toColumn` (case-
 * insensitive). Extra live FKs (present in DB but not in any model)
 * are not reported — those usually come from manual migrations or
 * external tooling, both legitimate.
 */
export async function auditForeignKeys(): Promise<FkAuditResult> {
  const declared = await getDeclaredFKs()
  const live = await getLiveFKs()
  const liveKeys = new Set(
    live.map(fk => `${fk.fromTable.toLowerCase()}.${fk.fromColumn.toLowerCase()}→${fk.toTable.toLowerCase()}.${fk.toColumn.toLowerCase()}`),
  )

  const missing = declared.filter((d) => {
    const key = `${d.fromTable.toLowerCase()}.${d.fromColumn.toLowerCase()}→${d.toTable.toLowerCase()}.${d.toColumn.toLowerCase()}`
    return !liveKeys.has(key)
  })

  return { declared, live, missing }
}

// stacksjs/stacks#1951 — FK orphan detection. FK enforcement flipped
// ON (utils.ts bootstrap pragmas) against databases that were written
// while `foreign_keys = OFF`, so legacy rows can reference parents that
// no longer exist. Those orphans silently turn previously-working
// deletes/inserts into runtime FK failures. This READ-ONLY scan finds
// them so `buddy doctor` can report before they bite.
//
// SQLite-specific: MySQL/Postgres enforce FKs natively, so the
// FK-off-legacy-data failure mode can't arise there — we degrade to
// `supported: false` rather than run an expensive per-FK anti-join.

export interface FkOrphan {
  table: string
  column: string
  parent: string
  count: number
  /** Up to 5 rowids of offending child rows, for triage. */
  sampleRowids: number[]
}

export interface FkOrphanReport {
  /** False on non-sqlite dialects (FKs enforced natively). */
  supported: boolean
  total: number
  orphans: FkOrphan[]
}

/**
 * Scan the live database for rows whose foreign key references a
 * parent row that doesn't exist. SQLite's `PRAGMA foreign_key_check`
 * does this regardless of the `foreign_keys` pragma state and excludes
 * NULL-FK rows. The violating column is resolved by joining the
 * reported `fkid` against `PRAGMA foreign_key_list(table)`.
 */
export async function findFkOrphans(dialect?: 'sqlite' | 'mysql' | 'postgres' | 'other'): Promise<FkOrphanReport> {
  const d = dialect ?? await currentDialect()
  if (d !== 'sqlite')
    return { supported: false, total: 0, orphans: [] }

  const { db } = await import('./utils')
  const rows = await db.unsafe('PRAGMA foreign_key_check').execute()
  const checkRows = Array.isArray(rows) ? rows : []

  // Cache `foreign_key_list` per table so we resolve fkid → column once.
  const fkListCache = new Map<string, any[]>()
  async function fkListFor(table: string): Promise<any[]> {
    if (fkListCache.has(table)) return fkListCache.get(table)!
    if (!/^[a-z_]\w*$/i.test(table)) {
      fkListCache.set(table, [])
      return []
    }
    const list = await db.unsafe(`PRAGMA foreign_key_list("${table}")`).execute()
    const arr = Array.isArray(list) ? list : []
    fkListCache.set(table, arr)
    return arr
  }

  // Group by table+parent+fkid; accumulate counts and sample rowids.
  const grouped = new Map<string, FkOrphan>()
  for (const raw of checkRows) {
    const r = raw as { table?: string, rowid?: number, parent?: string, fkid?: number }
    const table = String(r.table ?? '')
    const parent = String(r.parent ?? '')
    if (!table || !parent) continue
    const fkid = Number(r.fkid ?? 0)

    let column = ''
    const fkList = await fkListFor(table)
    for (const fk of fkList) {
      const f = fk as { id?: number, from?: string }
      if (Number(f.id) === fkid && f.from) {
        column = String(f.from)
        break
      }
    }

    const key = `${table} ${parent} ${fkid}`
    let entry = grouped.get(key)
    if (!entry) {
      entry = { table, column, parent, count: 0, sampleRowids: [] }
      grouped.set(key, entry)
    }
    entry.count++
    if (entry.sampleRowids.length < 5 && typeof r.rowid === 'number')
      entry.sampleRowids.push(r.rowid)
  }

  const orphans = [...grouped.values()]
  const total = orphans.reduce((sum, o) => sum + o.count, 0)
  return { supported: true, total, orphans }
}

async function currentDialect(): Promise<'sqlite' | 'mysql' | 'postgres' | 'other'> {
  const env = await import('@stacksjs/env')
  const driver = ((env as { env?: { DB_CONNECTION?: string } }).env?.DB_CONNECTION ?? 'sqlite').toLowerCase()
  if (driver === 'sqlite' || driver === 'mysql' || driver === 'postgres') return driver
  return 'other'
}

async function getSqliteLiveFKs(db: any): Promise<LiveFK[]> {
  // List tables, then enumerate FKs per table via PRAGMA. PRAGMA
  // foreign_key_list returns columns `id, seq, table, from, to,
  // on_update, on_delete, match`. We ignore composite keys (seq > 0)
  // for simplicity — Stacks doesn't generate composite FKs.
  const tables = await db.unsafe(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`)
  const rows = Array.isArray(tables) ? tables : []
  const fks: LiveFK[] = []
  for (const row of rows) {
    const fromTable = (row as { name?: string }).name
    if (!fromTable) continue
    // Identifier injection guard — only allow alphanumerics + underscore.
    if (!/^[a-z_][\w]*$/i.test(fromTable)) continue
    const fkRows = await db.unsafe(`PRAGMA foreign_key_list("${fromTable}")`)
    for (const fk of (Array.isArray(fkRows) ? fkRows : [])) {
      const r = fk as { from?: string, to?: string, table?: string, seq?: number }
      if ((r.seq ?? 0) !== 0) continue
      if (!r.from || !r.to || !r.table) continue
      fks.push({ fromTable, fromColumn: r.from, toTable: r.table, toColumn: r.to })
    }
  }
  return fks
}

async function getMysqlLiveFKs(db: any): Promise<LiveFK[]> {
  // MySQL: information_schema.KEY_COLUMN_USAGE. Filter by current
  // schema and only FK rows (REFERENCED_TABLE_NAME present).
  const rows = await db.unsafe(`
    SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND REFERENCED_TABLE_NAME IS NOT NULL
  `)
  return (Array.isArray(rows) ? rows : []).map((row: any) => ({
    fromTable: String(row.TABLE_NAME ?? row.table_name ?? ''),
    fromColumn: String(row.COLUMN_NAME ?? row.column_name ?? ''),
    toTable: String(row.REFERENCED_TABLE_NAME ?? row.referenced_table_name ?? ''),
    toColumn: String(row.REFERENCED_COLUMN_NAME ?? row.referenced_column_name ?? ''),
  })).filter((fk: LiveFK) => fk.fromTable && fk.fromColumn && fk.toTable && fk.toColumn)
}

async function getPostgresLiveFKs(db: any): Promise<LiveFK[]> {
  // PostgreSQL: join referential_constraints with key_column_usage
  // and constraint_column_usage to walk the FK → referenced-column
  // mapping. Scoped to the `public` schema and `current_database()`.
  const rows = await db.unsafe(`
    SELECT
      kcu.table_name AS from_table,
      kcu.column_name AS from_column,
      ccu.table_name AS to_table,
      ccu.column_name AS to_column
    FROM information_schema.referential_constraints rc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = rc.constraint_name
    AND kcu.constraint_schema = rc.constraint_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = rc.constraint_name
    AND ccu.constraint_schema = rc.constraint_schema
    WHERE rc.constraint_schema = 'public'
  `)
  return (Array.isArray(rows) ? rows : []).map((row: any) => ({
    fromTable: String(row.from_table ?? ''),
    fromColumn: String(row.from_column ?? ''),
    toTable: String(row.to_table ?? ''),
    toColumn: String(row.to_column ?? ''),
  })).filter((fk: LiveFK) => fk.fromTable && fk.fromColumn && fk.toTable && fk.toColumn)
}
