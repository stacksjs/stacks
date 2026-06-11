import type { Model } from '@stacksjs/types'
import { path } from '@stacksjs/path'
import { plural, snakeCase } from '@stacksjs/strings'
import { safeGlob } from './fk-audit'

// stacksjs/stacks#1952 — Unique-index drift audit. Compares each
// model's declared uniqueness (`unique: true` attributes and
// `unique: true` composite indexes) against the UNIQUE indexes that
// actually exist in the live database.
//
// This is the `buddy doctor` companion to the migrate-side self-heal
// (#1952): `buddy migrate` already re-queues missing unique-index
// migrations, but that only fires when you run migrate, doesn't help
// apps scaffolded during the stub era (whose own repos carry
// `SELECT 1;` stub migrations), and hard-fails mid-migrate on
// pre-existing duplicate rows instead of reporting first. This audit
// surfaces the drift read-only, before you migrate.
//
// Matching is by COLUMN SET, never by index name — the generator
// emits names like `users_users_email_unique` while migration
// filenames say `users_email_unique`, so names are not stable.

export interface DeclaredUnique {
  table: string
  columns: string[]
  model: string
  source: 'attribute' | 'index'
  indexName?: string
}

export interface LiveUniqueIndex {
  table: string
  name: string
  columns: string[]
}

export interface UniqueAuditResult {
  /** False when the live dialect isn't one we audit (e.g. dynamodb). */
  supported: boolean
  declared: DeclaredUnique[]
  live: LiveUniqueIndex[]
  /** Declared uniques whose table exists but has no matching UNIQUE index. */
  missing: DeclaredUnique[]
  /** Declared uniques whose table doesn't exist in the live DB yet. */
  skippedTables: string[]
}

/**
 * Walk every model file (user + framework defaults) and return the
 * full list of declared unique constraints — both single-column
 * `unique: true` attributes and `unique: true` composite indexes.
 */
export async function getDeclaredUniques(): Promise<DeclaredUnique[]> {
  const modelFiles = [
    ...safeGlob(path.userModelsPath('*.ts')),
    ...safeGlob(path.storagePath('framework/defaults/app/Models/**/*.ts')),
  ]

  const declared: DeclaredUnique[] = []
  for (const modelFile of modelFiles) {
    let model: Model
    try {
      model = (await import(modelFile)).default as Model
    }
    catch {
      // A model file with a syntax error or missing dep shouldn't
      // crash the whole audit — skip and move on, same as fk-audit.
      continue
    }
    if (!model || typeof model !== 'object') continue

    const table = (model.table as string) || plural(snakeCase((model.name as string) || ''))
    const modelName = (model.name as string) || ''

    const attributes = (model as { attributes?: Record<string, { unique?: boolean }> }).attributes
    if (attributes && typeof attributes === 'object') {
      for (const [field, attr] of Object.entries(attributes)) {
        if (attr && typeof attr === 'object' && attr.unique === true) {
          declared.push({
            table,
            columns: [snakeCase(field)],
            model: modelName,
            source: 'attribute',
          })
        }
      }
    }

    const indexes = (model as { indexes?: Array<{ name?: string, columns?: string[], unique?: boolean }> }).indexes
    if (Array.isArray(indexes)) {
      for (const index of indexes) {
        if (index && index.unique === true && Array.isArray(index.columns) && index.columns.length > 0) {
          declared.push({
            table,
            columns: index.columns.map(c => snakeCase(c)),
            model: modelName,
            source: 'index',
            indexName: index.name,
          })
        }
      }
    }
  }

  return declared
}

/**
 * Query the live database for every UNIQUE index, returning a
 * normalised `{ table, name, columns }` shape. Dialect-aware: PRAGMA
 * on SQLite, information_schema / pg_index on MySQL / PostgreSQL.
 *
 * The optional `dialect` parameter is the test seam — production code
 * leaves it undefined so it's derived from `DB_CONNECTION`.
 */
export async function getLiveUniqueIndexes(dialect?: Dialect): Promise<LiveUniqueIndex[]> {
  const { db } = await import('./utils')
  const d = dialect ?? await currentDialect()

  if (d === 'sqlite')
    return getSqliteLiveUniques(db)
  if (d === 'mysql')
    return getMysqlLiveUniques(db)
  if (d === 'postgres')
    return getPostgresLiveUniques(db)

  return []
}

/**
 * Diff declared unique constraints against live UNIQUE indexes. A
 * declared entry is satisfied iff some live unique index on the same
 * table has an equal column SET (sorted, case-insensitive). Declared
 * entries whose table is absent from the live DB go to `skippedTables`
 * (feature-gated commerce/CMS models legitimately have no table yet)
 * rather than `missing`.
 */
export async function auditUniqueIndexes(dialect?: Dialect): Promise<UniqueAuditResult> {
  const d = dialect ?? await currentDialect()
  if (d !== 'sqlite' && d !== 'mysql' && d !== 'postgres')
    return { supported: false, declared: [], live: [], missing: [], skippedTables: [] }

  const declared = await getDeclaredUniques()
  const live = await getLiveUniqueIndexes(d)
  // Table existence is determined independently of unique indexes — a
  // migrated table with zero unique indexes still EXISTS, so a declared
  // unique on it must count as `missing`, not `skipped`.
  const liveTables = await getLiveTables(d)

  // Per-table set of live unique column-sets (each as a sorted,
  // lower-cased, comma-joined key) for O(1) membership testing.
  const liveByTable = new Map<string, Set<string>>()
  for (const idx of live) {
    const t = idx.table.toLowerCase()
    const key = columnSetKey(idx.columns)
    if (!liveByTable.has(t)) liveByTable.set(t, new Set())
    liveByTable.get(t)!.add(key)
  }

  const missing: DeclaredUnique[] = []
  const skippedTables = new Set<string>()

  for (const decl of declared) {
    const t = decl.table.toLowerCase()
    if (!liveTables.has(t)) {
      skippedTables.add(decl.table)
      continue
    }
    const key = columnSetKey(decl.columns)
    if (!(liveByTable.get(t)?.has(key) ?? false))
      missing.push(decl)
  }

  return { supported: true, declared, live, missing, skippedTables: [...skippedTables] }
}

/**
 * Set of (lower-cased) table names that exist in the live database.
 * Used to distinguish "table exists but unique index missing" (a real
 * drift) from "table never migrated" (a feature-gated model — skipped).
 */
async function getLiveTables(dialect: Dialect): Promise<Set<string>> {
  const { db } = await import('./utils')
  let rows: any[] = []
  if (dialect === 'sqlite') {
    const r = await db.unsafe(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`).execute()
    rows = (Array.isArray(r) ? r : []).map((x: any) => x.name)
  }
  else if (dialect === 'mysql') {
    const r = await db.unsafe(`SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()`).execute()
    rows = (Array.isArray(r) ? r : []).map((x: any) => x.name ?? x.TABLE_NAME)
  }
  else if (dialect === 'postgres') {
    const r = await db.unsafe(`SELECT tablename AS name FROM pg_tables WHERE schemaname = 'public'`).execute()
    rows = (Array.isArray(r) ? r : []).map((x: any) => x.name ?? x.tablename)
  }
  return new Set(rows.filter((n: any) => typeof n === 'string' && n.length > 0).map((n: string) => n.toLowerCase()))
}

type Dialect = 'sqlite' | 'mysql' | 'postgres' | 'other'

function columnSetKey(columns: string[]): string {
  return [...columns].map(c => c.toLowerCase()).sort().join(',')
}

async function currentDialect(): Promise<Dialect> {
  const env = await import('@stacksjs/env')
  const driver = ((env as { env?: { DB_CONNECTION?: string } }).env?.DB_CONNECTION ?? 'sqlite').toLowerCase()
  if (driver === 'sqlite' || driver === 'mysql' || driver === 'postgres') return driver
  return 'other'
}

async function getSqliteLiveUniques(db: any): Promise<LiveUniqueIndex[]> {
  // List tables, then enumerate UNIQUE indexes per table. `index_list`
  // returns `{ seq, name, unique, origin, partial }`; we keep every
  // unique===1 row regardless of origin ('u' = inline UNIQUE autoindex,
  // 'c' = explicit CREATE UNIQUE INDEX, 'pk' = primary key). `index_info`
  // returns the index's columns in order.
  const tables = await db.unsafe(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`).execute()
  const rows = Array.isArray(tables) ? tables : []
  const out: LiveUniqueIndex[] = []
  for (const row of rows) {
    const table = (row as { name?: string }).name
    if (!table) continue
    // Identifier injection guard — only allow alphanumerics + underscore.
    if (!/^[a-z_]\w*$/i.test(table)) continue
    const indexRows = await db.unsafe(`PRAGMA index_list("${table}")`).execute()
    for (const idx of (Array.isArray(indexRows) ? indexRows : [])) {
      const r = idx as { name?: string, unique?: number }
      if (Number(r.unique) !== 1 || !r.name) continue
      if (!/^[a-z_]\w*$/i.test(r.name)) continue
      const colRows = await db.unsafe(`PRAGMA index_info("${r.name}")`).execute()
      const columns = (Array.isArray(colRows) ? colRows : [])
        .map((c: any) => String(c.name ?? ''))
        .filter((c: string) => c.length > 0)
      if (columns.length > 0)
        out.push({ table, name: r.name, columns })
    }
  }
  return out
}

async function getMysqlLiveUniques(db: any): Promise<LiveUniqueIndex[]> {
  // MySQL: information_schema.STATISTICS, NON_UNIQUE=0 → unique index.
  // Group by TABLE_NAME + INDEX_NAME, ordering columns by SEQ_IN_INDEX.
  const rows = await db.unsafe(`
    SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND NON_UNIQUE = 0
    ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX
  `).execute()
  return groupIndexRows(Array.isArray(rows) ? rows : [], r => ({
    table: String(r.TABLE_NAME ?? r.table_name ?? ''),
    name: String(r.INDEX_NAME ?? r.index_name ?? ''),
    column: String(r.COLUMN_NAME ?? r.column_name ?? ''),
  }))
}

async function getPostgresLiveUniques(db: any): Promise<LiveUniqueIndex[]> {
  // PostgreSQL: pg_index (indisunique) joined to pg_class / pg_attribute,
  // scoped to the `public` schema. `ord` preserves column order.
  const rows = await db.unsafe(`
    SELECT
      t.relname AS table_name,
      ix.relname AS index_name,
      a.attname AS column_name,
      k.ord AS seq_in_index
    FROM pg_index i
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_class ix ON ix.oid = i.indexrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord) ON true
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
    WHERE i.indisunique = true
      AND n.nspname = 'public'
    ORDER BY table_name, index_name, seq_in_index
  `).execute()
  return groupIndexRows(Array.isArray(rows) ? rows : [], r => ({
    table: String(r.table_name ?? ''),
    name: String(r.index_name ?? ''),
    column: String(r.column_name ?? ''),
  }))
}

/**
 * Collapse flat `{ table, name, column }` rows (already ordered by
 * column position) into one `LiveUniqueIndex` per table+index.
 */
function groupIndexRows(
  rows: any[],
  pick: (row: any) => { table: string, name: string, column: string },
): LiveUniqueIndex[] {
  const map = new Map<string, LiveUniqueIndex>()
  for (const row of rows) {
    const { table, name, column } = pick(row)
    if (!table || !name || !column) continue
    const key = `${table} ${name}`
    const existing = map.get(key)
    if (existing) existing.columns.push(column)
    else map.set(key, { table, name, columns: [column] })
  }
  return [...map.values()]
}
