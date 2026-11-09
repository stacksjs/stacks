import { db } from '@stacksjs/database/runtime'
import type { NotificationDeliveryRow } from './notification-delivery'

export const DELIVERY_CHANNELS = ['email', 'sms', 'chat', 'database', 'push', 'broadcast'] as const
export const DELIVERY_STATUSES = ['sent', 'delivered', 'failed', 'pending'] as const
export const DELIVERY_SORTS = ['sent_at', 'recipient', 'channel', 'status', 'id'] as const

/** The columns the History search looks in. */
export const DELIVERY_SEARCH_COLUMNS = ['recipient', 'subject', 'body', 'error'] as const

export interface DeliveryHistoryQuery {
  page: number
  perPage: number
  channel: typeof DELIVERY_CHANNELS[number] | null
  status: typeof DELIVERY_STATUSES[number] | null
  /** Matched anywhere in a searched column, ignoring case. Empty matches every row. */
  search: string
  sort: typeof DELIVERY_SORTS[number]
  direction: 'asc' | 'desc'
}

export interface DeliveryHistoryPage {
  rows: NotificationDeliveryRow[]
  /** How many rows match, across every page, as the database counted them. */
  total: unknown
}

/**
 * One page of `notification_deliveries`, filtered, searched, sorted and
 * sliced by the database.
 *
 * The search used to hand `where` a Kysely-style expression callback, which
 * bun-query-builder calls with a proxy rather than a function, so every
 * search threw and the History page answered 503. It is a `whereGroup` of
 * `whereILike` now, which binds the term and ignores case on every dialect
 * (ILIKE on PostgreSQL, where a plain LIKE is case-sensitive, as in
 * stacksjs/stacks#3202).
 *
 * The order ends on `id` in the same direction, so rows that tie on the sort
 * column (every failed delivery, sorted by status) keep one order from page to
 * page instead of whatever the database returns that time.
 */
export async function readDeliveryHistory(query: DeliveryHistoryQuery): Promise<DeliveryHistoryPage> {
  const applyFilters = (chain: any): any => {
    let filtered = chain
    if (query.channel)
      filtered = filtered.where('channel', '=', query.channel)
    if (query.status)
      filtered = filtered.where('status', '=', query.status)
    if (query.search) {
      const pattern = `%${query.search}%`
      filtered = filtered.whereGroup((group: any) => {
        for (const [index, column] of DELIVERY_SEARCH_COLUMNS.entries())
          group = index === 0 ? group.whereILike(column, pattern) : group.orWhereILike(column, pattern)
        return group
      })
    }
    return filtered
  }

  let rowsQuery = applyFilters(db.selectFrom('notification_deliveries').selectAll())
    .orderBy(query.sort, query.direction)
  if (query.sort !== 'id')
    rowsQuery = rowsQuery.orderBy('id', query.direction)

  const [countRow, rows] = await Promise.all([
    applyFilters(db.selectFrom('notification_deliveries').select(db.fn.count('id').as('count'))).executeTakeFirst() as Promise<{ count: number | string } | undefined>,
    rowsQuery
      .limit(query.perPage)
      .offset((query.page - 1) * query.perPage)
      .execute() as Promise<NotificationDeliveryRow[]>,
  ])
  return { rows, total: countRow?.count ?? 0 }
}
