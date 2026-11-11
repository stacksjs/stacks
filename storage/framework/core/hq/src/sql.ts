import type { SqlClient, SqlDialect } from './types'

export class HqSchemaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HqSchemaError'
  }
}

/** Table names are interpolated into DDL, so they are held to an identifier. */
export function tableName(table: string): string {
  if (!/^[A-Z_]\w*$/i.test(table))
    throw new HqSchemaError(`Invalid table name '${table}'.`)
  return table
}

/** The nth bound parameter (1-based) in this dialect's spelling. */
export function placeholder(dialect: SqlDialect, n: number): string {
  return dialect === 'postgres' ? `$${n}` : '?'
}

/**
 * Run one statement and answer its rows.
 *
 * Clients disagree on what `unsafe` returns: a promise of rows, a lazy
 * statement with `execute()`, or an object carrying `rows`. All three are
 * accepted so an adapter never has to wrap its client to use these stores.
 */
export async function runSql(client: SqlClient, sql: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
  const statement = client.unsafe(sql, params) as { execute?: () => Promise<unknown> } | PromiseLike<unknown> | null | undefined
  const result = statement && typeof (statement as { execute?: unknown }).execute === 'function'
    ? await (statement as { execute: () => Promise<unknown> }).execute()
    : await statement
  if (Array.isArray(result))
    return result as Record<string, unknown>[]
  const rows = (result as { rows?: unknown } | null | undefined)?.rows
  return Array.isArray(rows) ? rows as Record<string, unknown>[] : []
}
