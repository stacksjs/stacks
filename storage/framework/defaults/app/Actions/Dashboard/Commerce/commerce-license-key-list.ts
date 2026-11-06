import type { QueryBuilderDialect } from '@stacksjs/database/runtime'
import { db, getDatabaseDialect, sqlDateTime } from '@stacksjs/database/runtime'
import type { QueryReader } from '../Content/content-list'
import { containsPattern, countOf, LIST_PAGE_SIZES, pageWithin, queryText } from '../Content/content-list'
import type { NamedSearchQuery } from '../named-search'
import { referencedIds } from './commerce-record'
import type { CommerceSqlRunner } from './commerce-sql'
import { asText, binder, idPlaceholders, sqlRows } from './commerce-sql'
import type { LicenseKeyRecord, LicenseKeyRelatedSummary } from './license-key-records'
import {
  indexLicenseKeyOptions,
  normalizeLicenseKeyCustomer,
  normalizeLicenseKeyOrder,
  normalizeLicenseKeyProduct,
  normalizeLicenseKeyRecord,
} from './license-key-records'

/**
 * One page of licence keys, searched, sorted and counted by the database, with
 * the summary of every key, and the customers, products and orders the key
 * dialog offers, searched (stacksjs/stacks#3218).
 *
 * The Licence Keys page used to read the newest 500 keys and do all of that in
 * the browser, so an older key could not be found, and its cards counted those
 * 500. The dialog was handed the first 500 customers, products and orders, so
 * a key could not be linked to any later one, and the page labelled each key's
 * links from those same 500, so a key linked to a later one showed no link.
 */
export const LICENSE_KEY_SORTS = ['created', 'id', 'key', 'template', 'customer', 'product', 'order', 'expiry', 'status'] as const
export type LicenseKeySort = typeof LICENSE_KEY_SORTS[number]

export interface LicenseKeyListQuery {
  search: string
  sort: LicenseKeySort
  direction: 'asc' | 'desc'
  page: number
  perPage: number
}

export interface LicenseKeySummary {
  total: number
  active: number
  /** Linked to a customer, a product or an order. */
  assigned: number
  /** Expiring between now and 30 days from now. */
  expiring: number
}

export function parseLicenseKeyListQuery(read: QueryReader): LicenseKeyListQuery | { error: string } {
  const pageText = queryText(read, 'page')
  const page = pageText === '' ? 1 : Number(pageText)
  if (!Number.isInteger(page) || page < 1)
    return { error: 'page must be a whole number of 1 or more.' }

  const sizeText = queryText(read, 'per_page')
  const perPage = sizeText === '' ? 25 : Number(sizeText)
  if (!(LIST_PAGE_SIZES as readonly number[]).includes(perPage))
    return { error: `per_page must be one of ${LIST_PAGE_SIZES.join(', ')}.` }

  const sort = queryText(read, 'sort') || 'created'
  if (!(LICENSE_KEY_SORTS as readonly string[]).includes(sort))
    return { error: `sort must be one of ${LICENSE_KEY_SORTS.join(', ')}.` }

  const directionText = queryText(read, 'direction').toLowerCase()
  const direction = directionText === '' ? (sort === 'created' || sort === 'order' ? 'desc' : 'asc') : directionText
  if (direction !== 'asc' && direction !== 'desc')
    return { error: 'direction must be asc or desc.' }

  const search = queryText(read, 'q')
  if (search.length > 200)
    return { error: 'q must be 200 characters or fewer.' }

  return { search, sort: sort as LicenseKeySort, direction, page, perPage }
}

const FROM = ' FROM license_keys k LEFT JOIN customers c ON c.id = k.customer_id LEFT JOIN products p ON p.id = k.product_id'

function sortExpression(sort: LicenseKeySort, dialect: QueryBuilderDialect): string {
  switch (sort) {
    case 'id': return 'k.id'
    case 'key': return 'k.key'
    // As text: PostgreSQL and MySQL keep both as enums, which sort by declaration order.
    case 'template': return asText('k.template', dialect)
    case 'status': return asText('k.status', dialect)
    case 'customer': return `LOWER(COALESCE(c.name, ''))`
    case 'product': return `LOWER(COALESCE(p.name, ''))`
    case 'order': return 'k.order_id'
    case 'expiry': return 'k.expiry_date'
    default: return 'k.created_at'
  }
}

export function licenseKeyFilter(query: Pick<LicenseKeyListQuery, 'search'>, dialect: QueryBuilderDialect): { where: string, values: unknown[] } {
  if (!query.search)
    return { where: '', values: [] }
  const { bind, values } = binder(dialect)
  const pattern = containsPattern(query.search)
  const columns = [
    'k.key',
    asText('k.template', dialect),
    asText('k.status', dialect),
    `COALESCE(c.name, '')`,
    `COALESCE(c.email, '')`,
    `COALESCE(p.name, '')`,
    `COALESCE(${asText('k.order_id', dialect)}, '')`,
  ]
  return { where: ` WHERE (${columns.map(column => `LOWER(${column}) LIKE ${bind(pattern)} ESCAPE '!'`).join(' OR ')})`, values }
}

function orderBy(query: Pick<LicenseKeyListQuery, 'sort' | 'direction'>, dialect: QueryBuilderDialect): string {
  const direction = query.direction === 'asc' ? 'ASC' : 'DESC'
  // Ties read newest first; the id breaks every remaining tie, so pages never
  // repeat or skip a key.
  if (query.sort === 'created' || query.sort === 'id' || query.sort === 'key')
    return ` ORDER BY ${sortExpression(query.sort, dialect)} ${direction}, k.id ${direction}`
  return ` ORDER BY ${sortExpression(query.sort, dialect)} ${direction}, k.created_at DESC, k.id DESC`
}

/** Keys turned into records, against exactly the customers, products and orders they reference. */
async function recordsFor(keys: Array<Record<string, unknown>>, run: CommerceSqlRunner, dialect: QueryBuilderDialect): Promise<LicenseKeyRecord[]> {
  if (keys.length === 0)
    return []
  const read = (table: string, columns: string, ids: unknown[]) => ids.length > 0
    ? run.unsafe(`SELECT ${columns} FROM ${table} WHERE id IN (${idPlaceholders(ids, dialect)})`, ids).execute()
    : Promise.resolve([])
  const [customers, products, orders] = await Promise.all([
    read('customers', 'id, name, email', referencedIds(keys, 'customer_id')),
    read('products', 'id, name', referencedIds(keys, 'product_id')),
    read('orders', 'id, status', referencedIds(keys, 'order_id')),
  ])
  const customerMap = indexLicenseKeyOptions(sqlRows(customers).map(normalizeLicenseKeyCustomer))
  const productMap = indexLicenseKeyOptions(sqlRows(products).map(normalizeLicenseKeyProduct))
  const orderMap = indexLicenseKeyOptions(sqlRows(orders).map(normalizeLicenseKeyOrder))
  return keys.map(key => normalizeLicenseKeyRecord(key, customerMap, productMap, orderMap))
}

/** The summary cards, over every key as before. */
async function summarize(run: CommerceSqlRunner, dialect: QueryBuilderDialect, now: Date): Promise<LicenseKeySummary> {
  const { bind, values } = binder(dialect)
  // SQLite keeps timestamps as text, where "2026-11-06 10:00" and
  // "2026-11-06T09:00" compare the wrong way round, so both sides go through
  // datetime() there. The others parse the value.
  const at = (value: string) => dialect === 'sqlite' ? `datetime(${value})` : value
  const from = bind(sqlDateTime(now))
  const until = bind(sqlDateTime(new Date(now.getTime() + 30 * 86_400_000)))
  const row = sqlRows(await run.unsafe(
    `SELECT COUNT(*) AS total_count, SUM(CASE WHEN ${asText('status', dialect)} = 'active' THEN 1 ELSE 0 END) AS active_count, SUM(CASE WHEN customer_id IS NOT NULL OR product_id IS NOT NULL OR order_id IS NOT NULL THEN 1 ELSE 0 END) AS assigned_count, SUM(CASE WHEN ${at('expiry_date')} >= ${at(from)} AND ${at('expiry_date')} <= ${at(until)} THEN 1 ELSE 0 END) AS expiring_count FROM license_keys`,
    values,
  ).execute())[0] ?? {}
  return {
    total: countOf(row.total_count),
    active: countOf(row.active_count),
    assigned: countOf(row.assigned_count),
    expiring: countOf(row.expiring_count),
  }
}

export interface LicenseKeyPage {
  records: LicenseKeyRecord[]
  total: number
  page: number
  summary: LicenseKeySummary
}

export async function readLicenseKeyPage(
  query: LicenseKeyListQuery,
  run: CommerceSqlRunner = db,
  dialect: QueryBuilderDialect = getDatabaseDialect(),
  now: Date = new Date(),
): Promise<LicenseKeyPage> {
  const { where, values } = licenseKeyFilter(query, dialect)
  const [counted, summary] = await Promise.all([
    run.unsafe(`SELECT COUNT(*) AS total_count${FROM}${where}`, values).execute(),
    summarize(run, dialect, now),
  ])
  const total = countOf(sqlRows(counted)[0]?.total_count)
  const page = pageWithin(query.page, total, query.perPage)
  const keys = await run.unsafe(
    `SELECT k.*${FROM}${where}${orderBy(query, dialect)} LIMIT ${query.perPage} OFFSET ${(page - 1) * query.perPage}`,
    values,
  ).execute()
  return { records: await recordsFor(sqlRows(keys), run, dialect), total, page, summary }
}

export const LICENSE_KEY_CHOICE_KINDS = ['customers', 'products', 'orders'] as const
export type LicenseKeyChoiceKind = typeof LICENSE_KEY_CHOICE_KINDS[number]

/**
 * The customers (by name or email), products (by name or id) or orders (by id
 * or status, newest first) the key dialog offers, bounded, with how many
 * matched.
 */
export async function searchLicenseKeyChoices(
  kind: LicenseKeyChoiceKind,
  query: NamedSearchQuery,
  run: CommerceSqlRunner = db,
  dialect: QueryBuilderDialect = getDatabaseDialect(),
): Promise<{ choices: LicenseKeyRelatedSummary[], total: number }> {
  const spec = {
    customers: { columns: 'id, name, email', searched: [`COALESCE(name, '')`, `COALESCE(email, '')`], order: `LOWER(COALESCE(name, '')) ASC, id ASC`, normalize: normalizeLicenseKeyCustomer },
    products: { columns: 'id, name', searched: [`COALESCE(name, '')`, asText('id', dialect)], order: `LOWER(COALESCE(name, '')) ASC, id ASC`, normalize: normalizeLicenseKeyProduct },
    orders: { columns: 'id, status', searched: [asText('id', dialect), asText('status', dialect)], order: 'id DESC', normalize: normalizeLicenseKeyOrder },
  }[kind]
  if (!spec)
    throw new TypeError(`${kind} is not a licence key choice.`)
  const { bind, values } = binder(dialect)
  let where = ''
  if (query.search) {
    const pattern = containsPattern(query.search)
    where = ` WHERE ${spec.searched.map(column => `LOWER(${column}) LIKE ${bind(pattern)} ESCAPE '!'`).join(' OR ')}`
  }
  const [counted, found] = await Promise.all([
    run.unsafe(`SELECT COUNT(*) AS total_count FROM ${kind}${where}`, values).execute(),
    run.unsafe(`SELECT ${spec.columns} FROM ${kind}${where} ORDER BY ${spec.order} LIMIT ${query.limit}`, values).execute(),
  ])
  return { choices: sqlRows(found).map(spec.normalize), total: countOf(sqlRows(counted)[0]?.total_count) }
}
