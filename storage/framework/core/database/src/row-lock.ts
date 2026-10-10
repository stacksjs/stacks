import { sqlHelpers } from './sql-helpers'
import { getDatabaseDialect } from './utils'

/** Check trusted table/column names before composing a scoped operation. */
export function assertSqlIdentifier(name: string): void {
  if (!/^[a-z_][a-z_0-9]*$/i.test(name)) throw new Error(`Invalid SQL identifier: ${name}`)
}

/** Lock a scoped row until the caller's transaction commits. SQLite transactions serialize writers. */
export async function lockRow(connection: { unsafe?: (query: string, params?: unknown[]) => PromiseLike<Record<string, unknown>[]> }, table: string, filters: Record<string, string | number | null>): Promise<Record<string, unknown> | undefined> {
  const dialect = sqlHelpers(getDatabaseDialect())
  const quote = dialect.isMysql ? '`' : '"'
  const identifier = (name: string) => {
    assertSqlIdentifier(name)
    return `${quote}${name}${quote}`
  }
  const values: Array<string | number> = []
  const conditions = Object.entries(filters).map(([name, value]) => {
    if (value === null) return `${identifier(name)} IS NULL`
    values.push(value)
    return `${identifier(name)} = ${dialect.param(values.length)}`
  })
  if (!conditions.length) throw new Error('A row lock requires a scope')
  const suffix = dialect.isPostgres || dialect.isMysql ? ' FOR UPDATE' : ''
  if (!connection.unsafe) throw new Error('Row locks require a database connection')
  const rows = await connection.unsafe(`SELECT * FROM ${identifier(table)} WHERE ${conditions.join(' AND ')}${suffix}`, values)
  if (rows.length > 1) throw new Error('A row lock requires a unique scope')
  return rows[0]
}


export interface RowLockGroupOptions {
  /** One application-selected numeric primary key column. */
  key?: string
  /** Shared ownership filters, applied to every row. */
  scope?: Record<string, string | number | null>
}

/** Lock a group in one deterministic order, independent of the request's ordering. */
export async function lockRows(connection: Parameters<typeof lockRow>[0], table: string, ids: readonly (string | number)[], options: RowLockGroupOptions = {}): Promise<Map<string, Record<string, unknown> | undefined>> {
  const key = options.key ?? 'id'
  assertSqlIdentifier(table)
  assertSqlIdentifier(key)
  if (Object.prototype.hasOwnProperty.call(options.scope ?? {}, key)) throw new Error('The group scope cannot replace its primary key')
  const unique = new Map<string, number>()
  for (const id of ids) {
    if (typeof id !== 'number' && (typeof id !== 'string' || !/^\d+$/.test(id))) throw new Error('Group locks require numeric primary keys')
    const number = Number(id)
    if (!Number.isSafeInteger(number) || number <= 0) throw new Error('Invalid row key')
    unique.set(String(number), number)
  }
  const rows = new Map<string, Record<string, unknown> | undefined>()
  for (const name of [...unique.keys()].sort()) {
    rows.set(name, await lockRow(connection, table, { ...options.scope, [key]: unique.get(name)! }))
  }
  return rows
}
