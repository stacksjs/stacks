import type { QueryBuilderDialect } from '@stacksjs/database/runtime'
import { db, getDatabaseDialect } from '@stacksjs/database/runtime'
import type { QueryReader } from '../Content/content-list'
import { containsPattern, countOf, LIST_PAGE_SIZES, pageWithin, queryText } from '../Content/content-list'
import type { CommerceCustomerRecord, CommerceCustomerStatus, CommerceCustomerSummary } from './commerce-customer-records'
import { normalizeCommerceCustomerRecord } from './commerce-customer-records'
import type { CommerceSqlRunner } from './commerce-sql'
import { asText, binder, sqlRows } from './commerce-sql'

/**
 * One page of customers, searched, filtered, sorted and counted by the
 * database, with the summary of every customer (stacksjs/stacks#3218).
 *
 * The Customers page used to read the first 500 customers by name and do all
 * of that in the browser, so a customer past the 500th could not be found,
 * the cards counted and summed those 500, and "Export filtered" wrote only
 * them.
 */
export const CUSTOMER_SORTS = ['name', 'email', 'spend', 'last-order', 'status', 'newest', 'created'] as const
export type CustomerSort = typeof CUSTOMER_SORTS[number]

export const CUSTOMER_STATUSES: readonly CommerceCustomerStatus[] = ['Active', 'Inactive']

export interface CustomerListQuery {
  search: string
  /** '' for any. */
  status: '' | CommerceCustomerStatus
  sort: CustomerSort
  direction: 'asc' | 'desc'
  page: number
  perPage: number
}

const DESCENDING: readonly CustomerSort[] = ['spend', 'last-order', 'newest', 'created']

export function parseCustomerListQuery(read: QueryReader): CustomerListQuery | { error: string } {
  const pageText = queryText(read, 'page')
  const page = pageText === '' ? 1 : Number(pageText)
  if (!Number.isInteger(page) || page < 1)
    return { error: 'page must be a whole number of 1 or more.' }

  const sizeText = queryText(read, 'per_page')
  const perPage = sizeText === '' ? 25 : Number(sizeText)
  if (!(LIST_PAGE_SIZES as readonly number[]).includes(perPage))
    return { error: `per_page must be one of ${LIST_PAGE_SIZES.join(', ')}.` }

  const sort = queryText(read, 'sort') || 'name'
  if (!(CUSTOMER_SORTS as readonly string[]).includes(sort))
    return { error: `sort must be one of ${CUSTOMER_SORTS.join(', ')}.` }

  const directionText = queryText(read, 'direction').toLowerCase()
  const direction = directionText === '' ? (DESCENDING.includes(sort as CustomerSort) ? 'desc' : 'asc') : directionText
  if (direction !== 'asc' && direction !== 'desc')
    return { error: 'direction must be asc or desc.' }

  const search = queryText(read, 'q')
  if (search.length > 200)
    return { error: 'q must be 200 characters or fewer.' }

  const status = queryText(read, 'status')
  if (status && !(CUSTOMER_STATUSES as readonly string[]).includes(status))
    return { error: `status must be one of ${CUSTOMER_STATUSES.join(', ')}.` }

  return { search, status: status as CustomerListQuery['status'], sort: sort as CustomerSort, direction, page, perPage }
}

function sortExpression(sort: CustomerSort, dialect: QueryBuilderDialect): string {
  switch (sort) {
    case 'email': return 'LOWER(email)'
    case 'spend': return 'total_spent'
    // Text, as the importer that moves it forward compares it.
    case 'last-order': return `COALESCE(last_order, '')`
    case 'status': return asText('status', dialect)
    case 'newest': return 'id'
    case 'created': return 'created_at'
    default: return 'LOWER(name)'
  }
}

export function customerFilter(query: Pick<CustomerListQuery, 'search' | 'status'>, dialect: QueryBuilderDialect): { where: string, values: unknown[] } {
  const { bind, values } = binder(dialect)
  const clauses: string[] = []
  if (query.status)
    // A text comparison: PostgreSQL keeps the status as an enum.
    clauses.push(`${asText('status', dialect)} = ${bind(query.status)}`)
  if (query.search) {
    const pattern = containsPattern(query.search)
    const columns = ['name', 'email', `COALESCE(phone, '')`]
    clauses.push(`(${columns.map(column => `LOWER(${column}) LIKE ${bind(pattern)} ESCAPE '!'`).join(' OR ')})`)
  }
  return { where: clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '', values }
}

function orderBy(query: Pick<CustomerListQuery, 'sort' | 'direction'>, dialect: QueryBuilderDialect): string {
  const direction = query.direction === 'asc' ? 'ASC' : 'DESC'
  if (query.sort === 'newest')
    return ` ORDER BY id ${direction}`
  // Customers who never ordered come last either way, as the page put them.
  const unordered = query.sort === 'last-order' ? `CASE WHEN last_order IS NULL OR last_order = '' THEN 1 ELSE 0 END ASC, ` : ''
  // Ties read by name, as the page sorted them; the id breaks every
  // remaining tie, so pages never repeat or skip a customer.
  const byName = query.sort === 'name' ? '' : ', LOWER(name) ASC'
  return ` ORDER BY ${unordered}${sortExpression(query.sort, dialect)} ${direction}${byName}, id ${direction}`
}

/** The summary cards, over every customer as before. */
async function summarize(run: CommerceSqlRunner, dialect: QueryBuilderDialect): Promise<CommerceCustomerSummary> {
  const status = asText('status', dialect)
  const row = sqlRows(await run.unsafe(
    `SELECT COUNT(*) AS total_count, SUM(CASE WHEN ${status} = 'Active' THEN 1 ELSE 0 END) AS active_count, SUM(CASE WHEN ${status} = 'Inactive' THEN 1 ELSE 0 END) AS inactive_count, SUM(total_spent) AS spent_total FROM customers`,
  ).execute())[0] ?? {}
  const total = countOf(row.total_count)
  const totalSpent = countOf(row.spent_total)
  return {
    total,
    active: countOf(row.active_count),
    inactive: countOf(row.inactive_count),
    totalSpent,
    averageSpent: total > 0 ? totalSpent / total : 0,
  }
}

export interface CustomerPage {
  records: CommerceCustomerRecord[]
  total: number
  page: number
  summary: CommerceCustomerSummary
}

export async function readCustomerPage(
  query: CustomerListQuery,
  run: CommerceSqlRunner = db,
  dialect: QueryBuilderDialect = getDatabaseDialect(),
): Promise<CustomerPage> {
  const { where, values } = customerFilter(query, dialect)
  const [counted, summary] = await Promise.all([
    run.unsafe(`SELECT COUNT(*) AS total_count FROM customers${where}`, values).execute(),
    summarize(run, dialect),
  ])
  const total = countOf(sqlRows(counted)[0]?.total_count)
  const page = pageWithin(query.page, total, query.perPage)
  const customers = await run.unsafe(
    `SELECT * FROM customers${where}${orderBy(query, dialect)} LIMIT ${query.perPage} OFFSET ${(page - 1) * query.perPage}`,
    values,
  ).execute()
  return { records: sqlRows(customers).map(normalizeCommerceCustomerRecord), total, page, summary }
}

/** Every customer matching the query, in its order, for the CSV export, a batch at a time. */
export async function readCustomersForExport(
  query: Omit<CustomerListQuery, 'page' | 'perPage'>,
  run: CommerceSqlRunner = db,
  dialect: QueryBuilderDialect = getDatabaseDialect(),
  batchSize: number = 500,
): Promise<CommerceCustomerRecord[]> {
  const { where, values } = customerFilter(query, dialect)
  const records: CommerceCustomerRecord[] = []
  for (let offset = 0; ; offset += batchSize) {
    const batch = sqlRows(await run.unsafe(
      `SELECT * FROM customers${where}${orderBy(query, dialect)} LIMIT ${batchSize} OFFSET ${offset}`,
      values,
    ).execute())
    records.push(...batch.map(normalizeCommerceCustomerRecord))
    if (batch.length < batchSize)
      return records
  }
}

/** A byte order mark, so spreadsheet apps read the file as UTF-8. */
const BOM = String.fromCharCode(0xFEFF)

/** The CSV "Export filtered" downloads: the page's columns, for every matching customer. */
export function customersCsv(records: CommerceCustomerRecord[], currency: string, minor: (amount: number, currency: string) => string): string {
  const escape = (value: string): string => `"${value.replaceAll('"', '""')}"`
  const header = ['Name', 'Email', 'Phone', 'Status', `Total spent (${currency})`, 'Last order', 'Avatar URL']
  const lines = records.map(record => [
    record.name,
    record.email,
    record.phone,
    record.status,
    minor(record.totalSpent, currency),
    record.lastOrder,
    record.avatar,
  ])
  return `${BOM}${[header, ...lines].map(row => row.map(escape).join(',')).join('\n')}`
}
