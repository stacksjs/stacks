import type { BoundSqlFragment } from 'bun-query-builder'
import { raw } from 'bun-query-builder'

export type KeysetValue = string | number | boolean | null
export interface KeysetOrder {
  /** Trusted column name, optionally qualified by its table. */
  column: string
  /** Selected row property holding the column's exact value (an alias for joins). */
  key?: string
  direction?: 'asc' | 'desc'
}
interface KeysetQuery<Row> {
  where(fragment: BoundSqlFragment): KeysetQuery<Row>
  orderBy(column: string, direction: 'asc' | 'desc'): KeysetQuery<Row>
  orderByRaw(fragment: ReturnType<typeof raw>): KeysetQuery<Row>
  limit(count: number): KeysetQuery<Row>
  execute(): Promise<Row[]>
}
export interface KeysetPage<Row> {
  data: Row[]
  has_more: boolean
  next_cursor: string | null
}
export class InvalidCursorError extends Error {
  readonly status = 422
  constructor() {
    super('Invalid pagination cursor')
    this.name = 'InvalidCursorError'
  }
}

function value(input: unknown): KeysetValue {
  if (input instanceof Date) return input.toISOString()
  if (input === null || typeof input === 'string' || typeof input === 'boolean' || typeof input === 'number' && Number.isFinite(input)) return input
  throw new InvalidCursorError()
}

/**
 * Forward keyset pagination over a unique ordered tuple. The final column must
 * break ties (usually the primary key); pass an unordered, unbounded query.
 * Nulls sort last on every dialect. Select exact timestamp text under an alias
 * when the database keeps more precision than JavaScript Dates.
 *
 * Cursors are untrusted positions, never authorization. Apply ownership and
 * filters to the query, and bind `scope` to those filters to reject reuse.
 */
export async function keysetPage<Row extends Record<string, unknown>>(query: KeysetQuery<Row>, options: {
  order: readonly KeysetOrder[]
  perPage: number
  cursor?: unknown
  scope: string
}): Promise<KeysetPage<Row>> {
  const { order, perPage, scope } = options
  if (!Number.isSafeInteger(perPage) || perPage < 1 || perPage > 500) throw new RangeError('perPage must be between 1 and 500')
  if (!order.length || order.length > 8 || !scope) throw new TypeError('A scope and unique ordered tuple are required')
  for (const part of order) {
    if (!/^[a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?$/i.test(part.column) || part.direction && !['asc', 'desc'].includes(part.direction)) throw new TypeError('Invalid keyset ordering')
  }
  const contract = JSON.stringify([scope, order.map(part => [part.column, part.key ?? part.column.split('.').at(-1), part.direction ?? 'desc'])])
  let position: KeysetValue[] | undefined
  if (options.cursor !== undefined && options.cursor !== null && options.cursor !== '') {
    try {
      if (typeof options.cursor !== 'string' || options.cursor.length > 8192 || !/^[\w-]+$/.test(options.cursor)) throw new InvalidCursorError()
      const parsed = JSON.parse(Buffer.from(options.cursor, 'base64url').toString())
      if (!Array.isArray(parsed) || parsed.length !== 3 || parsed[0] !== 1 || parsed[1] !== contract || !Array.isArray(parsed[2]) || parsed[2].length !== order.length) throw new InvalidCursorError()
      position = parsed[2].map(value)
    }
    catch { throw new InvalidCursorError() }
  }
  if (position) {
    const parameters: KeysetValue[] = []
    const terms = order.map((part, index) => {
      const conditions = order.slice(0, index).map((previous, prefix) => {
        if (position![prefix] === null) return `${previous.column} IS NULL`
        parameters.push(position![prefix]!)
        return `${previous.column} = ?`
      })
      const current = position![index]!
      if (current === null) conditions.push('1 = 0')
      else {
        parameters.push(current)
        conditions.push(`(${part.column} ${(part.direction ?? 'desc') === 'desc' ? '<' : '>'} ? OR ${part.column} IS NULL)`)
      }
      return `(${conditions.join(' AND ')})`
    })
    query = query.where({ sql: `(${terms.join(' OR ')})`, parameters })
  }
  for (const part of order) {
    query = query.orderByRaw(raw(`CASE WHEN ${part.column} IS NULL THEN 1 ELSE 0 END ASC`))
    query = query.orderBy(part.column, part.direction ?? 'desc')
  }
  const rows = await query.limit(perPage + 1).execute()
  const hasMore = rows.length > perPage
  const data = rows.slice(0, perPage)
  const last = data.at(-1)
  const next = hasMore && last ? order.map(part => value(last[part.key ?? part.column.split('.').at(-1)!])) : null
  return { data, has_more: hasMore, next_cursor: next ? Buffer.from(JSON.stringify([1, contract, next])).toString('base64url') : null }
}
