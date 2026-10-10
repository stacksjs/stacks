import { randomBytes } from 'node:crypto'
import { assertSqlIdentifier, db } from '@stacksjs/database/runtime'
import { withLockedRow, type LockedRowOptions, type RowScope } from './locked-row'

export type RowTokenAction = 'read' | 'enable' | 'rotate' | 'disable'

export interface RowTokenOptions extends LockedRowOptions {
  table: string
  scope: RowScope
  column: string
  action: RowTokenAction
  /** Disable timestamps for tables without them, or supply the timestamp column. */
  timestampColumn?: string | false
}

export class RowTokenNotFoundError extends Error {
  readonly status = 404
}

/** Manage a stored share/feed credential. Repeated enable preserves the live token. */
export async function rowToken(options: RowTokenOptions): Promise<string | null> {
  const { table, scope, column, action } = options
  const timestamp = options.timestampColumn === undefined ? 'updated_at' : options.timestampColumn
  assertSqlIdentifier(table)
  assertSqlIdentifier(column)
  if (timestamp) assertSqlIdentifier(timestamp)
  for (const key of Object.keys(scope)) assertSqlIdentifier(key)
  if (!['read', 'enable', 'rotate', 'disable'].includes(action)) throw new Error('Invalid token operation')
  if (!Object.keys(scope).length) throw new Error('A token operation requires a scope')
  const currentToken = (row: Record<string, unknown>): string | null => typeof row[column] === 'string' && row[column] ? row[column] as string : null
  if (action === 'read') {
    let query = (options.tx ?? db).selectFrom(table).select([column])
    for (const [key, value] of Object.entries(scope)) query = value === null ? query.whereNull(key) : query.where(key, '=', value)
    const rows = await query.limit(2).execute()
    if (rows.length > 1) throw new Error('Token operations require a unique owner scope')
    const row = rows[0]
    if (!row) throw new RowTokenNotFoundError('Token owner not found')
    return currentToken(row)
  }
  // An object wrapper distinguishes a missing owner from a disabled (null) token.
  const result = await withLockedRow(table, scope, async (row, tx) => {
    const current = currentToken(row)
    const token = action === 'disable' ? null : action === 'enable' && current ? current : randomBytes(32).toString('hex')
    if (token !== current) {
      const values: Record<string, unknown> = { [column]: token }
      if (timestamp) values[timestamp] = new Date().toISOString()
      let update = tx.updateTable(table).set(values)
      for (const [key, value] of Object.entries(scope)) update = value === null ? update.whereNull(key) : update.where(key, '=', value)
      await update.execute()
    }
    return { token }
  }, options)
  if (!result) throw new RowTokenNotFoundError('Token owner not found')
  return result.token
}
