import type { QueryBuilderDialect } from '@stacksjs/database/runtime'
import { db, getDatabaseDialect } from '@stacksjs/database/runtime'
import { formatDate } from '@stacksjs/orm'
import type { QueryReader } from '../Content/content-list'
import { containsPattern, countOf, LIST_PAGE_SIZES, pageWithin, queryText } from '../Content/content-list'
import { commerceIdentifier, commerceRequiredString, commerceValue } from './commerce-record'
import type { CommerceSqlRunner } from './commerce-sql'
import { asText, binder, idPlaceholders, isTrue, sqlRows } from './commerce-sql'
import type { DiscountMethod, DiscountRecord, DiscountState, DiscountSummary, DiscountType } from './discount-records'
import { DISCOUNT_STATES, DISCOUNT_TYPES, discountProductIds, emptyDiscountSummary, normalizeDiscountRecord } from './discount-records'

/**
 * One page of discounts, searched, filtered, sorted and counted by the
 * database, with the summary of every discount: the same shape as the coupon
 * list (commerce-coupon-list.ts), over the Discount model.
 *
 * A discount's state (active, scheduled, expired, used up, switched off) is
 * worked out in SQL against the current time, so the filter and the counts
 * agree with what the checkout would do right now.
 */
export const DISCOUNT_SORTS = ['newest', 'title', 'usage', 'starts', 'ends', 'type'] as const
export type DiscountSort = typeof DISCOUNT_SORTS[number]

export interface DiscountListQuery {
  search: string
  /** '' for any. */
  method: '' | DiscountMethod
  /** '' for any. */
  type: '' | DiscountType
  /** '' for any. */
  state: '' | DiscountState
  sort: DiscountSort
  direction: 'asc' | 'desc'
  page: number
  perPage: number
}

const DESCENDING: readonly DiscountSort[] = ['newest', 'usage']

export function parseDiscountListQuery(read: QueryReader): DiscountListQuery | { error: string } {
  const pageText = queryText(read, 'page')
  const page = pageText === '' ? 1 : Number(pageText)
  if (!Number.isInteger(page) || page < 1)
    return { error: 'page must be a whole number of 1 or more.' }

  const sizeText = queryText(read, 'per_page')
  const perPage = sizeText === '' ? 25 : Number(sizeText)
  if (!(LIST_PAGE_SIZES as readonly number[]).includes(perPage))
    return { error: `per_page must be one of ${LIST_PAGE_SIZES.join(', ')}.` }

  const sort = queryText(read, 'sort') || 'newest'
  if (!(DISCOUNT_SORTS as readonly string[]).includes(sort))
    return { error: `sort must be one of ${DISCOUNT_SORTS.join(', ')}.` }

  const directionText = queryText(read, 'direction').toLowerCase()
  const direction = directionText === '' ? (DESCENDING.includes(sort as DiscountSort) ? 'desc' : 'asc') : directionText
  if (direction !== 'asc' && direction !== 'desc')
    return { error: 'direction must be asc or desc.' }

  const search = queryText(read, 'q')
  if (search.length > 200)
    return { error: 'q must be 200 characters or fewer.' }

  const method = queryText(read, 'method')
  if (method && method !== 'automatic' && method !== 'code')
    return { error: 'method must be automatic or code.' }

  const type = queryText(read, 'type')
  if (type && !(DISCOUNT_TYPES as readonly string[]).includes(type))
    return { error: `type must be one of ${DISCOUNT_TYPES.join(', ')}.` }

  const state = queryText(read, 'state')
  if (state && !(DISCOUNT_STATES as readonly string[]).includes(state))
    return { error: `state must be one of ${DISCOUNT_STATES.join(', ')}.` }

  return {
    search,
    method: method as DiscountListQuery['method'],
    type: type as DiscountListQuery['type'],
    state: state as DiscountListQuery['state'],
    sort: sort as DiscountSort,
    direction,
    page,
    perPage,
  }
}

/**
 * The SQL condition for each state, in the order the engine checks them. Each
 * call binds `now` afresh: positional placeholders (`?`) cannot be reused, so
 * a fragment is rendered where it is used, in the order it appears.
 */
function stateCondition(state: DiscountState, dialect: QueryBuilderDialect, bind: (value: unknown) => string, nowValue: string): string {
  const enabled = `(is_active IS NULL OR ${isTrue('is_active', dialect)})`
  const started = () => `(starts_at IS NULL OR starts_at <= ${bind(nowValue)})`
  const notEnded = () => `(ends_at IS NULL OR ends_at >= ${bind(nowValue)})`
  const left = '(usage_limit IS NULL OR COALESCE(usage_count, 0) < usage_limit)'
  switch (state) {
    case 'disabled': return `NOT ${enabled}`
    case 'scheduled': return `${enabled} AND NOT ${started()}`
    case 'expired': return `${enabled} AND ${started()} AND NOT ${notEnded()}`
    case 'exhausted': return `${enabled} AND ${started()} AND ${notEnded()} AND NOT ${left}`
    case 'active': return `${enabled} AND ${started()} AND ${notEnded()} AND ${left}`
  }
}

export function discountFilter(query: Pick<DiscountListQuery, 'search' | 'method' | 'type' | 'state'>, dialect: QueryBuilderDialect, nowValue: string): { where: string, values: unknown[] } {
  const { bind, values } = binder(dialect)
  const clauses: string[] = []
  if (query.method === 'automatic')
    clauses.push(`(code IS NULL OR code = '')`)
  if (query.method === 'code')
    clauses.push(`(code IS NOT NULL AND code <> '')`)
  if (query.type)
    clauses.push(`${asText('type', dialect)} = ${bind(query.type)}`)
  if (query.state)
    clauses.push(`(${stateCondition(query.state, dialect, bind, nowValue)})`)
  if (query.search) {
    const pattern = containsPattern(query.search)
    clauses.push(`(${['title', `COALESCE(code, '')`].map(column => `LOWER(${column}) LIKE ${bind(pattern)} ESCAPE '!'`).join(' OR ')})`)
  }
  return { where: clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '', values }
}

function orderBy(query: Pick<DiscountListQuery, 'sort' | 'direction'>, dialect: QueryBuilderDialect): string {
  const direction = query.direction === 'asc' ? 'ASC' : 'DESC'
  switch (query.sort) {
    case 'title': return ` ORDER BY LOWER(title) ${direction}, id ${direction}`
    case 'usage': return ` ORDER BY COALESCE(usage_count, 0) ${direction}, LOWER(title) ASC, id ${direction}`
    case 'type': return ` ORDER BY ${asText('type', dialect)} ${direction}, LOWER(title) ASC, id ${direction}`
    // Undated discounts last either way: each dialect puts NULL at a
    // different end, and a discount with no end never expires.
    case 'starts': return ` ORDER BY CASE WHEN starts_at IS NULL THEN 1 ELSE 0 END ASC, starts_at ${direction}, id ${direction}`
    case 'ends': return ` ORDER BY CASE WHEN ends_at IS NULL THEN 1 ELSE 0 END ASC, ends_at ${direction}, id ${direction}`
    default: return ` ORDER BY id ${direction}`
  }
}

async function summarize(run: CommerceSqlRunner, dialect: QueryBuilderDialect, nowValue: string): Promise<DiscountSummary> {
  const { bind, values } = binder(dialect)
  const count = (condition: string) => `SUM(CASE WHEN ${condition} THEN 1 ELSE 0 END)`
  const type = asText('type', dialect)
  const typeCounts = DISCOUNT_TYPES.map(t => `${count(`${type} = '${t}'`)} AS type_${t}`).join(', ')
  const [totals, used] = await Promise.all([
    run.unsafe(`SELECT COUNT(*) AS total_count, ${count(`(code IS NULL OR code = '')`)} AS automatic_count, ${DISCOUNT_STATES.map(state => `${count(stateCondition(state, dialect, bind, nowValue))} AS state_${state}`).join(', ')}, ${typeCounts}, SUM(COALESCE(usage_count, 0)) AS usage_total FROM discounts`, values).execute(),
    run.unsafe('SELECT id, title, usage_count FROM discounts WHERE COALESCE(usage_count, 0) > 0 ORDER BY usage_count DESC, LOWER(title) ASC, id ASC LIMIT 5').execute(),
  ])
  const row = sqlRows(totals)[0] ?? {}
  const summary = emptyDiscountSummary()
  summary.total = countOf(row.total_count)
  summary.automatic = countOf(row.automatic_count)
  summary.code = summary.total - summary.automatic
  for (const state of DISCOUNT_STATES)
    summary[state] = countOf(row[`state_${state}`])
  for (const t of DISCOUNT_TYPES)
    summary.byType[t] = countOf(row[`type_${t}`])
  summary.redemptions = countOf(row.usage_total)
  summary.mostUsed = sqlRows(used).map((entry) => {
    const id = commerceIdentifier(commerceValue(entry, 'id'), 'Discount')
    return { id, title: commerceRequiredString(commerceValue(entry, 'title'), `Discount ${id}`, 'title'), usageCount: countOf(entry.usage_count) }
  })
  return summary
}

export interface DiscountPage {
  records: DiscountRecord[]
  total: number
  page: number
  summary: DiscountSummary
}

export async function readDiscountPage(
  query: DiscountListQuery,
  currency = 'USD',
  run: CommerceSqlRunner = db,
  dialect: QueryBuilderDialect = getDatabaseDialect(),
  now: Date = new Date(),
): Promise<DiscountPage> {
  const nowValue = formatDate(now)
  const { where, values } = discountFilter(query, dialect, nowValue)
  const [counted, summary] = await Promise.all([
    run.unsafe(`SELECT COUNT(*) AS total_count FROM discounts${where}`, values).execute(),
    summarize(run, dialect, nowValue),
  ])
  const total = countOf(sqlRows(counted)[0]?.total_count)
  const page = pageWithin(query.page, total, query.perPage)
  const rows = await run.unsafe(
    `SELECT * FROM discounts${where}${orderBy(query, dialect)} LIMIT ${query.perPage} OFFSET ${(page - 1) * query.perPage}`,
    values,
  ).execute()
  return { records: await recordsFor(sqlRows(rows), nowValue, currency, run, dialect), total, page, summary }
}

/** Rows as records, with the names of exactly the products their targets name. */
export async function recordsFor(rows: Array<Record<string, unknown>>, nowValue: string, currency: string, run: CommerceSqlRunner, dialect: QueryBuilderDialect): Promise<DiscountRecord[]> {
  const ids = [...new Set(rows.flatMap(discountProductIds))]
  const names = new Map<number, string>()
  if (ids.length > 0) {
    const products = await run.unsafe(`SELECT id, name FROM products WHERE id IN (${idPlaceholders(ids, dialect)})`, ids).execute()
    for (const product of sqlRows(products))
      names.set(Number(product.id), String(product.name ?? `Product #${product.id}`))
  }
  return rows.map(row => normalizeDiscountRecord(row, nowValue, currency, names))
}
