import { sqlHelpers } from './sql-helpers'
import { getDatabaseDialect } from './utils'

/** Lock a scoped row until the caller's transaction commits. SQLite transactions serialize writers. */
export async function lockRow(connection: { unsafe?: (query: string, params?: unknown[]) => PromiseLike<Record<string, unknown>[]> }, table: string, filters: Record<string, string | number | null>): Promise<Record<string, unknown> | undefined> {
  const dialect = sqlHelpers(getDatabaseDialect())
  const quote = dialect.isMysql ? '`' : '"'
  const identifier = (name: string) => {
    if (!/^[a-z_][a-z_0-9]*$/i.test(name)) throw new Error(`Invalid SQL identifier: ${name}`)
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
  return rows?.[0]
}
