import type { QueryBuilderDialect } from '@stacksjs/database/runtime'
import { db, getDatabaseDialect, sqlHelpers } from '@stacksjs/database/runtime'
import type { QueryReader } from '../Content/content-list'
import { containsPattern, countOf, LIST_PAGE_SIZES, pageWithin, queryText } from '../Content/content-list'
import type { CommerceOrderRecord, CommerceOrderSummary } from './commerce-order-records'
import {
  addOrderItemQuantity,
  normalizeCommerceOrderRecord,
  normalizeOrderCouponId,
  normalizeOrderCustomerContext,
  referencedIds,
} from './commerce-order-records'
import { commerceCurrency, commerceIdentifier, commerceValue } from './commerce-record'

/**
 * One page of orders, searched, filtered, sorted, counted and summarised by the
 * database (stacksjs/stacks#3218).
 *
 * The Orders page used to read the newest 500 orders and do all of that in the
 * browser, so an order past the 500th could not be found, and the summary
 * cards and currency totals described those 500, not the store.
 */
export const ORDER_SORTS = ['created', 'id', 'customer', 'total', 'type', 'status'] as const
export type OrderSort = typeof ORDER_SORTS[number]

export interface OrderListQuery {
  search: string
  status: string
  type: string
  sort: OrderSort
  direction: 'asc' | 'desc'
  page: number
  perPage: number
}

/** What runs the queries: the configured `db`, or a test's own connection. */
export interface OrderListRunner {
  unsafe: (sql: string, values?: unknown[]) => { execute: () => Promise<unknown> }
}

/** The status groups the summary cards count, matched without regard to case. */
const STATUS_GROUPS = {
  pending: ['PENDING', 'NEW'],
  inProgress: ['PREPARING', 'PROCESSING', 'READY', 'SHIPPED'],
  completed: ['DELIVERED', 'COMPLETED', 'PAID'],
  cancelled: ['CANCELED', 'CANCELLED', 'REFUNDED'],
} as const

export const DEFAULT_ORDER_STATUSES = ['PENDING', 'PREPARING', 'READY', 'DELIVERED', 'CANCELED']
export const DEFAULT_ORDER_TYPES = ['DINE_IN', 'TAKEOUT', 'DELIVERY']

export function parseOrderListQuery(read: QueryReader): OrderListQuery | { error: string } {
  const pageText = queryText(read, 'page')
  const page = pageText === '' ? 1 : Number(pageText)
  if (!Number.isInteger(page) || page < 1)
    return { error: 'page must be a whole number of 1 or more.' }

  const sizeText = queryText(read, 'per_page')
  const perPage = sizeText === '' ? 25 : Number(sizeText)
  if (!(LIST_PAGE_SIZES as readonly number[]).includes(perPage))
    return { error: `per_page must be one of ${LIST_PAGE_SIZES.join(', ')}.` }

  const sort = queryText(read, 'sort') || 'created'
  if (!(ORDER_SORTS as readonly string[]).includes(sort))
    return { error: `sort must be one of ${ORDER_SORTS.join(', ')}.` }

  const directionText = queryText(read, 'direction').toLowerCase()
  const direction = directionText === '' ? (sort === 'created' || sort === 'total' ? 'desc' : 'asc') : directionText
  if (direction !== 'asc' && direction !== 'desc')
    return { error: 'direction must be asc or desc.' }

  const search = queryText(read, 'q')
  if (search.length > 200)
    return { error: 'q must be 200 characters or fewer.' }

  const status = queryText(read, 'status')
  const type = queryText(read, 'type')
  if (status.length > 100 || type.length > 100)
    return { error: 'status and type must be 100 characters or fewer.' }

  return { search, status, type, sort: sort as OrderSort, direction, page, perPage }
}

function sortExpression(sort: OrderSort): string {
  switch (sort) {
    case 'id': return 'o.id'
    // Case-insensitive, with unassigned orders first ascending, the same on
    // every dialect (each sorts NULL differently).
    case 'customer': return `LOWER(COALESCE(c.name, ''))`
    case 'total': return 'o.total_amount'
    case 'type': return 'o.order_type'
    case 'status': return 'o.status'
    default: return 'o.created_at'
  }
}

function isMysqlWire(dialect: QueryBuilderDialect): boolean {
  return dialect === 'mysql' || dialect === 'singlestore' || dialect === 'vitess'
}

/** The WHERE clause and its values for a query's search and filters. */
export function orderFilter(query: Pick<OrderListQuery, 'search' | 'status' | 'type'>, dialect: QueryBuilderDialect): { where: string, values: unknown[] } {
  const sql = sqlHelpers(dialect)
  const values: unknown[] = []
  const bind = (value: unknown): string => {
    values.push(value)
    return sql.param(values.length)
  }
  const clauses: string[] = []
  if (query.status)
    clauses.push(`o.status = ${bind(query.status)}`)
  if (query.type)
    clauses.push(`o.order_type = ${bind(query.type)}`)
  if (query.search) {
    const pattern = containsPattern(query.search)
    const columns = [
      `CAST(o.id AS ${isMysqlWire(dialect) ? 'CHAR' : 'TEXT'})`,
      `COALESCE(c.name, '')`,
      `COALESCE(c.email, '')`,
      `COALESCE(o.status, '')`,
      `COALESCE(o.order_type, '')`,
      `COALESCE(o.delivery_address, '')`,
    ]
    clauses.push(`(${columns.map(column => `LOWER(${column}) LIKE ${bind(pattern)} ESCAPE '!'`).join(' OR ')})`)
  }
  return { where: clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '', values }
}

const FROM = ' FROM orders o LEFT JOIN customers c ON c.id = o.customer_id'

function rows(result: unknown): Array<Record<string, unknown>> {
  return Array.isArray(result) ? result as Array<Record<string, unknown>> : []
}

function idList(ids: number[], dialect: QueryBuilderDialect): string {
  const sql = sqlHelpers(dialect)
  return ids.map((_, index) => sql.param(index + 1)).join(', ')
}

/**
 * Orders turned into records: their referenced customers and coupons read by
 * id, and their item counts. Shared by the page and the export.
 */
async function recordsFor(orders: Array<Record<string, unknown>>, run: OrderListRunner, dialect: QueryBuilderDialect): Promise<CommerceOrderRecord[]> {
  if (orders.length === 0)
    return []

  const customerIds = referencedIds(orders, 'customer_id')
  const couponIds = referencedIds(orders, 'coupon_id')
  const orderIds = referencedIds(orders, 'id')
  const [customers, coupons, items] = await Promise.all([
    customerIds.length > 0 ? run.unsafe(`SELECT id, name, email FROM customers WHERE id IN (${idList(customerIds, dialect)})`, customerIds).execute() : [],
    couponIds.length > 0 ? run.unsafe(`SELECT id FROM coupons WHERE id IN (${idList(couponIds, dialect)})`, couponIds).execute() : [],
    orderIds.length > 0 ? run.unsafe(`SELECT id, order_id, quantity FROM order_items WHERE order_id IN (${idList(orderIds, dialect)})`, orderIds).execute() : [],
  ])

  const customerMap = new Map(rows(customers).map(normalizeOrderCustomerContext).map(customer => [customer.id, customer.context]))
  const couponSet = new Set(rows(coupons).map(normalizeOrderCouponId))
  const orderKeys = new Set(orders.map(order => commerceIdentifier(commerceValue(order, 'id', 'uuid'), 'Order')))
  const itemCounts = new Map<string, number>()
  for (const item of rows(items))
    addOrderItemQuantity(item, orderKeys, itemCounts)

  return orders.map(order => normalizeCommerceOrderRecord(order, customerMap, itemCounts, couponSet))
}

/** The summary cards and currency totals, over every order. */
async function summarize(run: OrderListRunner): Promise<CommerceOrderSummary> {
  const group = (statuses: readonly string[]) =>
    `SUM(CASE WHEN UPPER(TRIM(status)) IN (${statuses.map(status => `'${status}'`).join(', ')}) THEN 1 ELSE 0 END)`
  const [counts, totals] = await Promise.all([
    run.unsafe(`SELECT COUNT(*) AS total_count, ${group(STATUS_GROUPS.pending)} AS pending_count, ${group(STATUS_GROUPS.inProgress)} AS progress_count, ${group(STATUS_GROUPS.completed)} AS completed_count, ${group(STATUS_GROUPS.cancelled)} AS cancelled_count FROM orders`).execute(),
    run.unsafe('SELECT currency, SUM(total_amount) AS amount_total FROM orders GROUP BY currency').execute(),
  ])
  const count = rows(counts)[0] ?? {}

  // Currencies are normalized as the records are, so "eur" and "EUR" are one total.
  const currencyTotals = new Map<string, number>()
  for (const row of rows(totals)) {
    const currency = commerceCurrency(row.currency, 'Order summary')
    currencyTotals.set(currency, (currencyTotals.get(currency) ?? 0) + countOf(row.amount_total))
  }

  return {
    total: countOf(count.total_count),
    pending: countOf(count.pending_count),
    inProgress: countOf(count.progress_count),
    completed: countOf(count.completed_count),
    cancelled: countOf(count.cancelled_count),
    currencyTotals: [...currencyTotals.entries()]
      .map(([currency, amount]) => ({ currency, amount }))
      .sort((left, right) => left.currency.localeCompare(right.currency)),
  }
}

/** The filter choices: the usual ones plus every value an order actually has. */
async function choices(run: OrderListRunner): Promise<{ statuses: string[], orderTypes: string[] }> {
  const [statuses, types] = await Promise.all([
    run.unsafe('SELECT DISTINCT status FROM orders WHERE status IS NOT NULL').execute(),
    run.unsafe('SELECT DISTINCT order_type FROM orders WHERE order_type IS NOT NULL').execute(),
  ])
  const values = (result: unknown, key: string) => rows(result).map(row => String(row[key] ?? '').trim()).filter(Boolean).sort()
  return {
    statuses: [...new Set([...DEFAULT_ORDER_STATUSES, ...values(statuses, 'status')])],
    orderTypes: [...new Set([...DEFAULT_ORDER_TYPES, ...values(types, 'order_type')])],
  }
}

export interface OrderPage {
  records: CommerceOrderRecord[]
  total: number
  page: number
  summary: CommerceOrderSummary
  statuses: string[]
  orderTypes: string[]
}

function orderBy(query: Pick<OrderListQuery, 'sort' | 'direction'>): string {
  const direction = query.direction === 'asc' ? 'ASC' : 'DESC'
  // The id breaks ties, so a page boundary never repeats or skips an order.
  return ` ORDER BY ${sortExpression(query.sort)} ${direction}, o.id ${direction}`
}

export async function readOrderPage(
  query: OrderListQuery,
  run: OrderListRunner = db,
  dialect: QueryBuilderDialect = getDatabaseDialect(),
): Promise<OrderPage> {
  const { where, values } = orderFilter(query, dialect)
  const [counted, summary, options] = await Promise.all([
    run.unsafe(`SELECT COUNT(*) AS total_count${FROM}${where}`, values).execute(),
    summarize(run),
    choices(run),
  ])
  const total = countOf(rows(counted)[0]?.total_count)
  const page = pageWithin(query.page, total, query.perPage)
  const orders = await run.unsafe(
    `SELECT o.*${FROM}${where}${orderBy(query)} LIMIT ${query.perPage} OFFSET ${(page - 1) * query.perPage}`,
    values,
  ).execute()

  return { records: await recordsFor(rows(orders), run, dialect), total, page, summary, ...options }
}

/** How many orders the export reads per query. */
const EXPORT_BATCH = 500

/**
 * Every order matching the query, in its order, for the CSV export. Read a
 * batch at a time, so a large export never needs one enormous result set.
 */
export async function readOrdersForExport(
  query: Omit<OrderListQuery, 'page' | 'perPage'>,
  run: OrderListRunner = db,
  dialect: QueryBuilderDialect = getDatabaseDialect(),
  batchSize: number = EXPORT_BATCH,
): Promise<CommerceOrderRecord[]> {
  const { where, values } = orderFilter(query, dialect)
  const records: CommerceOrderRecord[] = []
  for (let offset = 0; ; offset += batchSize) {
    const batch = rows(await run.unsafe(
      `SELECT o.*${FROM}${where}${orderBy(query)} LIMIT ${batchSize} OFFSET ${offset}`,
      values,
    ).execute())
    records.push(...await recordsFor(batch, run, dialect))
    if (batch.length < batchSize)
      return records
  }
}

const CSV_HEADER = ['Order ID', 'Customer', 'Customer email', 'Status', 'Order type', 'Items', 'Total', 'Currency', 'Tax', 'Discount', 'Delivery fee', 'Tip', 'Delivery address', 'Created at']

/**
 * The CSV the "Export filtered" button downloads: the same columns the page
 * built from what it had loaded, now from every matching order. Amounts are
 * the major-unit strings a person types (`minor` converts them), and a leading
 * byte-order mark tells spreadsheet apps it is UTF-8.
 */
export function ordersCsv(records: CommerceOrderRecord[], minor: (amount: number, currency: string) => string): string {
  const escape = (value: string): string => `"${value.replaceAll('"', '""')}"`
  const lines = records.map(record => [
    record.id,
    record.customerName,
    record.customerEmail,
    record.status,
    record.orderType,
    String(record.itemCount),
    minor(record.totalAmount, record.currency),
    record.currency,
    minor(record.taxAmount, record.currency),
    minor(record.discountAmount, record.currency),
    minor(record.deliveryFee, record.currency),
    minor(record.tipAmount, record.currency),
    record.deliveryAddress,
    record.createdAt,
  ])
  return `﻿${[CSV_HEADER, ...lines].map(row => row.map(escape).join(',')).join('\n')}`
}
