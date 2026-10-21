/**
 * `buddy migrate:align` - make a live database match the models without
 * writing a migration file.
 *
 * Migrations describe how to get from nothing to the models. They say nothing
 * about a database that got somewhere else: one built from hand-written
 * migrations that named indexes their own way, skipped foreign keys, or sized
 * a column smaller than the model now says. `buddy migrate` cannot repair that,
 * because it only runs files the ledger has not recorded, and regenerating the
 * corpus does not either - `CREATE ... IF NOT EXISTS` is a no-op against a
 * table or index name that is already taken, whatever shape it has.
 *
 * This compares the live schema with the SQL the generator emits for the
 * models (`generateFullModelMigration`, the same emit `migrate:regenerate`
 * writes) and repairs only what is safe and lossless:
 *
 *   - an index the model declares that exists under another name (same table,
 *     columns in order, uniqueness and predicate) is RENAMED, never rebuilt,
 *     so the next migrate does not build a second copy beside it;
 *   - an index the model declares that is missing is created, after checking a
 *     unique one would not fail on duplicate rows;
 *   - a declared foreign key that is missing is added, after checking no row
 *     would violate it;
 *   - a column the model declares that is missing is added (nullable unless it
 *     has a default or its table is empty);
 *   - a column narrower than the model is widened when that loses nothing
 *     (`varchar(n)` to `text` or to a longer `varchar`; `integer` to `bigint`
 *     only on request, because it rewrites the table);
 *   - an enum type the model extends gets the new labels.
 *
 * Everything else - extra columns, narrowing, nullability, defaults, an index
 * whose definition differs from its name's - is reported and left alone.
 * Deciding those is a human's job: each one either destroys data or changes
 * what the application is allowed to write.
 *
 * Postgres only, for now. The planner is pure so every rule can be tested
 * without a database; the reads and the checks are injectable for the same
 * reason.
 */

import type { MigrationPlan } from '@stacksjs/query-builder'
import { comparableIndexKey, indexShape, postgresIndexStatement } from './index-shape'
import { sqlStatementsOf } from './sql-statements'

/** Runs one SQL string and returns its rows (see `migration-ledger.ts`). */
export type AlignSqlRunner = (sql: string) => Promise<any[]>

export interface DesiredIndex {
  name: string
  table: string
  unique: boolean
  /** Plain column names, when every key part is a plain column; else undefined. */
  columns?: string[]
  /** `comparableIndexKey` of the statement. */
  key: string
  /** Everything after `ON "table" (...)`, e.g. `WHERE deleted_at IS NULL`. */
  where: string
  statement: string
}

export interface DesiredColumn {
  name: string
  type: string
  maxLength?: number
  isPrimaryKey: boolean
  isNullable: boolean
  hasDefault: boolean
  defaultValue?: unknown
  /** The column's definition in the generated CREATE TABLE. */
  definition?: string
  references?: { table: string, column: string, onDelete?: string, onUpdate?: string, constraintNames?: string[] }
}

export interface DesiredSchema {
  tables: Map<string, DesiredColumn[]>
  indexes: DesiredIndex[]
  enums: Map<string, string[]>
}

export interface LiveColumn {
  name: string
  dataType: string
  udtName: string
  maxLength?: number
  nullable: boolean
  default?: string
}

export interface LiveIndex {
  name: string
  table: string
  unique: boolean
  primary: boolean
  key?: string
  definition: string
  /** The constraint this index backs, if any. */
  constraint?: string
}

export interface LiveForeignKey {
  name: string
  table: string
  column: string
  refTable: string
  refColumn: string
  onDelete: string
  onUpdate: string
}

export interface LiveAlignSchema {
  tables: Map<string, Map<string, LiveColumn>>
  indexes: LiveIndex[]
  foreignKeys: LiveForeignKey[]
  enums: Map<string, string[]>
  /** Every relation and constraint name in the schema, for collision checks. */
  names: Set<string>
  /** Tables holding at least one row (only what a decision needs; may be partial). */
  populated?: Set<string>
}

export type AlignActionKind = 'create-enum-type' | 'add-enum-value' | 'add-column' | 'widen-column' | 'rename-index' | 'create-index' | 'add-foreign-key'

export interface AlignAction {
  kind: AlignActionKind
  table: string
  /** Column, index or constraint the action is about. */
  name: string
  detail: string
  sql: string
  /**
   * For `create-index` (unique) and `add-foreign-key`: what to check before
   * applying, and the columns of `table` the probe reads. A probe over a
   * column this same plan adds cannot run until that add-column has, so
   * `dependsOn` is what lets the planner recognise the one it must not run.
   */
  check?: ({ kind: 'duplicates', sql: string } | { kind: 'orphans', sql: string }) & { dependsOn?: string[] }
}

export type AlignReportKind =
  | 'missing-table'
  | 'missing-column'
  | 'extra-column'
  | 'type'
  | 'optional-widening'
  | 'nullability'
  | 'default'
  | 'index-definition'
  | 'duplicate-index'
  | 'name-conflict'
  | 'enum'
  | 'foreign-key'
  | 'unchecked'

export interface AlignReport {
  kind: AlignReportKind
  table: string
  name?: string
  detail: string
}

export interface AlignmentPlan {
  actions: AlignAction[]
  /** Never applied: destructive, ambiguous, or a human's decision. */
  reports: AlignReport[]
  /** Actions the checks refused (orphan rows, duplicate values). */
  refused: Array<AlignAction & { reason: string }>
}

const quote = (name: string): string => `"${name.replace(/"/g, '""')}"`
const sqlString = (value: string): string => `'${value.replace(/'/g, '\'\'')}'`

/**
 * The generator's identifier rule (bun-query-builder): names past Postgres's
 * 63-character limit keep their head and end in a short FNV-1a hash of the
 * whole name, instead of being truncated by the server to a prefix two long
 * names can share.
 */
export function postgresIdentifier(name: string, max = 63): string {
  if (name.length <= max)
    return name
  let hash = 2166136261
  for (let i = 0; i < name.length; i++) {
    hash ^= name.charCodeAt(i)
    hash = Math.imul(hash, 16777619) >>> 0
  }
  const suffix = `_${hash.toString(36).padStart(7, '0').slice(-7)}`
  return name.slice(0, max - suffix.length) + suffix
}

/** Split a CREATE TABLE body on its top-level commas. */
function topLevelParts(body: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  let quoted: string | null = null
  for (const char of body) {
    if (quoted) {
      current += char
      if (char === quoted)
        quoted = null
      continue
    }
    if (char === '\'' || char === '"') {
      quoted = char
      current += char
      continue
    }
    if (char === '(')
      depth++
    if (char === ')')
      depth--
    if (char === ',' && depth === 0) {
      parts.push(current)
      current = ''
      continue
    }
    current += char
  }
  parts.push(current)
  return parts.map(part => part.trim()).filter(Boolean)
}

/**
 * The column definitions of a CREATE TABLE, by lowercased column name, as
 * written. Table constraints carry no column name and are skipped.
 */
export function columnDefinitionsOf(createStatement: string): Map<string, string> {
  const definitions = new Map<string, string>()
  const body = createStatement.match(/\(([\s\S]*)\)\s*;?\s*$/)?.[1]
  if (!body)
    return definitions
  const constraint = /^\s*(?:PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|CONSTRAINT|KEY|INDEX)\b/i
  for (const part of topLevelParts(body)) {
    if (constraint.test(part))
      continue
    const name = part.match(/^["'`]?(\w+)["'`]?/)?.[1]
    if (name)
      definitions.set(name.toLowerCase(), part)
  }
  return definitions
}

/** The column list of a CREATE INDEX and whatever follows it, bracket-aware. */
function indexColumnsAndPredicate(statement: string): [string, string, string] | undefined {
  const open = /\bON\s+\S+\s*\(/i.exec(statement)
  if (!open)
    return undefined
  const start = open.index + open[0].length
  let depth = 1
  let end = start
  for (; end < statement.length && depth > 0; end++) {
    if (statement[end] === '(')
      depth++
    else if (statement[end] === ')')
      depth--
  }
  if (depth > 0)
    return undefined
  return [statement, statement.slice(start, end - 1), statement.slice(end).trim()]
}

/** What the models want, read off the generator's own SQL and plan. */
export function desiredSchemaFrom(plan: MigrationPlan, statements: readonly string[]): DesiredSchema {
  const creates = new Map<string, string>()
  const indexes: DesiredIndex[] = []
  const enums = new Map<string, string[]>()

  const visit = (statement: string): void => {
    const table = /^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`]?(\w+)["'`]?/i.exec(statement)?.[1]
    if (table) {
      creates.set(table.toLowerCase(), statement)
      return
    }

    const enumType = /^\s*CREATE\s+TYPE\s+["]?([\w$]+)["]?\s+AS\s+ENUM\s*\(([\s\S]*)\)\s*;?\s*$/i.exec(statement)
    if (enumType?.[1]) {
      const labels = [...(enumType[2] ?? '').matchAll(/'((?:[^']|'')*)'/g)].map(m => (m[1] ?? '').replace(/''/g, '\''))
      enums.set(enumType[1].toLowerCase(), labels)
      return
    }

    const guarded = /^\s*DO\s+\$(\w*)\$\s*BEGIN\s+([\s\S]*?);\s*EXCEPTION\b/i.exec(statement)
    if (guarded?.[2]) {
      visit(guarded[2])
      return
    }

    const shape = indexShape(statement)
    const key = comparableIndexKey(statement)
    if (shape && key) {
      const head = indexColumnsAndPredicate(statement)
      const parts = topLevelParts(head?.[1] ?? '')
      const plain = parts.every(part => /^["`]?\w+["`]?$/.test(part))
      indexes.push({
        name: shape.name,
        table: shape.table,
        unique: /^\s*CREATE\s+UNIQUE\b/i.test(statement),
        ...(plain ? { columns: parts.map(part => part.replace(/["`]/g, '').toLowerCase()) } : {}),
        key,
        where: (head?.[2] ?? '').replace(/;\s*$/, '').trim(),
        statement: statement.trim().replace(/;\s*$/, ''),
      })
    }
  }
  for (const statement of statements) {
    for (const part of sqlStatementsOf(statement.trim().endsWith(';') ? statement : `${statement};`))
      visit(part)
  }

  const tables = new Map<string, DesiredColumn[]>()
  for (const table of plan.tables) {
    const name = table.table.toLowerCase()
    const definitions = creates.has(name) ? columnDefinitionsOf(creates.get(name)!) : new Map<string, string>()
    tables.set(name, table.columns.map(column => ({
      name: column.name.toLowerCase(),
      type: column.type,
      ...(column.maxLength !== undefined ? { maxLength: column.maxLength } : {}),
      isPrimaryKey: column.isPrimaryKey,
      isNullable: column.isNullable,
      hasDefault: column.hasDefault,
      ...(column.defaultValue !== undefined ? { defaultValue: column.defaultValue } : {}),
      ...(definitions.get(column.name.toLowerCase()) ? { definition: definitions.get(column.name.toLowerCase())! } : {}),
      ...(column.references ? { references: { ...column.references } } : {}),
    })))
  }

  return { tables, indexes, enums }
}

const INTEGER_RANK: Record<string, number> = { smallint: 1, integer: 2, bigint: 3 }

/** The model type's Postgres family name for comparison, or undefined for "do not compare". */
function declaredIntegerRank(type: string): number | undefined {
  if (type === 'integer')
    return INTEGER_RANK.integer
  if (type === 'bigint')
    return INTEGER_RANK.bigint
  return undefined
}

function liveIntegerRank(column: LiveColumn): number | undefined {
  return INTEGER_RANK[column.dataType]
}

/** A default as both sides can spell it: no casts, no outer brackets, no quotes. */
export function comparableDefault(value: string | undefined): string | undefined {
  if (value === undefined || value === null)
    return undefined
  let text = String(value).trim()
  if (/^nextval\(/i.test(text))
    return undefined
  // `now()`, `CURRENT_TIMESTAMP`, `(now() AT TIME ZONE 'utc')` and the
  // generator's UTC marker are one idea - "the clock" - spelled four ways.
  if (/\bnow\(\)|\b(?:current_timestamp|utc_timestamp|localtimestamp)\b/i.test(text))
    return 'clock'
  text = text.replace(/::\s*(?:"[^"]+"|[a-z_]\w*)(?:\s+varying|\s+precision|\s+with(?:out)?\s+time\s+zone)?(?:\[\])?/gi, '')
  while (/^\(.*\)$/s.test(text))
    text = text.slice(1, -1).trim()
  text = text.replace(/^'(.*)'$/s, '$1').replace(/''/g, '\'')
  return text.toLowerCase()
}

function declaredDefault(column: DesiredColumn): string | undefined {
  if (!column.hasDefault || column.defaultValue === undefined || column.defaultValue === null)
    return undefined
  const value = column.defaultValue
  if (value instanceof Date)
    return comparableDefault(value.toISOString())
  return comparableDefault(typeof value === 'string' ? value : String(value))
}

function foreignKeyAction(action: string | undefined): string {
  return (action ?? 'no action').toUpperCase()
}

const PG_ACTION: Record<string, string> = { a: 'NO ACTION', r: 'RESTRICT', c: 'CASCADE', n: 'SET NULL', d: 'SET DEFAULT' }

/**
 * Work out what `migrate:align` would do. Pure: reads nothing, writes nothing.
 *
 * The actions come back in the order they must run: labels before the columns
 * that use them, columns before the indexes and keys over them, renames before
 * creates so a rename is never mistaken for a missing index.
 */
export function planSchemaAlignment(
  desired: DesiredSchema,
  live: LiveAlignSchema,
  options: {
    /** Widen integer columns the model declares as bigint (rewrites the table). */
    widenIntegers?: boolean
    /** Whether a live type satisfies a declared one, for everything this does not repair itself. */
    typeSatisfies?: (declaredType: string, liveSqlType: string) => boolean
  } = {},
): AlignmentPlan {
  const actions: AlignAction[] = []
  const reports: AlignReport[] = []
  const added = new Set<string>()

  // Enum types and labels the model added. Additive, so safe; removing either
  // is not.
  for (const [type, labels] of desired.enums) {
    const existing = live.enums.get(type)
    // A type the database never got, rather than one missing a label. Skipping
    // it left the column that is declared with it to fail the whole apply with
    // `type "..." does not exist`, since nothing else creates one. Created here
    // so it exists before the add-column below reaches for it.
    if (!existing) {
      actions.push({
        kind: 'create-enum-type',
        table: type,
        name: type,
        detail: `create enum type ${type} (${labels.join(', ')})`,
        sql: `CREATE TYPE ${quote(type)} AS ENUM (${labels.map(sqlString).join(', ')})`,
      })
      continue
    }
    for (const label of labels.filter(label => !existing.includes(label))) {
      actions.push({
        kind: 'add-enum-value',
        table: type,
        name: label,
        detail: `add '${label}' to enum type ${type}`,
        sql: `ALTER TYPE ${quote(type)} ADD VALUE IF NOT EXISTS ${sqlString(label)}`,
      })
    }
    const extra = existing.filter(label => !labels.includes(label))
    if (extra.length > 0)
      reports.push({ kind: 'enum', table: type, detail: `enum type ${type} has label(s) the model does not declare: ${extra.join(', ')}` })
  }

  for (const [table, columns] of desired.tables) {
    const liveColumns = live.tables.get(table)
    if (!liveColumns) {
      reports.push({ kind: 'missing-table', table, detail: `table ${table} does not exist - \`buddy migrate\` creates it` })
      continue
    }

    const declared = new Set(columns.map(column => column.name))
    for (const name of liveColumns.keys()) {
      if (!declared.has(name))
        reports.push({ kind: 'extra-column', table, name, detail: `${table}.${name} exists but no model declares it` })
    }

    for (const column of columns) {
      const current = liveColumns.get(column.name)
      if (!current) {
        if (!column.definition || /\bPRIMARY\s+KEY\b|\bUNIQUE\b/i.test(column.definition)) {
          reports.push({ kind: 'missing-column', table, name: column.name, detail: `${table}.${column.name} is missing and cannot be added in place` })
          continue
        }
        // A column can carry its foreign key inline, and nothing here creates
        // tables. Adding it would fail the whole apply on the reference, so
        // the table it points at has to come first.
        const inlineReference = /\bREFERENCES\s+"([^"]+)"/i.exec(column.definition)?.[1]?.toLowerCase()
        if (inlineReference && !live.tables.has(inlineReference)) {
          reports.push({
            kind: 'foreign-key',
            table,
            name: column.name,
            detail: `${table}.${column.name} references ${inlineReference}, which does not exist - \`buddy migrate\` creates that table`,
          })
          continue
        }
        // A NOT NULL column with no default cannot go into a table with rows.
        // Added nullable instead, and said so: a missing column breaks every
        // query that names it, a nullable one only holds a weaker rule.
        const strict = /\bNOT\s+NULL\b/i.test(column.definition) && !/\bDEFAULT\b/i.test(column.definition)
        const populated = live.populated?.has(table) ?? true
        const definition = strict && populated ? column.definition.replace(/\s*\bNOT\s+NULL\b/i, '') : column.definition
        actions.push({
          kind: 'add-column',
          table,
          name: column.name,
          detail: `add ${table}.${column.name}${definition !== column.definition ? ' (nullable: the table has rows and the column has no default)' : ''}`,
          sql: `ALTER TABLE ${quote(table)} ADD COLUMN IF NOT EXISTS ${definition}`,
        })
        added.add(`${table}.${column.name}`)
        if (definition !== column.definition)
          reports.push({ kind: 'nullability', table, name: column.name, detail: `${table}.${column.name} is added nullable; backfill it, then make it NOT NULL` })
        continue
      }

      if (column.isPrimaryKey)
        continue

      // Types: widen what is lossless, report the rest.
      const liveSql = current.maxLength ? `${current.dataType}(${current.maxLength})` : current.dataType
      if (column.type === 'string' || column.type === 'text') {
        const wanted = column.type === 'text' ? undefined : (column.maxLength ?? 255)
        const isVarchar = current.dataType === 'character varying'
        const isText = current.dataType === 'text' || (isVarchar && !current.maxLength)
        if (isVarchar && current.maxLength && (wanted === undefined || wanted > current.maxLength)) {
          const to = wanted === undefined ? 'text' : `varchar(${wanted})`
          actions.push({
            kind: 'widen-column',
            table,
            name: column.name,
            detail: `widen ${table}.${column.name} from varchar(${current.maxLength}) to ${to}`,
            sql: `ALTER TABLE ${quote(table)} ALTER COLUMN ${quote(column.name)} TYPE ${to}`,
          })
        }
        else if (isVarchar && current.maxLength && wanted !== undefined && wanted < current.maxLength) {
          reports.push({ kind: 'type', table, name: column.name, detail: `${table}.${column.name} is varchar(${current.maxLength}); the model declares varchar(${wanted}) - narrowing could truncate data` })
        }
        else if (isText && wanted !== undefined) {
          reports.push({ kind: 'type', table, name: column.name, detail: `${table}.${column.name} is unbounded text; the model declares varchar(${wanted}) - narrowing could truncate data` })
        }
        else if (!isVarchar && !isText && current.dataType !== 'USER-DEFINED') {
          reports.push({ kind: 'type', table, name: column.name, detail: `${table}.${column.name} is ${liveSql}; the model declares ${column.type === 'text' ? 'text' : `varchar(${wanted})`}` })
        }
      }
      else if (declaredIntegerRank(column.type) !== undefined && liveIntegerRank(current) !== undefined) {
        const want = declaredIntegerRank(column.type)!
        const have = liveIntegerRank(current)!
        if (want > have) {
          if (options.widenIntegers) {
            actions.push({
              kind: 'widen-column',
              table,
              name: column.name,
              detail: `widen ${table}.${column.name} from ${current.dataType} to bigint (rewrites the table)`,
              sql: `ALTER TABLE ${quote(table)} ALTER COLUMN ${quote(column.name)} TYPE bigint`,
            })
          }
          else {
            reports.push({ kind: 'optional-widening', table, name: column.name, detail: `${table}.${column.name} is ${current.dataType}; the model declares bigint - pass --widen-integers to convert it (rewrites the table)` })
          }
        }
        else if (want < have) {
          reports.push({ kind: 'type', table, name: column.name, detail: `${table}.${column.name} is ${current.dataType}; the model declares ${column.type} - narrowing could overflow` })
        }
      }
      else if (column.type !== 'enum' && options.typeSatisfies && !options.typeSatisfies(column.type, current.dataType)) {
        reports.push({ kind: 'type', table, name: column.name, detail: `${table}.${column.name} is ${liveSql}; the model declares ${column.type}` })
      }

      // Nullability: reported, never changed.
      const wantNullable = column.isNullable
      if (wantNullable !== current.nullable) {
        reports.push({
          kind: 'nullability',
          table,
          name: column.name,
          detail: wantNullable
            ? `${table}.${column.name} is NOT NULL; the model allows NULL`
            : `${table}.${column.name} allows NULL; the model declares NOT NULL`,
        })
      }

      // Defaults: reported, never changed.
      const want = declaredDefault(column)
      const have = comparableDefault(current.default)
      if ((want ?? '') !== (have ?? '') && !(want === undefined && have === 'null'))
        reports.push({ kind: 'default', table, name: column.name, detail: `${table}.${column.name} defaults to ${current.default ?? 'nothing'}; the model declares ${want === undefined ? 'no default' : String(column.defaultValue)}` })
    }
  }

  // Indexes.
  const desiredNames = new Set(desired.indexes.map(index => index.name))
  const liveByName = new Map(live.indexes.map(index => [index.name, index]))
  const claimed = new Set<string>()
  const renames: AlignAction[] = []
  const creates: AlignAction[] = []
  for (const index of desired.indexes) {
    const liveColumns = live.tables.get(index.table)
    if (!liveColumns)
      continue

    const existing = liveByName.get(index.name)
    if (existing) {
      claimed.add(existing.name)
      if (existing.table !== index.table || (existing.key && existing.key !== index.key)) {
        reports.push({
          kind: 'index-definition',
          table: index.table,
          name: index.name,
          detail: `index ${index.name} exists but differs from the model (${existing.definition}) - drop and recreate it by hand if the model is right`,
        })
      }
      continue
    }

    const twins = live.indexes.filter(candidate =>
      candidate.table === index.table
      && !candidate.primary
      && candidate.key === index.key
      && !desiredNames.has(candidate.name)
      && !claimed.has(candidate.name))
    if (twins.length > 0) {
      /*
       * Of several identical indexes, rename the one that was this index all
       * along. A history that prefixed names twice left `users_users_stripe_id
       * _unique` beside the framework's own `idx_users_stripe_id`; renaming the
       * framework's one took it away from the auth setup, which recreated it on
       * the next migrate, and the old name stayed behind as a third copy. The
       * candidate whose name already contains the model's is the old spelling
       * of the same index; the others are someone else's.
       */
      const [twin, ...extra] = [...twins].sort((a, b) => Number(b.name.includes(index.name)) - Number(a.name.includes(index.name)))
      claimed.add(twin!.name)
      if (live.names.has(index.name)) {
        reports.push({ kind: 'name-conflict', table: index.table, name: index.name, detail: `cannot rename ${twin!.name} to ${index.name}: that name is taken by another object` })
      }
      else {
        renames.push({
          kind: 'rename-index',
          table: index.table,
          name: index.name,
          detail: `rename index ${twin!.name} to ${index.name}${twin!.constraint ? ` (and the constraint it backs)` : ''}`,
          sql: `ALTER INDEX ${quote(twin!.name)} RENAME TO ${quote(index.name)}`,
        })
      }
      for (const duplicate of extra) {
        claimed.add(duplicate.name)
        reports.push({ kind: 'duplicate-index', table: index.table, name: duplicate.name, detail: `${duplicate.name} duplicates ${index.name} - drop it by hand once nothing depends on it` })
      }
      continue
    }

    const missingColumn = index.columns?.find(column => !liveColumns.has(column) && !added.has(`${index.table}.${column}`))
    if (missingColumn) {
      reports.push({ kind: 'missing-column', table: index.table, name: missingColumn, detail: `index ${index.name} needs ${index.table}.${missingColumn}, which cannot be added here` })
      continue
    }

    const statement = index.statement.replace(/^\s*CREATE\s+(UNIQUE\s+)?INDEX\s+(?!IF\s+NOT\s+EXISTS)/i, (_m, unique: string | undefined) => `CREATE ${unique ?? ''}INDEX IF NOT EXISTS `)
    const action: AlignAction = {
      kind: 'create-index',
      table: index.table,
      name: index.name,
      detail: `create ${index.unique ? 'unique ' : ''}index ${index.name}`,
      sql: statement,
    }
    if (index.unique && index.columns) {
      const columns = index.columns.map(quote).join(', ')
      const where = [
        ...index.columns.map(column => `${quote(column)} IS NOT NULL`),
        ...(index.where ? [`(${index.where.replace(/^WHERE\s+/i, '')})`] : []),
      ].join(' AND ')
      action.check = {
        kind: 'duplicates',
        sql: `SELECT COUNT(*) AS n FROM (SELECT 1 FROM ${quote(index.table)} WHERE ${where} GROUP BY ${columns} HAVING COUNT(*) > 1) AS duplicates`,
        dependsOn: [...index.columns],
      }
    }
    creates.push(action)
  }

  // Foreign keys.
  const foreignKeys: AlignAction[] = []
  for (const [table, columns] of desired.tables) {
    const liveColumns = live.tables.get(table)
    if (!liveColumns)
      continue
    for (const column of columns) {
      const ref = column.references
      if (!ref)
        continue
      const refTable = ref.table.toLowerCase()
      const refColumn = ref.column.toLowerCase()
      // An added column carries its REFERENCES inline.
      if (added.has(`${table}.${column.name}`) || !liveColumns.has(column.name))
        continue

      const present = live.foreignKeys.find(fk => fk.table === table && fk.column === column.name && fk.refTable === refTable && fk.refColumn === refColumn)
      if (present) {
        const wantDelete = foreignKeyAction(ref.onDelete)
        const wantUpdate = foreignKeyAction(ref.onUpdate)
        if (present.onDelete !== wantDelete || present.onUpdate !== wantUpdate) {
          reports.push({ kind: 'foreign-key', table, name: present.name, detail: `${present.name} is ON DELETE ${present.onDelete} ON UPDATE ${present.onUpdate}; the model declares ON DELETE ${wantDelete} ON UPDATE ${wantUpdate}` })
        }
        continue
      }

      if (!live.tables.get(refTable)?.has(refColumn)) {
        reports.push({ kind: 'foreign-key', table, name: column.name, detail: `${table}.${column.name} references ${refTable}.${refColumn}, which does not exist` })
        continue
      }

      const name = postgresIdentifier(ref.constraintNames?.[0] ?? `${table}_${column.name}_fkey`)
      if (live.names.has(name)) {
        reports.push({ kind: 'name-conflict', table, name, detail: `cannot add the foreign key for ${table}.${column.name} as ${name}: that name is taken` })
        continue
      }
      const actionsSql = [
        ref.onDelete ? ` ON DELETE ${foreignKeyAction(ref.onDelete)}` : '',
        ref.onUpdate ? ` ON UPDATE ${foreignKeyAction(ref.onUpdate)}` : '',
      ].join('')
      foreignKeys.push({
        kind: 'add-foreign-key',
        table,
        name,
        detail: `add foreign key ${table}.${column.name} -> ${refTable}.${refColumn}`,
        sql: `ALTER TABLE ${quote(table)} ADD CONSTRAINT ${quote(name)} FOREIGN KEY (${quote(column.name)}) REFERENCES ${quote(refTable)} (${quote(refColumn)})${actionsSql}`,
        check: {
          kind: 'orphans',
          sql: `SELECT COUNT(*) AS n FROM ${quote(table)} AS child WHERE child.${quote(column.name)} IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ${quote(refTable)} AS parent WHERE parent.${quote(refColumn)} = child.${quote(column.name)})`,
          dependsOn: [column.name],
        },
      })
    }
  }

  return {
    actions: [...actions, ...renames, ...creates, ...foreignKeys],
    reports,
    refused: [],
  }
}

function rows(result: unknown): any[] {
  return Array.isArray(result) ? result : []
}

function text(row: any, key: string): string {
  const value = row?.[key]
  return value === null || value === undefined ? '' : String(value)
}

/** Read the parts of a Postgres schema the planner compares. */
export async function readPostgresAlignSchema(run: AlignSqlRunner): Promise<LiveAlignSchema> {
  const tables = new Map<string, Map<string, LiveColumn>>()
  for (const row of rows(await run(`SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'`)))
    tables.set(text(row, 'table_name').toLowerCase(), new Map())

  for (const row of rows(await run(`SELECT table_name, column_name, data_type, udt_name, character_maximum_length, is_nullable, column_default FROM information_schema.columns WHERE table_schema = current_schema()`))) {
    const columns = tables.get(text(row, 'table_name').toLowerCase())
    if (!columns)
      continue
    const length = Number(row.character_maximum_length)
    columns.set(text(row, 'column_name').toLowerCase(), {
      name: text(row, 'column_name').toLowerCase(),
      dataType: text(row, 'data_type').toLowerCase() === 'user-defined' ? 'USER-DEFINED' : text(row, 'data_type').toLowerCase(),
      udtName: text(row, 'udt_name').toLowerCase(),
      ...(Number.isFinite(length) && length > 0 ? { maxLength: length } : {}),
      nullable: text(row, 'is_nullable').toUpperCase() === 'YES',
      ...(row.column_default !== null && row.column_default !== undefined ? { default: String(row.column_default) } : {}),
    })
  }

  const indexes: LiveIndex[] = []
  for (const row of rows(await run(`
    SELECT t.relname AS table_name, i.relname AS index_name, ix.indisunique AS is_unique, ix.indisprimary AS is_primary,
           pg_get_indexdef(ix.indexrelid) AS definition, con.conname AS constraint_name
    FROM pg_index ix
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_class t ON t.oid = ix.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    LEFT JOIN pg_constraint con ON con.conindid = ix.indexrelid AND con.conrelid = t.oid
    WHERE n.nspname = current_schema()`))) {
    const definition = text(row, 'definition')
    const key = comparableIndexKey(postgresIndexStatement(definition))
    indexes.push({
      name: text(row, 'index_name').toLowerCase(),
      table: text(row, 'table_name').toLowerCase(),
      unique: row.is_unique === true || row.is_unique === 't',
      primary: row.is_primary === true || row.is_primary === 't',
      ...(key ? { key } : {}),
      definition,
      ...(row.constraint_name ? { constraint: String(row.constraint_name) } : {}),
    })
  }

  const foreignKeys: LiveForeignKey[] = []
  for (const row of rows(await run(`
    SELECT con.conname, cl.relname AS table_name, att.attname AS column_name, rcl.relname AS ref_table, ratt.attname AS ref_column,
           con.confdeltype AS on_delete, con.confupdtype AS on_update
    FROM pg_constraint con
    JOIN pg_class cl ON cl.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    JOIN pg_class rcl ON rcl.oid = con.confrelid
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
    JOIN pg_attribute ratt ON ratt.attrelid = con.confrelid AND ratt.attnum = con.confkey[1]
    WHERE con.contype = 'f' AND n.nspname = current_schema() AND array_length(con.conkey, 1) = 1`))) {
    foreignKeys.push({
      name: text(row, 'conname').toLowerCase(),
      table: text(row, 'table_name').toLowerCase(),
      column: text(row, 'column_name').toLowerCase(),
      refTable: text(row, 'ref_table').toLowerCase(),
      refColumn: text(row, 'ref_column').toLowerCase(),
      onDelete: PG_ACTION[text(row, 'on_delete')] ?? 'NO ACTION',
      onUpdate: PG_ACTION[text(row, 'on_update')] ?? 'NO ACTION',
    })
  }

  const enums = new Map<string, string[]>()
  for (const row of rows(await run(`
    SELECT t.typname, e.enumlabel FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = current_schema()
    ORDER BY t.typname, e.enumsortorder`))) {
    const type = text(row, 'typname').toLowerCase()
    if (!enums.has(type))
      enums.set(type, [])
    enums.get(type)!.push(text(row, 'enumlabel'))
  }

  const names = new Set<string>()
  for (const row of rows(await run(`SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = current_schema()`)))
    names.add(text(row, 'name').toLowerCase())
  for (const row of rows(await run(`SELECT con.conname AS name FROM pg_constraint con JOIN pg_namespace n ON n.oid = con.connamespace WHERE n.nspname = current_schema()`)))
    names.add(text(row, 'name').toLowerCase())

  return { tables, indexes, foreignKeys, enums, names }
}

/** Tables with at least one row, among those named. */
async function populatedTables(run: AlignSqlRunner, tables: readonly string[]): Promise<Set<string>> {
  const populated = new Set<string>()
  for (const table of tables) {
    const found = rows(await run(`SELECT 1 AS present FROM ${quote(table)} LIMIT 1`))
    if (found.length > 0)
      populated.add(table)
  }
  return populated
}

export interface AlignResult {
  supported: boolean
  dialect: string
  plan: AlignmentPlan
  /** Statements executed, in order (empty unless `apply`). */
  applied: string[]
}

/**
 * Plan, check and optionally apply an alignment.
 *
 * Checks run before anything is written: a foreign key with orphan rows, or a
 * unique index over duplicate values, moves to `refused` with a count, rather
 * than failing the batch halfway. Everything left then runs as ONE
 * multi-statement string, which Postgres executes as a single implicit
 * transaction - all of it lands, or none of it does.
 */
/**
 * Run each action's pre-flight check and sort the survivors from the refused.
 *
 * Separate from `alignSchema` so it can be exercised without a database: the
 * decisions here are about what a probe's answer means, including the case
 * where there is no answer to have.
 */
export async function evaluateAlignChecks(plan: AlignmentPlan, run: AlignSqlRunner): Promise<AlignAction[]> {
  const pending = new Set(
    plan.actions
      .filter(action => action.kind === 'add-column')
      .map(action => `${action.table}.${action.name}`),
  )
  const kept: AlignAction[] = []
  for (const action of plan.actions) {
    if (!action.check) {
      kept.push(action)
      continue
    }
    // A probe reading a column this plan has yet to add has no answer to give:
    // the column is not there to be read, and Postgres ends the whole planning
    // pass rather than returning a count. Keep the repair and say the probe did
    // not run. The apply is one transaction, so an index the data really does
    // violate still fails there and takes nothing with it.
    const unmet = action.check.dependsOn?.filter(column => pending.has(`${action.table}.${column}`)) ?? []
    if (unmet.length > 0) {
      plan.reports.push({
        kind: 'unchecked',
        table: action.table,
        name: action.name,
        detail: `${action.detail}: not checked for ${action.check.kind === 'orphans' ? 'orphan rows' : 'duplicate values'} first, because the probe reads ${unmet.map(column => `${action.table}.${column}`).join(', ')}, which this plan adds`,
      })
      kept.push(action)
      continue
    }
    // A check on a table this plan widens or extends still reads correctly:
    // neither changes which rows exist or what they hold.
    const count = Number(rows(await run(action.check.sql))[0]?.n ?? 0)
    if (count > 0) {
      plan.refused.push({
        ...action,
        reason: action.check.kind === 'orphans'
          ? `${count} row(s) in ${action.table} reference a missing parent - fix or delete them, then re-run`
          : `${count} duplicate value(s) in ${action.table} would violate it - de-duplicate them, then re-run`,
      })
      continue
    }
    kept.push(action)
  }
  return kept
}

export async function alignSchema(options: {
  apply?: boolean
  widenIntegers?: boolean
  dialect?: string
  /** Read from, and write to, a database other than the configured one. */
  run?: AlignSqlRunner
} = {}): Promise<AlignResult> {
  const { ensureDatabaseConfigLoaded, resolvedDatabaseConfig } = await import('./utils')
  await ensureDatabaseConfigLoaded()
  const dialect = options.dialect ?? resolvedDatabaseConfig().driver
  const empty: AlignmentPlan = { actions: [], reports: [], refused: [] }
  if (dialect !== 'postgres')
    return { supported: false, dialect, plan: empty, applied: [] }

  const { generateFullModelMigration } = await import('./migrations')
  const generated = await generateFullModelMigration({ dialect })
  if (!generated.isOk)
    throw generated.error

  const run: AlignSqlRunner = options.run ?? (async (sql: string) => {
    const { db } = await import('./utils')
    return rows(await db.unsafe(sql).execute())
  })

  const desired = desiredSchemaFrom(generated.value.plan, generated.value.statements)
  const live = await readPostgresAlignSchema(run)
  // Only tables that might gain a NOT NULL column need counting.
  const candidates = [...desired.tables.keys()].filter(table => live.tables.has(table))
  live.populated = await populatedTables(run, candidates)

  let typeSatisfies: ((declared: string, sqlType: string) => boolean) | undefined
  try {
    const qb = await import('bun-query-builder') as unknown as {
      familyOfDeclared?: (type: string) => string
      familyOfSqlType?: (type: string) => string
      satisfies?: (declared: string, actual: string, dialect?: string) => boolean
    }
    if (qb.familyOfDeclared && qb.familyOfSqlType && qb.satisfies) {
      const { familyOfDeclared, familyOfSqlType, satisfies } = qb
      typeSatisfies = (declared, sqlType) => satisfies(familyOfDeclared(declared), familyOfSqlType(sqlType), 'postgres')
    }
  }
  catch { /* type families are a report nicety; the repairs do not need them */ }

  const plan = planSchemaAlignment(desired, live, { widenIntegers: options.widenIntegers, typeSatisfies })

  const kept = await evaluateAlignChecks(plan, run)
  plan.actions = kept

  if (!options.apply || kept.length === 0)
    return { supported: true, dialect, plan, applied: [] }

  const statements = kept.map(action => action.sql)
  await run(`${statements.join(';\n')};`)
  return { supported: true, dialect, plan, applied: statements }
}
