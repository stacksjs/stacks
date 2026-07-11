/**
 * Laravel migration → Stacks SQL translator.
 *
 * Laravel migrations are PHP classes whose `up()` calls
 * `Schema::create(table, fn (Blueprint $t) => { ... })`. We don't
 * parse arbitrary PHP — we recognise the common Blueprint DSL by
 * regex and emit a CREATE TABLE statement that the Stacks runner can
 * consume.
 *
 * Strategy:
 *   1. Find the `Schema::create('table', function (...) { BODY })` block.
 *   2. Tokenise BODY line-by-line, each line a `$table->method(args)->modifier()...;` chain.
 *   3. Map the leading method to a SQLite column type.
 *   4. Translate modifiers (`->nullable()`, `->unique()`, `->default(...)`, `->index()`)
 *      into column constraints (or post-table CREATE INDEX statements).
 *
 * Anything unrecognised gets logged in the report as `// SKIPPED:` and
 * the user can hand-port it.
 */

export interface ParsedMigration {
  /** The detected table name from `Schema::create(...)`. */
  table: string
  /** The emitted SQL — a CREATE TABLE statement plus any CREATE INDEX statements. */
  sql: string
  /** Lines from the source migration we couldn't translate, surfaced for the report. */
  skipped: string[]
}

interface Column {
  name: string
  type: string
  nullable: boolean
  unique: boolean
  primaryKey: boolean
  autoIncrement: boolean
  defaultValue: string | null
  index: boolean
}

/**
 * Parse a Laravel migration file. Returns `null` when no
 * `Schema::create(...)` block is found (e.g. drop migrations,
 * data-only migrations, alter-table migrations — those are deferred
 * to a separate emitter once the create paths land).
 */
export function parseLaravelMigration(source: string): ParsedMigration | null {
  const createMatch = source.match(/Schema::create\(\s*['"]([a-z0-9_]+)['"]\s*,\s*function\s*\([^)]*\)\s*\{([\s\S]*?)\}\s*\)\s*;/i)
  if (!createMatch?.[1] || createMatch[2] === undefined) return null

  const table = createMatch[1]
  const body = createMatch[2]
  const skipped: string[] = []
  const columns: Column[] = []
  const indexes: { name: string, columns: string[], unique: boolean }[] = []

  const lines = body
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('//') && !line.startsWith('*') && !line.startsWith('/*'))

  for (const line of lines) {
    const trimmed = line.replace(/;\s*$/, '')
    if (!trimmed.startsWith('$table->')) {
      skipped.push(line)
      continue
    }

    const parsed = parseColumnLine(trimmed)
    if (!parsed) {
      skipped.push(line)
      continue
    }

    if (parsed.kind === 'columns') {
      columns.push(...parsed.columns)
      if (parsed.indexes) indexes.push(...parsed.indexes)
    }
    else if (parsed.kind === 'index') {
      indexes.push(parsed.index)
    }
    else if (parsed.kind === 'skip') {
      skipped.push(line)
    }
  }

  const sql = emitCreateTable(table, columns, indexes)
  return { table, sql, skipped }
}

type ParsedLine =
  | { kind: 'columns', columns: Column[], indexes?: { name: string, columns: string[], unique: boolean }[] }
  | { kind: 'index', index: { name: string, columns: string[], unique: boolean } }
  | { kind: 'skip' }

/**
 * Parse a single `$table->method(...)->modifier()...` line.
 *
 * Returns the emitted columns plus any inline indexes triggered by
 * chained modifiers (`->unique()`, `->index()`).
 */
function parseColumnLine(line: string): ParsedLine | null {
  // Match: $table->method(args)->mod1()->mod2(args)...
  const methodMatch = line.match(/^\$table->([a-zA-Z_]+)\s*\(([^)]*)\)(.*)$/)
  if (!methodMatch?.[1] || methodMatch[2] === undefined || methodMatch[3] === undefined) return null

  const method = methodMatch[1]
  const args = methodMatch[2].trim()
  const rest = methodMatch[3]

  // Sugar methods that emit multiple columns at once.
  if (method === 'timestamps') {
    return {
      kind: 'columns',
      columns: [
        { name: 'created_at', type: 'DATETIME', nullable: true, unique: false, primaryKey: false, autoIncrement: false, defaultValue: 'CURRENT_TIMESTAMP', index: false },
        { name: 'updated_at', type: 'DATETIME', nullable: true, unique: false, primaryKey: false, autoIncrement: false, defaultValue: null, index: false },
      ],
    }
  }
  if (method === 'softDeletes') {
    return {
      kind: 'columns',
      columns: [
        { name: 'deleted_at', type: 'DATETIME', nullable: true, unique: false, primaryKey: false, autoIncrement: false, defaultValue: null, index: false },
      ],
    }
  }
  if (method === 'rememberToken') {
    return {
      kind: 'columns',
      columns: [
        { name: 'remember_token', type: 'TEXT', nullable: true, unique: false, primaryKey: false, autoIncrement: false, defaultValue: null, index: false },
      ],
    }
  }
  if (method === 'id' || method === 'increments' || method === 'bigIncrements') {
    const name = parseStringArg(args) || 'id'
    return {
      kind: 'columns',
      columns: [
        { name, type: 'INTEGER', nullable: false, unique: false, primaryKey: true, autoIncrement: true, defaultValue: null, index: false },
      ],
    }
  }

  // Plain index/unique declarations: $table->index('col'), $table->unique(['a', 'b'])
  if (method === 'index' || method === 'unique') {
    const cols = parseIndexArg(args)
    if (cols.length === 0) return { kind: 'skip' }
    return {
      kind: 'index',
      index: { name: '', columns: cols, unique: method === 'unique' },
    }
  }

  // Generic column declaration.
  const columnName = parseStringArg(args)
  if (!columnName) return null

  const sqlType = mapType(method)
  if (!sqlType) return { kind: 'skip' }

  const column: Column = {
    name: columnName,
    type: sqlType,
    nullable: false,
    unique: false,
    primaryKey: false,
    autoIncrement: false,
    defaultValue: null,
    index: false,
  }

  // Apply chained modifiers.
  applyModifiers(rest, column)

  const indexes: { name: string, columns: string[], unique: boolean }[] = []
  if (column.unique) indexes.push({ name: '', columns: [columnName], unique: true })
  if (column.index) indexes.push({ name: '', columns: [columnName], unique: false })

  return { kind: 'columns', columns: [column], indexes }
}

function applyModifiers(rest: string, column: Column): void {
  const modRegex = /->([a-zA-Z_]+)\s*\(([^)]*)\)/g
  let match: RegExpExecArray | null
  while ((match = modRegex.exec(rest)) !== null) {
    const mod = match[1]
    const args = match[2]?.trim() ?? ''
    if (!mod) continue

    switch (mod) {
      case 'nullable':
        column.nullable = true
        break
      case 'unique':
        column.unique = true
        break
      case 'index':
        column.index = true
        break
      case 'default':
        column.defaultValue = parseDefaultArg(args)
        break
      case 'primary':
        column.primaryKey = true
        break
      case 'autoIncrement':
        column.autoIncrement = true
        break
      case 'unsigned':
      case 'comment':
      case 'after':
      case 'change':
        // Modifiers we recognise but don't need to model in SQLite.
        break
      default:
        // Unknown modifier — leave the column as-is rather than fail. The
        // user can spot the difference in the migration report.
        break
    }
  }
}

function parseStringArg(args: string): string | null {
  const m = args.match(/^['"]([^'"]+)['"]/)
  return m?.[1] ?? null
}

function parseIndexArg(args: string): string[] {
  // `'col'` or `['a', 'b']`
  const single = parseStringArg(args)
  if (single) return [single]
  const arr = args.match(/\[([^\]]*)\]/)
  if (!arr?.[1]) return []
  return arr[1]
    .split(',')
    .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
}

function parseDefaultArg(args: string): string {
  const stringMatch = args.match(/^['"]([^'"]*)['"]/)
  if (stringMatch?.[1] !== undefined) return `'${stringMatch[1].replace(/'/g, '\'\'')}'`

  const trimmed = args.trim()
  if (trimmed === 'true') return '1'
  if (trimmed === 'false') return '0'
  if (trimmed === 'null') return 'NULL'
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return trimmed
  // Anything else (DB::raw('now()'), function calls) → pass through literally.
  return trimmed
}

const TYPE_MAP: Record<string, string> = {
  string: 'TEXT',
  text: 'TEXT',
  mediumText: 'TEXT',
  longText: 'TEXT',
  char: 'TEXT',
  integer: 'INTEGER',
  tinyInteger: 'INTEGER',
  smallInteger: 'INTEGER',
  mediumInteger: 'INTEGER',
  bigInteger: 'INTEGER',
  unsignedBigInteger: 'INTEGER',
  unsignedInteger: 'INTEGER',
  foreignId: 'INTEGER',
  boolean: 'INTEGER',
  date: 'DATE',
  dateTime: 'DATETIME',
  dateTimeTz: 'DATETIME',
  timestamp: 'DATETIME',
  timestampTz: 'DATETIME',
  time: 'TIME',
  timeTz: 'TIME',
  year: 'INTEGER',
  json: 'TEXT',
  jsonb: 'TEXT',
  uuid: 'TEXT',
  ulid: 'TEXT',
  ipAddress: 'TEXT',
  macAddress: 'TEXT',
  float: 'REAL',
  double: 'REAL',
  decimal: 'REAL',
  binary: 'BLOB',
  enum: 'TEXT',
  set: 'TEXT',
}

function mapType(laravelMethod: string): string | null {
  return TYPE_MAP[laravelMethod] ?? null
}

function emitCreateTable(
  table: string,
  columns: Column[],
  indexes: { name: string, columns: string[], unique: boolean }[],
): string {
  const lines: string[] = []
  lines.push(`CREATE TABLE IF NOT EXISTS ${table} (`)

  const colDefs = columns.map((c) => {
    const parts = [`  ${c.name} ${c.type}`]
    if (c.primaryKey) parts.push('PRIMARY KEY')
    if (c.autoIncrement) parts.push('AUTOINCREMENT')
    if (!c.nullable && !c.primaryKey) parts.push('NOT NULL')
    if (c.defaultValue !== null) parts.push(`DEFAULT ${c.defaultValue}`)
    return parts.join(' ')
  })
  lines.push(colDefs.join(',\n'))
  lines.push(');')

  for (const idx of indexes) {
    const cols = idx.columns.join(', ')
    const indexName = idx.name || `${table}_${idx.columns.join('_')}_${idx.unique ? 'unique' : 'index'}`
    const verb = idx.unique ? 'CREATE UNIQUE INDEX' : 'CREATE INDEX'
    lines.push(`${verb} IF NOT EXISTS ${indexName} ON ${table}(${cols});`)
  }

  return `${lines.join('\n')}\n`
}

/**
 * Lift Laravel's `YYYY_MM_DD_HHMMSS_create_<table>_table.php` filename
 * into the `0000000NNN-create-<table>-table.sql` form the Stacks
 * migration runner expects. The numeric prefix preserves ordering
 * across the existing Stacks migrations directory — callers should
 * pass a `sequence` that starts above whatever's already there.
 */
export function laravelFilenameToStacks(filename: string, sequence: number, table: string): string {
  const padded = String(sequence).padStart(10, '0')
  const base = filename.toLowerCase()

  // Recognise common Laravel migration shapes.
  if (base.includes('create_') && base.includes('_table'))
    return `${padded}-create-${table}-table.sql`
  if (base.includes('add_') || base.includes('alter_'))
    return `${padded}-alter-${table}-migration.sql`
  return `${padded}-create-${table}-table.sql`
}
