import type { QueryBuilderDialect } from '@stacksjs/database/runtime'
import { db, getDatabaseDialect } from '@stacksjs/database/runtime'
import type { QueryReader } from '../Content/content-list'
import { containsPattern, countOf, LIST_PAGE_SIZES, pageWithin, queryText } from '../Content/content-list'
import { commerceIdentifier, commerceValue, referencedIds } from './commerce-record'
import type { CommerceSqlRunner } from './commerce-sql'
import { asText, binder, idPlaceholders, sqlRows } from './commerce-sql'
import type { RestaurantWaitlistRecord, RestaurantWaitlistSummary } from './restaurant-waitlist-records'
import { normalizeRestaurantWaitlistRecord } from './restaurant-waitlist-records'

/**
 * One page of the restaurant waitlist, searched, filtered, sorted and counted
 * by the database, with the summary of every party (stacksjs/stacks#3218).
 *
 * The page used to read the newest 500 parties and do all of that in the
 * browser, and the summary counted those 500. Its record check read the first
 * 500 customers by name, so one party linked to any later customer failed the
 * whole page.
 */
export const RESTAURANT_WAITLIST_SORTS = ['created', 'id', 'name', 'party', 'status', 'quoted', 'preference', 'checkin'] as const
export type RestaurantWaitlistSort = typeof RESTAURANT_WAITLIST_SORTS[number]

export const RESTAURANT_WAITLIST_STATUSES = ['waiting', 'seated', 'cancelled', 'no_show'] as const
export const RESTAURANT_TABLE_PREFERENCES = ['indoor', 'bar', 'booth', 'no_preference'] as const

export interface RestaurantWaitlistListQuery {
  search: string
  /** '' for any. */
  status: '' | typeof RESTAURANT_WAITLIST_STATUSES[number]
  /** '' for any. */
  preference: '' | typeof RESTAURANT_TABLE_PREFERENCES[number]
  sort: RestaurantWaitlistSort
  direction: 'asc' | 'desc'
  page: number
  perPage: number
}

export function parseRestaurantWaitlistListQuery(read: QueryReader): RestaurantWaitlistListQuery | { error: string } {
  const pageText = queryText(read, 'page')
  const page = pageText === '' ? 1 : Number(pageText)
  if (!Number.isInteger(page) || page < 1)
    return { error: 'page must be a whole number of 1 or more.' }

  const sizeText = queryText(read, 'per_page')
  const perPage = sizeText === '' ? 25 : Number(sizeText)
  if (!(LIST_PAGE_SIZES as readonly number[]).includes(perPage))
    return { error: `per_page must be one of ${LIST_PAGE_SIZES.join(', ')}.` }

  const sort = queryText(read, 'sort') || 'created'
  if (!(RESTAURANT_WAITLIST_SORTS as readonly string[]).includes(sort))
    return { error: `sort must be one of ${RESTAURANT_WAITLIST_SORTS.join(', ')}.` }

  const directionText = queryText(read, 'direction').toLowerCase()
  const direction = directionText === '' ? (sort === 'created' || sort === 'checkin' ? 'desc' : 'asc') : directionText
  if (direction !== 'asc' && direction !== 'desc')
    return { error: 'direction must be asc or desc.' }

  const search = queryText(read, 'q')
  if (search.length > 200)
    return { error: 'q must be 200 characters or fewer.' }

  const status = queryText(read, 'status')
  if (status && !(RESTAURANT_WAITLIST_STATUSES as readonly string[]).includes(status))
    return { error: `status must be one of ${RESTAURANT_WAITLIST_STATUSES.join(', ')}.` }

  const preference = queryText(read, 'preference')
  if (preference && !(RESTAURANT_TABLE_PREFERENCES as readonly string[]).includes(preference))
    return { error: `preference must be one of ${RESTAURANT_TABLE_PREFERENCES.join(', ')}.` }

  return {
    search,
    status: status as RestaurantWaitlistListQuery['status'],
    preference: preference as RestaurantWaitlistListQuery['preference'],
    sort: sort as RestaurantWaitlistSort,
    direction,
    page,
    perPage,
  }
}

function sortExpression(sort: RestaurantWaitlistSort, dialect: QueryBuilderDialect): string {
  switch (sort) {
    case 'id': return 'id'
    case 'name': return 'LOWER(name)'
    case 'party': return 'party_size'
    // As text: PostgreSQL and MySQL keep both as enums, which sort by declaration order.
    case 'status': return asText('status', dialect)
    case 'preference': return asText('table_preference', dialect)
    case 'quoted': return 'quoted_wait_time'
    case 'checkin': return 'check_in_time'
    default: return 'created_at'
  }
}

export function restaurantWaitlistFilter(query: Pick<RestaurantWaitlistListQuery, 'search' | 'status' | 'preference'>, dialect: QueryBuilderDialect): { where: string, values: unknown[] } {
  const { bind, values } = binder(dialect)
  const clauses: string[] = []
  if (query.status)
    clauses.push(`${asText('status', dialect)} = ${bind(query.status)}`)
  if (query.preference)
    clauses.push(`${asText('table_preference', dialect)} = ${bind(query.preference)}`)
  if (query.search) {
    const pattern = containsPattern(query.search)
    const columns = ['name', 'email', `COALESCE(phone, '')`, asText('status', dialect), asText('table_preference', dialect)]
    clauses.push(`(${columns.map(column => `LOWER(${column}) LIKE ${bind(pattern)} ESCAPE '!'`).join(' OR ')})`)
  }
  return { where: clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '', values }
}

function orderBy(query: Pick<RestaurantWaitlistListQuery, 'sort' | 'direction'>, dialect: QueryBuilderDialect): string {
  const direction = query.direction === 'asc' ? 'ASC' : 'DESC'
  // Ties read newest first; the id breaks every remaining tie, so pages never
  // repeat or skip a party.
  if (query.sort === 'created' || query.sort === 'id')
    return ` ORDER BY ${sortExpression(query.sort, dialect)} ${direction}, id ${direction}`
  return ` ORDER BY ${sortExpression(query.sort, dialect)} ${direction}, created_at DESC, id DESC`
}

/** Parties turned into records, against exactly the customers they reference. */
async function recordsFor(parties: Array<Record<string, unknown>>, run: CommerceSqlRunner, dialect: QueryBuilderDialect): Promise<RestaurantWaitlistRecord[]> {
  if (parties.length === 0)
    return []
  const customerIds = referencedIds(parties, 'customer_id')
  const customers = customerIds.length > 0
    ? await run.unsafe(`SELECT id FROM customers WHERE id IN (${idPlaceholders(customerIds, dialect)})`, customerIds).execute()
    : []
  const known = new Set(sqlRows(customers).map(row => commerceIdentifier(commerceValue(row, 'id'), 'Customer')))
  return parties.map(party => normalizeRestaurantWaitlistRecord(party, known))
}

/** The summary cards, over every party as before. */
async function summarize(run: CommerceSqlRunner, dialect: QueryBuilderDialect): Promise<RestaurantWaitlistSummary> {
  const status = asText('status', dialect)
  const count = (name: string) => `SUM(CASE WHEN ${status} = '${name}' THEN 1 ELSE 0 END)`
  const row = sqlRows(await run.unsafe(
    `SELECT COUNT(*) AS total_count, ${count('waiting')} AS waiting_count, ${count('seated')} AS seated_count, ${count('cancelled')} AS cancelled_count, ${count('no_show')} AS no_show_count, SUM(CASE WHEN ${status} = 'waiting' THEN quoted_wait_time ELSE 0 END) AS waiting_quoted FROM waitlist_restaurants`,
  ).execute())[0] ?? {}
  const total = countOf(row.total_count)
  const waiting = countOf(row.waiting_count)
  const seated = countOf(row.seated_count)
  return {
    total,
    waiting,
    seated,
    cancelled: countOf(row.cancelled_count),
    noShow: countOf(row.no_show_count),
    // Over the parties still waiting, as summarizeRestaurantWaitlist has it.
    averageQuotedWait: waiting === 0 ? 0 : Math.round(countOf(row.waiting_quoted) / waiting),
    seatingRate: total === 0 ? 0 : Math.round((seated / total) * 1000) / 10,
  }
}

export interface RestaurantWaitlistPage {
  records: RestaurantWaitlistRecord[]
  total: number
  page: number
  summary: RestaurantWaitlistSummary
}

export async function readRestaurantWaitlistPage(
  query: RestaurantWaitlistListQuery,
  run: CommerceSqlRunner = db,
  dialect: QueryBuilderDialect = getDatabaseDialect(),
): Promise<RestaurantWaitlistPage> {
  const { where, values } = restaurantWaitlistFilter(query, dialect)
  const [counted, summary] = await Promise.all([
    run.unsafe(`SELECT COUNT(*) AS total_count FROM waitlist_restaurants${where}`, values).execute(),
    summarize(run, dialect),
  ])
  const total = countOf(sqlRows(counted)[0]?.total_count)
  const page = pageWithin(query.page, total, query.perPage)
  const parties = await run.unsafe(
    `SELECT * FROM waitlist_restaurants${where}${orderBy(query, dialect)} LIMIT ${query.perPage} OFFSET ${(page - 1) * query.perPage}`,
    values,
  ).execute()
  return { records: await recordsFor(sqlRows(parties), run, dialect), total, page, summary }
}
