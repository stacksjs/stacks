import type { QueryBuilderDialect } from '@stacksjs/database/runtime'
import { db, getDatabaseDialect } from '@stacksjs/database/runtime'
import type { QueryReader } from '../Content/content-list'
import { containsPattern, countOf, LIST_PAGE_SIZES, pageWithin, queryText } from '../Content/content-list'
import { commerceIdentifier, commerceRequiredString, commerceValue, referencedIds } from './commerce-record'
import type { CommerceSqlRunner } from './commerce-sql'
import { asText, binder, idPlaceholders, isTrue, sqlRows } from './commerce-sql'
import type { CouponDiscountType, CouponRecord, CouponStatus, CouponSummary } from './coupon-records'
import { normalizeCouponRecord } from './coupon-records'

/**
 * One page of coupons, searched, filtered, sorted and counted by the
 * database, with the summary and breakdowns of every coupon
 * (stacksjs/stacks#3218).
 *
 * The Coupons page used to read the newest 500 coupons and do all of that in
 * the browser, so an older coupon could not be found, the cards, the status
 * and type breakdowns and "Most redeemed" counted those 500, and "Export
 * filtered" wrote only them. The record check read the first 500 products,
 * so a coupon for any later product failed the whole page.
 */
export const COUPON_SORTS = ['newest', 'code', 'usage', 'expiry', 'start', 'status', 'availability'] as const
export type CouponSort = typeof COUPON_SORTS[number]

export const COUPON_STATUSES: readonly CouponStatus[] = ['Active', 'Scheduled', 'Expired']
export const COUPON_DISCOUNT_TYPES: readonly CouponDiscountType[] = ['percentage', 'fixed_amount']

export interface CouponListQuery {
  search: string
  /** '' for any. */
  status: '' | CouponStatus
  /** '' for any. */
  enabled: '' | 'enabled' | 'disabled'
  /** '' for any. */
  type: '' | CouponDiscountType
  sort: CouponSort
  direction: 'asc' | 'desc'
  page: number
  perPage: number
}

const DESCENDING: readonly CouponSort[] = ['newest', 'usage']

export function parseCouponListQuery(read: QueryReader): CouponListQuery | { error: string } {
  const pageText = queryText(read, 'page')
  const page = pageText === '' ? 1 : Number(pageText)
  if (!Number.isInteger(page) || page < 1)
    return { error: 'page must be a whole number of 1 or more.' }

  const sizeText = queryText(read, 'per_page')
  const perPage = sizeText === '' ? 25 : Number(sizeText)
  if (!(LIST_PAGE_SIZES as readonly number[]).includes(perPage))
    return { error: `per_page must be one of ${LIST_PAGE_SIZES.join(', ')}.` }

  const sort = queryText(read, 'sort') || 'newest'
  if (!(COUPON_SORTS as readonly string[]).includes(sort))
    return { error: `sort must be one of ${COUPON_SORTS.join(', ')}.` }

  const directionText = queryText(read, 'direction').toLowerCase()
  const direction = directionText === '' ? (DESCENDING.includes(sort as CouponSort) ? 'desc' : 'asc') : directionText
  if (direction !== 'asc' && direction !== 'desc')
    return { error: 'direction must be asc or desc.' }

  const search = queryText(read, 'q')
  if (search.length > 200)
    return { error: 'q must be 200 characters or fewer.' }

  const status = queryText(read, 'status')
  if (status && !(COUPON_STATUSES as readonly string[]).includes(status))
    return { error: `status must be one of ${COUPON_STATUSES.join(', ')}.` }

  const enabled = queryText(read, 'enabled')
  if (enabled && enabled !== 'enabled' && enabled !== 'disabled')
    return { error: 'enabled must be enabled or disabled.' }

  const type = queryText(read, 'type')
  if (type && !(COUPON_DISCOUNT_TYPES as readonly string[]).includes(type))
    return { error: `type must be one of ${COUPON_DISCOUNT_TYPES.join(', ')}.` }

  return {
    search,
    status: status as CouponListQuery['status'],
    enabled: enabled as CouponListQuery['enabled'],
    type: type as CouponListQuery['type'],
    sort: sort as CouponSort,
    direction,
    page,
    perPage,
  }
}

function sortExpression(sort: CouponSort, dialect: QueryBuilderDialect): string {
  switch (sort) {
    case 'code': return 'LOWER(code)'
    case 'usage': return 'usage_count'
    case 'expiry': return 'end_date'
    case 'start': return 'start_date'
    case 'status': return asText('status', dialect)
    case 'availability': return `CASE WHEN ${isTrue('is_active', dialect)} THEN 1 ELSE 0 END`
    default: return 'id'
  }
}

export function couponFilter(query: Pick<CouponListQuery, 'search' | 'status' | 'enabled' | 'type'>, dialect: QueryBuilderDialect): { where: string, values: unknown[] } {
  const { bind, values } = binder(dialect)
  const clauses: string[] = []
  // Text comparisons: PostgreSQL may keep these as enums.
  if (query.status)
    clauses.push(`${asText('status', dialect)} = ${bind(query.status)}`)
  if (query.type)
    clauses.push(`${asText('discount_type', dialect)} = ${bind(query.type)}`)
  if (query.enabled === 'enabled')
    clauses.push(isTrue('is_active', dialect))
  if (query.enabled === 'disabled')
    clauses.push(`NOT (${isTrue('is_active', dialect)})`)
  if (query.search) {
    const pattern = containsPattern(query.search)
    const columns = ['code', `COALESCE(description, '')`, `COALESCE(free_product_id, '')`]
    clauses.push(`(${columns.map(column => `LOWER(${column}) LIKE ${bind(pattern)} ESCAPE '!'`).join(' OR ')})`)
  }
  return { where: clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '', values }
}

function orderBy(query: Pick<CouponListQuery, 'sort' | 'direction'>, dialect: QueryBuilderDialect): string {
  const direction = query.direction === 'asc' ? 'ASC' : 'DESC'
  if (query.sort === 'newest')
    return ` ORDER BY id ${direction}`
  // Coupons without the date come last either way: each dialect puts NULL at
  // a different end of the order, and a coupon with no end never expires.
  const column = query.sort === 'expiry' ? 'end_date' : query.sort === 'start' ? 'start_date' : ''
  const undated = column ? `CASE WHEN ${column} IS NULL THEN 1 ELSE 0 END ASC, ` : ''
  // Ties read by code, as the page sorted them; the id breaks every
  // remaining tie, so pages never repeat or skip a coupon.
  const byCode = query.sort === 'code' ? '' : ', LOWER(code) ASC'
  return ` ORDER BY ${undated}${sortExpression(query.sort, dialect)} ${direction}${byCode}, id ${direction}`
}

/** Coupons turned into records, against exactly the products they reference. */
async function recordsFor(coupons: Array<Record<string, unknown>>, run: CommerceSqlRunner, dialect: QueryBuilderDialect): Promise<CouponRecord[]> {
  if (coupons.length === 0)
    return []
  const productIds = referencedIds(coupons, 'product_id')
  const products = productIds.length > 0
    ? await run.unsafe(`SELECT id FROM products WHERE id IN (${idPlaceholders(productIds, dialect)})`, productIds).execute()
    : []
  const known = new Set(sqlRows(products).map(row => commerceIdentifier(commerceValue(row, 'id'), 'Product')))
  return coupons.map(coupon => normalizeCouponRecord(coupon, known))
}

/** The summary cards and breakdowns, over every coupon as before. */
async function summarize(run: CommerceSqlRunner, dialect: QueryBuilderDialect): Promise<CouponSummary> {
  const status = asText('status', dialect)
  const type = asText('discount_type', dialect)
  const count = (condition: string) => `SUM(CASE WHEN ${condition} THEN 1 ELSE 0 END)`
  const [totals, used] = await Promise.all([
    run.unsafe(`SELECT COUNT(*) AS total_count, ${count(isTrue('is_active', dialect))} AS enabled_count, ${count(`${status} = 'Active'`)} AS active_count, ${count(`${status} = 'Scheduled'`)} AS scheduled_count, ${count(`${status} = 'Expired'`)} AS expired_count, ${count(`${type} = 'percentage'`)} AS percentage_count, ${count(`${type} = 'fixed_amount'`)} AS fixed_count, SUM(usage_count) AS usage_total FROM coupons`).execute(),
    // "Most redeemed": the five most used, by code on a tie, as the page chose them.
    run.unsafe('SELECT id, code, usage_count FROM coupons ORDER BY usage_count DESC, LOWER(code) ASC, id ASC LIMIT 5').execute(),
  ])
  const row = sqlRows(totals)[0] ?? {}
  return {
    total: countOf(row.total_count),
    enabled: countOf(row.enabled_count),
    active: countOf(row.active_count),
    scheduled: countOf(row.scheduled_count),
    expired: countOf(row.expired_count),
    percentage: countOf(row.percentage_count),
    fixedAmount: countOf(row.fixed_count),
    redemptions: countOf(row.usage_total),
    mostUsed: sqlRows(used).map((entry) => {
      const id = commerceIdentifier(commerceValue(entry, 'id'), 'Coupon')
      return { id, code: commerceRequiredString(commerceValue(entry, 'code'), `Coupon ${id}`, 'code'), usageCount: countOf(entry.usage_count) }
    }),
  }
}

export interface CouponPage {
  records: CouponRecord[]
  total: number
  page: number
  summary: CouponSummary
}

export async function readCouponPage(
  query: CouponListQuery,
  run: CommerceSqlRunner = db,
  dialect: QueryBuilderDialect = getDatabaseDialect(),
): Promise<CouponPage> {
  const { where, values } = couponFilter(query, dialect)
  const [counted, summary] = await Promise.all([
    run.unsafe(`SELECT COUNT(*) AS total_count FROM coupons${where}`, values).execute(),
    summarize(run, dialect),
  ])
  const total = countOf(sqlRows(counted)[0]?.total_count)
  const page = pageWithin(query.page, total, query.perPage)
  const coupons = await run.unsafe(
    `SELECT * FROM coupons${where}${orderBy(query, dialect)} LIMIT ${query.perPage} OFFSET ${(page - 1) * query.perPage}`,
    values,
  ).execute()
  return { records: await recordsFor(sqlRows(coupons), run, dialect), total, page, summary }
}

/** Every coupon matching the query, in its order, for the CSV export, a batch at a time. */
export async function readCouponsForExport(
  query: Omit<CouponListQuery, 'page' | 'perPage'>,
  run: CommerceSqlRunner = db,
  dialect: QueryBuilderDialect = getDatabaseDialect(),
  batchSize: number = 500,
): Promise<CouponRecord[]> {
  const { where, values } = couponFilter(query, dialect)
  const records: CouponRecord[] = []
  for (let offset = 0; ; offset += batchSize) {
    const batch = sqlRows(await run.unsafe(
      `SELECT * FROM coupons${where}${orderBy(query, dialect)} LIMIT ${batchSize} OFFSET ${offset}`,
      values,
    ).execute())
    records.push(...await recordsFor(batch, run, dialect))
    if (batch.length < batchSize)
      return records
  }
}

/** A byte order mark, so spreadsheet apps read the file as UTF-8. */
const BOM = String.fromCharCode(0xFEFF)

/**
 * The CSV "Export filtered" downloads: the page's columns, for every matching
 * coupon. A fixed amount is stored in minor units of the store currency, and
 * the file carries it as a decimal of that currency; the page used to write
 * it as US dollars whatever the store used.
 */
export function couponsCsv(records: CouponRecord[], currency: string, minor: (amount: number, currency: string) => string): string {
  const escape = (value: string): string => `"${value.replaceAll('"', '""')}"`
  const header = ['Code', 'Description', 'Status', 'Availability', 'Discount type', 'Discount value', 'Usage count', 'Usage limit', 'Start date', 'End date']
  const lines = records.map(record => [
    record.code,
    record.description,
    record.status,
    record.isActive ? 'Enabled' : 'Disabled',
    record.discountType,
    record.discountType === 'fixed_amount' ? minor(record.discountValue, currency) : String(record.discountValue),
    String(record.usageCount),
    record.usageLimit === null ? '' : String(record.usageLimit),
    record.startDate,
    record.endDate,
  ])
  return `${BOM}${[header, ...lines].map(row => row.map(escape).join(',')).join('\n')}`
}
