import type { QueryBuilderDialect } from '@stacksjs/database/runtime'
import { db, getDatabaseDialect, sqlDateTime } from '@stacksjs/database/runtime'
import type { QueryReader } from '../Content/content-list'
import { containsPattern, countOf, LIST_PAGE_SIZES, pageWithin, queryText } from '../Content/content-list'
import { commerceCurrency, commerceIdentifier, commerceValue, referencedIds } from './commerce-record'
import type { CommerceSqlRunner } from './commerce-sql'
import { asText, binder, idPlaceholders, sqlRows } from './commerce-sql'
import type { PaymentRecord, PaymentSummary } from './payment-records'
import { normalizePaymentRecord } from './payment-records'

/**
 * One page of payments, searched, filtered, sorted, counted and summarised by
 * the database (stacksjs/stacks#3218).
 *
 * The Payments page used to read the newest 500 payments and do all of that
 * in the browser, so a payment past the 500th could not be found, and the
 * summary for "the current view" described only what those 500 held.
 */
export const PAYMENT_SORTS = ['created', 'id', 'billing', 'amount', 'method', 'status'] as const
export type PaymentSort = typeof PAYMENT_SORTS[number]

/** The time ranges the page offers, in days. `0` is all time. */
export const PAYMENT_RANGES = [1, 7, 30, 90, 365, 0] as const

/** The statuses that count as captured, as `isSuccessfulPayment` has them. */
const SUCCESSFUL = ['completed', 'succeeded', 'partiallyRefunded', 'refunded']

/** What the breakdown panels show for the matching payments. */
export interface PaymentBreakdown {
  statuses: Array<{ key: string, count: number }>
  methods: Array<{ key: string, count: number }>
  currencies: Array<{ currency: string, captured: number, refunded: number }>
}

export interface PaymentListQuery {
  search: string
  status: string
  method: string
  /** Days back from now; 0 for all time. */
  days: number
  sort: PaymentSort
  direction: 'asc' | 'desc'
  page: number
  perPage: number
}

export function parsePaymentListQuery(read: QueryReader): PaymentListQuery | { error: string } {
  const pageText = queryText(read, 'page')
  const page = pageText === '' ? 1 : Number(pageText)
  if (!Number.isInteger(page) || page < 1)
    return { error: 'page must be a whole number of 1 or more.' }

  const sizeText = queryText(read, 'per_page')
  const perPage = sizeText === '' ? 25 : Number(sizeText)
  if (!(LIST_PAGE_SIZES as readonly number[]).includes(perPage))
    return { error: `per_page must be one of ${LIST_PAGE_SIZES.join(', ')}.` }

  const sort = queryText(read, 'sort') || 'created'
  if (!(PAYMENT_SORTS as readonly string[]).includes(sort))
    return { error: `sort must be one of ${PAYMENT_SORTS.join(', ')}.` }

  const directionText = queryText(read, 'direction').toLowerCase()
  const direction = directionText === '' ? (sort === 'created' || sort === 'amount' ? 'desc' : 'asc') : directionText
  if (direction !== 'asc' && direction !== 'desc')
    return { error: 'direction must be asc or desc.' }

  const rangeText = queryText(read, 'days')
  const days = rangeText === '' || rangeText === 'all' ? 0 : Number(rangeText)
  if (!(PAYMENT_RANGES as readonly number[]).includes(days))
    return { error: 'days must be 1, 7, 30, 90, 365 or all.' }

  const search = queryText(read, 'q')
  if (search.length > 200)
    return { error: 'q must be 200 characters or fewer.' }

  const status = queryText(read, 'status')
  const method = queryText(read, 'method')
  if (status.length > 100 || method.length > 100)
    return { error: 'status and method must be 100 characters or fewer.' }

  return { search, status, method, days, sort: sort as PaymentSort, direction, page, perPage }
}

function sortExpression(sort: PaymentSort, dialect: QueryBuilderDialect): string {
  switch (sort) {
    case 'id': return 'id'
    case 'billing': return `LOWER(COALESCE(billing_email, ''))`
    case 'amount': return 'amount'
    case 'method': return asText('method', dialect)
    case 'status': return asText('status', dialect)
    default: return 'created_at'
  }
}

/** The WHERE clause and its values for a query's search, filters and time range. */
export function paymentFilter(query: Pick<PaymentListQuery, 'search' | 'status' | 'method' | 'days'>, dialect: QueryBuilderDialect, now: Date = new Date()): { where: string, values: unknown[] } {
  const { bind, values } = binder(dialect)
  const clauses: string[] = []
  if (query.status)
    clauses.push(`${asText('status', dialect)} = ${bind(query.status)}`)
  if (query.method)
    clauses.push(`${asText('method', dialect)} = ${bind(query.method)}`)
  if (query.days > 0) {
    const since = bind(sqlDateTime(new Date(now.getTime() - query.days * 86_400_000)))
    // SQLite keeps timestamps as text and compares them as text, where
    // "2026-11-06 10:00" and "2026-11-06T09:00" sort the wrong way round, so
    // both sides go through datetime() there. The others parse the value.
    clauses.push(dialect === 'sqlite' ? `datetime(created_at) >= datetime(${since})` : `created_at >= ${since}`)
  }
  if (query.search) {
    const pattern = containsPattern(query.search)
    const columns = [
      asText('id', dialect),
      `COALESCE(reference_number, '')`,
      `COALESCE(billing_email, '')`,
      `COALESCE(transaction_id, '')`,
      `COALESCE(payment_provider, '')`,
      `COALESCE(${asText('order_id', dialect)}, '')`,
      asText('method', dialect),
      asText('status', dialect),
    ]
    clauses.push(`(${columns.map(column => `LOWER(${column}) LIKE ${bind(pattern)} ESCAPE '!'`).join(' OR ')})`)
  }
  return { where: clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '', values }
}

/** Payments turned into records, against exactly the orders and customers they reference. */
async function recordsFor(payments: Array<Record<string, unknown>>, run: CommerceSqlRunner, dialect: QueryBuilderDialect): Promise<PaymentRecord[]> {
  if (payments.length === 0)
    return []
  const orderIds = referencedIds(payments, 'order_id')
  const customerIds = referencedIds(payments, 'customer_id')
  const [orders, customers] = await Promise.all([
    orderIds.length > 0 ? run.unsafe(`SELECT id FROM orders WHERE id IN (${idPlaceholders(orderIds, dialect)})`, orderIds).execute() : [],
    customerIds.length > 0 ? run.unsafe(`SELECT id FROM customers WHERE id IN (${idPlaceholders(customerIds, dialect)})`, customerIds).execute() : [],
  ])
  const ids = (result: unknown, source: string) => new Set(sqlRows(result).map(row => commerceIdentifier(commerceValue(row, 'id'), source)))
  const relationships = { orderIds: ids(orders, 'Order'), customerIds: ids(customers, 'Customer') }
  return payments.map(payment => normalizePaymentRecord(payment, relationships))
}

/**
 * The summary and breakdown of the matching payments, as `summarizePayments`
 * and the breakdown panels computed them over the records they had.
 */
async function summarize(where: string, values: unknown[], run: CommerceSqlRunner, dialect: QueryBuilderDialect): Promise<{ summary: PaymentSummary, breakdown: PaymentBreakdown }> {
  const status = asText('status', dialect)
  const successful = `${status} IN (${SUCCESSFUL.map(name => `'${name}'`).join(', ')})`
  const grouped = (column: string) =>
    run.unsafe(`SELECT ${asText(column, dialect)} AS value, COUNT(*) AS item_count FROM payments${where} GROUP BY ${asText(column, dialect)}`, values).execute()
  const [counts, currencies, byStatus, byMethod] = await Promise.all([
    run.unsafe(`SELECT COUNT(*) AS total_count, SUM(CASE WHEN ${successful} THEN 1 ELSE 0 END) AS successful_count, SUM(CASE WHEN ${status} = 'failed' THEN 1 ELSE 0 END) AS failed_count FROM payments${where}`, values).execute(),
    run.unsafe(`SELECT currency, SUM(CASE WHEN ${successful} THEN 1 ELSE 0 END) AS captured_count, SUM(CASE WHEN ${successful} THEN amount ELSE 0 END) AS captured_total, SUM(CASE WHEN refund_amount > 0 THEN 1 ELSE 0 END) AS refund_count, SUM(CASE WHEN refund_amount > 0 THEN refund_amount ELSE 0 END) AS refunded_total FROM payments${where} GROUP BY currency`, values).execute(),
    grouped('status'),
    grouped('method'),
  ])
  const count = sqlRows(counts)[0] ?? {}
  const total = countOf(count.total_count)
  const success = countOf(count.successful_count)
  const settled = success + countOf(count.failed_count)

  const names = new Set<string>()
  const capturedByCurrency: Record<string, number> = {}
  const refundedByCurrency: Record<string, number> = {}
  const perCurrency = new Map<string, { currency: string, captured: number, refunded: number }>()
  for (const row of sqlRows(currencies)) {
    // Normalized as the records are, so "usd" and "USD" are one currency.
    const currency = commerceCurrency(row.currency, 'Payment summary')
    names.add(currency)
    if (countOf(row.captured_count) > 0)
      capturedByCurrency[currency] = (capturedByCurrency[currency] ?? 0) + countOf(row.captured_total)
    if (countOf(row.refund_count) > 0)
      refundedByCurrency[currency] = (refundedByCurrency[currency] ?? 0) + countOf(row.refunded_total)
    const entry = perCurrency.get(currency) ?? { currency, captured: 0, refunded: 0 }
    entry.captured += countOf(row.captured_total)
    entry.refunded += countOf(row.refunded_total)
    perCurrency.set(currency, entry)
  }

  const tally = (result: unknown) => {
    const merged = new Map<string, number>()
    for (const row of sqlRows(result)) {
      const key = String(row.value ?? '').trim() || 'unknown'
      merged.set(key, (merged.get(key) ?? 0) + countOf(row.item_count))
    }
    return [...merged.entries()].map(([key, count]) => ({ key, count }))
  }

  return {
    summary: {
      total,
      successful: success,
      currencies: [...names].sort(),
      capturedByCurrency,
      refundedByCurrency,
      successRate: settled ? Math.round((success / settled) * 1000) / 10 : 0,
    },
    breakdown: {
      statuses: tally(byStatus),
      methods: tally(byMethod),
      currencies: [...perCurrency.values()],
    },
  }
}

/** The filter choices: every status and method any payment has. */
async function choices(run: CommerceSqlRunner, dialect: QueryBuilderDialect): Promise<{ statuses: string[], methods: string[] }> {
  const [statuses, methods] = await Promise.all([
    run.unsafe(`SELECT DISTINCT ${asText('status', dialect)} AS value FROM payments WHERE status IS NOT NULL`).execute(),
    run.unsafe(`SELECT DISTINCT ${asText('method', dialect)} AS value FROM payments WHERE method IS NOT NULL`).execute(),
  ])
  const values = (result: unknown) => [...new Set(sqlRows(result).map(row => String(row.value ?? '').trim()).filter(Boolean))].sort()
  return { statuses: values(statuses), methods: values(methods) }
}

function orderBy(query: Pick<PaymentListQuery, 'sort' | 'direction'>, dialect: QueryBuilderDialect): string {
  const direction = query.direction === 'asc' ? 'ASC' : 'DESC'
  // Status sorts newest first within a status, as the page did; the id breaks
  // every remaining tie, so pages never repeat or skip a payment.
  const within = query.sort === 'status' ? ', created_at DESC' : ''
  return ` ORDER BY ${sortExpression(query.sort, dialect)} ${direction}${within}, id ${direction}`
}

export interface PaymentPage {
  records: PaymentRecord[]
  total: number
  page: number
  summary: PaymentSummary
  breakdown: PaymentBreakdown
  statuses: string[]
  methods: string[]
}

export async function readPaymentPage(
  query: PaymentListQuery,
  run: CommerceSqlRunner = db,
  dialect: QueryBuilderDialect = getDatabaseDialect(),
  now: Date = new Date(),
): Promise<PaymentPage> {
  const { where, values } = paymentFilter(query, dialect, now)
  const [{ summary, breakdown }, options] = await Promise.all([
    summarize(where, values, run, dialect),
    choices(run, dialect),
  ])
  const page = pageWithin(query.page, summary.total, query.perPage)
  const payments = await run.unsafe(
    `SELECT * FROM payments${where}${orderBy(query, dialect)} LIMIT ${query.perPage} OFFSET ${(page - 1) * query.perPage}`,
    values,
  ).execute()
  return { records: await recordsFor(sqlRows(payments), run, dialect), total: summary.total, page, summary, breakdown, ...options }
}

/** Every payment matching the query, in its order, for the CSV export, a batch at a time. */
export async function readPaymentsForExport(
  query: Omit<PaymentListQuery, 'page' | 'perPage'>,
  run: CommerceSqlRunner = db,
  dialect: QueryBuilderDialect = getDatabaseDialect(),
  now: Date = new Date(),
  batchSize: number = 500,
): Promise<PaymentRecord[]> {
  const { where, values } = paymentFilter(query, dialect, now)
  const records: PaymentRecord[] = []
  for (let offset = 0; ; offset += batchSize) {
    const batch = sqlRows(await run.unsafe(
      `SELECT * FROM payments${where}${orderBy(query, dialect)} LIMIT ${batchSize} OFFSET ${offset}`,
      values,
    ).execute())
    records.push(...await recordsFor(batch, run, dialect))
    if (batch.length < batchSize)
      return records
  }
}
