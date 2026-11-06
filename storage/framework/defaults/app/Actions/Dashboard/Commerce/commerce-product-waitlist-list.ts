import type { QueryBuilderDialect } from '@stacksjs/database/runtime'
import { db, getDatabaseDialect } from '@stacksjs/database/runtime'
import type { QueryReader } from '../Content/content-list'
import { containsPattern, countOf, LIST_PAGE_SIZES, pageWithin, queryText } from '../Content/content-list'
import { commerceIdentifier, commerceRequiredString, commerceValue, referencedIds } from './commerce-record'
import type { CommerceSqlRunner } from './commerce-sql'
import { asText, binder, idPlaceholders, sqlRows } from './commerce-sql'
import type { ProductWaitlistRecord, ProductWaitlistSummary } from './product-waitlist-records'
import { normalizeProductWaitlistRecord } from './product-waitlist-records'

/**
 * One page of the product waitlist, searched, filtered, sorted and counted by
 * the database, with the summary of every entry (stacksjs/stacks#3218).
 *
 * The page used to read the newest 500 entries and do all of that in the
 * browser, and the summary counted those 500. Its record check read the
 * first 500 products and customers by name, so one entry for any later
 * product or customer failed the whole page.
 */
export const PRODUCT_WAITLIST_SORTS = ['created', 'id', 'name', 'product', 'quantity', 'status', 'preference'] as const
export type ProductWaitlistSort = typeof PRODUCT_WAITLIST_SORTS[number]

export const PRODUCT_WAITLIST_STATUSES = ['waiting', 'notified', 'purchased', 'cancelled'] as const

export interface ProductWaitlistListQuery {
  search: string
  /** '' for any. */
  status: '' | typeof PRODUCT_WAITLIST_STATUSES[number]
  sort: ProductWaitlistSort
  direction: 'asc' | 'desc'
  page: number
  perPage: number
}

export function parseProductWaitlistListQuery(read: QueryReader): ProductWaitlistListQuery | { error: string } {
  const pageText = queryText(read, 'page')
  const page = pageText === '' ? 1 : Number(pageText)
  if (!Number.isInteger(page) || page < 1)
    return { error: 'page must be a whole number of 1 or more.' }

  const sizeText = queryText(read, 'per_page')
  const perPage = sizeText === '' ? 25 : Number(sizeText)
  if (!(LIST_PAGE_SIZES as readonly number[]).includes(perPage))
    return { error: `per_page must be one of ${LIST_PAGE_SIZES.join(', ')}.` }

  const sort = queryText(read, 'sort') || 'created'
  if (!(PRODUCT_WAITLIST_SORTS as readonly string[]).includes(sort))
    return { error: `sort must be one of ${PRODUCT_WAITLIST_SORTS.join(', ')}.` }

  const directionText = queryText(read, 'direction').toLowerCase()
  const direction = directionText === '' ? (sort === 'created' || sort === 'quantity' ? 'desc' : 'asc') : directionText
  if (direction !== 'asc' && direction !== 'desc')
    return { error: 'direction must be asc or desc.' }

  const search = queryText(read, 'q')
  if (search.length > 200)
    return { error: 'q must be 200 characters or fewer.' }

  const status = queryText(read, 'status')
  if (status && !(PRODUCT_WAITLIST_STATUSES as readonly string[]).includes(status))
    return { error: `status must be one of ${PRODUCT_WAITLIST_STATUSES.join(', ')}.` }

  return { search, status: status as ProductWaitlistListQuery['status'], sort: sort as ProductWaitlistSort, direction, page, perPage }
}

const FROM = ' FROM waitlist_products w LEFT JOIN products p ON p.id = w.product_id'

function sortExpression(sort: ProductWaitlistSort, dialect: QueryBuilderDialect): string {
  switch (sort) {
    case 'id': return 'w.id'
    case 'name': return 'LOWER(w.name)'
    case 'product': return `LOWER(COALESCE(p.name, ''))`
    case 'quantity': return 'w.quantity'
    // As text: PostgreSQL keeps both as enums, which sort by declaration order.
    case 'status': return asText('w.status', dialect)
    case 'preference': return asText('w.notification_preference', dialect)
    default: return 'w.created_at'
  }
}

export function productWaitlistFilter(query: Pick<ProductWaitlistListQuery, 'search' | 'status'>, dialect: QueryBuilderDialect): { where: string, values: unknown[] } {
  const { bind, values } = binder(dialect)
  const clauses: string[] = []
  if (query.status)
    clauses.push(`${asText('w.status', dialect)} = ${bind(query.status)}`)
  if (query.search) {
    const pattern = containsPattern(query.search)
    const columns = [
      'w.name',
      'w.email',
      `COALESCE(w.phone, '')`,
      'w.source',
      `COALESCE(p.name, '')`,
      `COALESCE(${asText('w.product_id', dialect)}, '')`,
    ]
    clauses.push(`(${columns.map(column => `LOWER(${column}) LIKE ${bind(pattern)} ESCAPE '!'`).join(' OR ')})`)
  }
  return { where: clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '', values }
}

function orderBy(query: Pick<ProductWaitlistListQuery, 'sort' | 'direction'>, dialect: QueryBuilderDialect): string {
  const direction = query.direction === 'asc' ? 'ASC' : 'DESC'
  // Ties read newest first; the id breaks every remaining tie, so pages never
  // repeat or skip an entry.
  if (query.sort === 'created' || query.sort === 'id')
    return ` ORDER BY ${sortExpression(query.sort, dialect)} ${direction}, w.id ${direction}`
  return ` ORDER BY ${sortExpression(query.sort, dialect)} ${direction}, w.created_at DESC, w.id DESC`
}

/** Entries turned into records, against exactly the products and customers they reference. */
async function recordsFor(entries: Array<Record<string, unknown>>, run: CommerceSqlRunner, dialect: QueryBuilderDialect): Promise<ProductWaitlistRecord[]> {
  if (entries.length === 0)
    return []
  const productIds = referencedIds(entries, 'product_id')
  const customerIds = referencedIds(entries, 'customer_id')
  const [products, customers] = await Promise.all([
    productIds.length > 0 ? run.unsafe(`SELECT id, name FROM products WHERE id IN (${idPlaceholders(productIds, dialect)})`, productIds).execute() : [],
    customerIds.length > 0 ? run.unsafe(`SELECT id FROM customers WHERE id IN (${idPlaceholders(customerIds, dialect)})`, customerIds).execute() : [],
  ])
  const names = new Map(sqlRows(products).map((row) => {
    const id = commerceIdentifier(commerceValue(row, 'id'), 'Product')
    return [id, commerceRequiredString(commerceValue(row, 'name'), `Product ${id}`, 'name')]
  }))
  const known = new Set(sqlRows(customers).map(row => commerceIdentifier(commerceValue(row, 'id'), 'Customer')))
  return entries.map(entry => normalizeProductWaitlistRecord(entry, names, known))
}

/** The summary cards, over every entry as before. */
async function summarize(run: CommerceSqlRunner, dialect: QueryBuilderDialect): Promise<ProductWaitlistSummary> {
  const status = asText('status', dialect)
  const count = (name: string) => `SUM(CASE WHEN ${status} = '${name}' THEN 1 ELSE 0 END)`
  const row = sqlRows(await run.unsafe(
    `SELECT COUNT(*) AS total_count, ${count('waiting')} AS waiting_count, ${count('notified')} AS notified_count, ${count('purchased')} AS purchased_count FROM waitlist_products`,
  ).execute())[0] ?? {}
  const total = countOf(row.total_count)
  const purchased = countOf(row.purchased_count)
  return {
    total,
    waiting: countOf(row.waiting_count),
    notified: countOf(row.notified_count),
    purchased,
    conversionRate: total > 0 ? Math.round((purchased / total) * 100) : 0,
  }
}

export interface ProductWaitlistPage {
  records: ProductWaitlistRecord[]
  total: number
  page: number
  summary: ProductWaitlistSummary
}

export async function readProductWaitlistPage(
  query: ProductWaitlistListQuery,
  run: CommerceSqlRunner = db,
  dialect: QueryBuilderDialect = getDatabaseDialect(),
): Promise<ProductWaitlistPage> {
  const { where, values } = productWaitlistFilter(query, dialect)
  const [counted, summary] = await Promise.all([
    run.unsafe(`SELECT COUNT(*) AS total_count${FROM}${where}`, values).execute(),
    summarize(run, dialect),
  ])
  const total = countOf(sqlRows(counted)[0]?.total_count)
  const page = pageWithin(query.page, total, query.perPage)
  const entries = await run.unsafe(
    `SELECT w.*${FROM}${where}${orderBy(query, dialect)} LIMIT ${query.perPage} OFFSET ${(page - 1) * query.perPage}`,
    values,
  ).execute()
  return { records: await recordsFor(sqlRows(entries), run, dialect), total, page, summary }
}
