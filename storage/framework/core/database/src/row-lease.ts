import { randomUUID } from 'node:crypto'
import { db, getDatabaseDialect } from './utils'
import { assertSqlIdentifier, lockRow } from './row-lock'
import { mutationCount } from './affected-rows'

export interface RowLeaseColumns { token: string, heartbeat: string }
export interface RowLease {
  token: string
  /** Check fencing inside the transaction that will commit a batch. */
  assertOwned: () => Promise<void>
  commit: <T>(work: () => Promise<T>) => Promise<T>
  renew: () => Promise<boolean>
  release: () => Promise<void>
}

/**
 * Atomically lease one owner-scoped row without holding a transaction over I/O.
 * Columns belong to the caller's model. All writes and release are fenced by
 * the generated token, so an expired worker cannot renew or release its successor.
 */
export async function claimRowLease(table: string, scope: Record<string, string | number>, columns: RowLeaseColumns, ttlMs: number): Promise<RowLease | null> {
  for (const name of [table, ...Object.keys(scope), columns.token, columns.heartbeat]) assertSqlIdentifier(name)
  if (!Object.keys(scope).length || !Number.isSafeInteger(ttlMs) || ttlMs < 1) throw new RangeError('A row lease requires an owner scope and a positive TTL')
  const token = randomUUID()
  const scoped = (query: any) => {
    for (const [column, value] of Object.entries(scope)) query = query.where(column, '=', value)
    return query
  }
  const quote = getDatabaseDialect() === 'mysql' ? '`' : '"'
  const column = (name: string) => `${quote}${name}${quote}`
  const claimed = await db.transaction(async (connection) => {
    // Validate uniqueness before changing any row. The count check also fences
    // a matching row inserted concurrently when the scope has no unique index.
    if (!await lockRow(connection, table, scope)) return false
    const result = await scoped(connection.updateTable(table).set({ [columns.token]: token, [columns.heartbeat]: new Date().toISOString() }))
      .where(db.raw(`(${column(columns.token)} IS NULL OR ${column(columns.heartbeat)} IS NULL OR ${column(columns.heartbeat)} <= ?)`, [new Date(Date.now() - ttlMs).toISOString()])).execute()
    const count = mutationCount(result)
    if (count > 1) throw new Error('A row lease requires a unique scope')
    return count === 1
  })
  if (!claimed) return null
  const owned = () => scoped(db.selectFrom(table).select(columns.token)).where(columns.token, '=', token)
  return {
    token,
    async assertOwned() {
      if (!await owned().executeTakeFirst()) throw new Error('Row lease ownership was lost')
    },
    async commit(work) {
      return db.transaction(async (connection) => {
        if (!await lockRow(connection, table, { ...scope, [columns.token]: token })) throw new Error('Row lease ownership was lost')
        return work()
      })
    },
    async renew() {
      const result = await scoped(db.updateTable(table).set({ [columns.heartbeat]: new Date().toISOString() })).where(columns.token, '=', token).execute()
      return mutationCount(result) > 0 || Boolean(await owned().executeTakeFirst())
    },
    async release() {
      await scoped(db.updateTable(table).set({ [columns.token]: null, [columns.heartbeat]: null })).where(columns.token, '=', token).execute()
    },
  }
}
