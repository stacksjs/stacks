import type { QueryBuilderDialect } from '@stacksjs/database/runtime'
import { db, getDatabaseDialect } from '@stacksjs/database/runtime'
import type { QueryReader } from '../Content/content-list'
import { containsPattern, countOf, LIST_PAGE_SIZES, pageWithin, queryText } from '../Content/content-list'
import { commerceIdentifier, commerceRequiredString, commerceValue, referencedIds } from './commerce-record'
import type { CommerceSqlRunner } from './commerce-sql'
import { asText, binder, idPlaceholders, sqlRows } from './commerce-sql'
import type { ProductVariantRecord, ProductVariantSummary } from './product-variant-records'
import { normalizeProductVariantRecord } from './product-variant-records'

/**
 * One page of product variants, searched, filtered, sorted and counted by the
 * database, with the summary of every variant, every variant type, and every
 * product that has a variant (stacksjs/stacks#3218).
 *
 * The Variants page used to read the newest 500 variants and do all of that
 * in the browser, so an older variant could not be found, its cards counted
 * those 500, and the type filter only knew those 500's types. It also read
 * the first 500 products by name, for the product filter, the dialog's
 * product select and to name each variant's product, so a variant of any
 * later product failed the whole page.
 */
export const PRODUCT_VARIANT_SORTS = ['variant', 'product', 'options', 'status', 'newest', 'created'] as const
export type ProductVariantSort = typeof PRODUCT_VARIANT_SORTS[number]

export const PRODUCT_VARIANT_STATUSES = ['active', 'inactive', 'draft'] as const

export interface ProductVariantListQuery {
  search: string
  /** '' for any. */
  status: '' | typeof PRODUCT_VARIANT_STATUSES[number]
  /** A variant type, or '' for any. */
  type: string
  /** A product id, or '' for any. */
  product: string
  sort: ProductVariantSort
  direction: 'asc' | 'desc'
  page: number
  perPage: number
}

export function parseProductVariantListQuery(read: QueryReader): ProductVariantListQuery | { error: string } {
  const pageText = queryText(read, 'page')
  const page = pageText === '' ? 1 : Number(pageText)
  if (!Number.isInteger(page) || page < 1)
    return { error: 'page must be a whole number of 1 or more.' }

  const sizeText = queryText(read, 'per_page')
  const perPage = sizeText === '' ? 25 : Number(sizeText)
  if (!(LIST_PAGE_SIZES as readonly number[]).includes(perPage))
    return { error: `per_page must be one of ${LIST_PAGE_SIZES.join(', ')}.` }

  const sort = queryText(read, 'sort') || 'variant'
  if (!(PRODUCT_VARIANT_SORTS as readonly string[]).includes(sort))
    return { error: `sort must be one of ${PRODUCT_VARIANT_SORTS.join(', ')}.` }

  const directionText = queryText(read, 'direction').toLowerCase()
  const direction = directionText === '' ? (['options', 'newest', 'created'].includes(sort) ? 'desc' : 'asc') : directionText
  if (direction !== 'asc' && direction !== 'desc')
    return { error: 'direction must be asc or desc.' }

  const search = queryText(read, 'q')
  if (search.length > 200)
    return { error: 'q must be 200 characters or fewer.' }

  const status = queryText(read, 'status')
  if (status && !(PRODUCT_VARIANT_STATUSES as readonly string[]).includes(status))
    return { error: `status must be one of ${PRODUCT_VARIANT_STATUSES.join(', ')}.` }

  const type = queryText(read, 'type')
  if (type.length > 100)
    return { error: 'type must be 100 characters or fewer.' }

  const product = queryText(read, 'product')
  if (product && !/^\d+$/.test(product))
    return { error: 'product must be a product id.' }

  return { search, status: status as ProductVariantListQuery['status'], type, product, sort: sort as ProductVariantSort, direction, page, perPage }
}

const FROM = ' FROM product_variants v LEFT JOIN products p ON p.id = v.product_id'

/**
 * How many options a variant lists. `options` is text holding a JSON array
 * or a list split by commas, bars, semicolons or new lines, as
 * commerceStringList reads it; an array is measured by the dialect's JSON
 * functions and a list by its separators. A list that repeats an option, which
 * the page shows once, counts it each time.
 */
function optionCount(dialect: QueryBuilderDialect): string {
  const column = `COALESCE(TRIM(v.options), '')`
  const json = dialect === 'postgres'
    ? `json_array_length(CAST(v.options AS JSON))`
    : dialect === 'sqlite' ? 'json_array_length(v.options)' : 'JSON_LENGTH(v.options)'
  const newline = dialect === 'sqlite' ? 'char(10)' : dialect === 'postgres' ? 'chr(10)' : 'CHAR(10)'
  const stripped = `REPLACE(REPLACE(REPLACE(REPLACE(${column}, ',', ''), '|', ''), ';', ''), ${newline}, '')`
  return `CASE WHEN ${column} = '' THEN 0 WHEN ${column} LIKE '[%' THEN ${json} ELSE LENGTH(${column}) - LENGTH(${stripped}) + 1 END`
}

function sortExpression(sort: ProductVariantSort, dialect: QueryBuilderDialect): string {
  switch (sort) {
    case 'product': return `LOWER(COALESCE(p.name, ''))`
    case 'options': return optionCount(dialect)
    // As text: PostgreSQL and MySQL keep the status as an enum, which sorts by declaration order.
    case 'status': return asText('v.status', dialect)
    case 'newest': return 'v.id'
    case 'created': return 'v.created_at'
    default: return 'LOWER(v.variant)'
  }
}

export function productVariantFilter(query: Pick<ProductVariantListQuery, 'search' | 'status' | 'type' | 'product'>, dialect: QueryBuilderDialect): { where: string, values: unknown[] } {
  const { bind, values } = binder(dialect)
  const clauses: string[] = []
  if (query.status)
    clauses.push(`${asText('v.status', dialect)} = ${bind(query.status)}`)
  if (query.type)
    clauses.push(`v.type = ${bind(query.type)}`)
  if (query.product)
    clauses.push(`v.product_id = ${bind(Number(query.product))}`)
  if (query.search) {
    const pattern = containsPattern(query.search)
    const columns = ['v.variant', 'v.type', `COALESCE(v.description, '')`, `COALESCE(p.name, '')`, `COALESCE(v.options, '')`]
    clauses.push(`(${columns.map(column => `LOWER(${column}) LIKE ${bind(pattern)} ESCAPE '!'`).join(' OR ')})`)
  }
  return { where: clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '', values }
}

function orderBy(query: Pick<ProductVariantListQuery, 'sort' | 'direction'>, dialect: QueryBuilderDialect): string {
  const direction = query.direction === 'asc' ? 'ASC' : 'DESC'
  // Ties read by name, as the page sorted them; the id breaks every
  // remaining tie, so pages never repeat or skip a variant.
  if (query.sort === 'newest')
    return ` ORDER BY v.id ${direction}`
  const byName = query.sort === 'variant' ? '' : ', LOWER(v.variant) ASC'
  return ` ORDER BY ${sortExpression(query.sort, dialect)} ${direction}${byName}, v.id ${direction}`
}

function productNames(rows: unknown): Map<string, string> {
  return new Map(sqlRows(rows).map((row) => {
    const id = commerceIdentifier(commerceValue(row, 'id'), 'Product')
    return [id, commerceRequiredString(commerceValue(row, 'name'), `Product ${id}`, 'name')]
  }))
}

/** Variants turned into records, against exactly the products they reference. */
async function recordsFor(variants: Array<Record<string, unknown>>, run: CommerceSqlRunner, dialect: QueryBuilderDialect): Promise<ProductVariantRecord[]> {
  if (variants.length === 0)
    return []
  const productIds = referencedIds(variants, 'product_id')
  const products = productIds.length > 0
    ? await run.unsafe(`SELECT id, name FROM products WHERE id IN (${idPlaceholders(productIds, dialect)})`, productIds).execute()
    : []
  const names = productNames(products)
  return variants.map(variant => normalizeProductVariantRecord(variant, names))
}

/** The summary cards, over every variant as before. */
async function summarize(run: CommerceSqlRunner, dialect: QueryBuilderDialect): Promise<ProductVariantSummary> {
  const status = asText('status', dialect)
  const row = sqlRows(await run.unsafe(
    `SELECT COUNT(*) AS total_count, SUM(CASE WHEN ${status} = 'active' THEN 1 ELSE 0 END) AS active_count, SUM(CASE WHEN ${status} = 'draft' THEN 1 ELSE 0 END) AS draft_count, COUNT(DISTINCT product_id) AS product_count FROM product_variants`,
  ).execute())[0] ?? {}
  return {
    total: countOf(row.total_count),
    active: countOf(row.active_count),
    draft: countOf(row.draft_count),
    linkedProducts: countOf(row.product_count),
  }
}

export interface ProductVariantPage {
  records: ProductVariantRecord[]
  total: number
  page: number
  summary: ProductVariantSummary
  /** Every type any variant has, for the filter and the dialog's suggestions. */
  types: string[]
  /** Every product that has a variant, for the product filter, by name ignoring case. */
  products: Array<{ id: string, name: string }>
}

export async function readProductVariantPage(
  query: ProductVariantListQuery,
  run: CommerceSqlRunner = db,
  dialect: QueryBuilderDialect = getDatabaseDialect(),
): Promise<ProductVariantPage> {
  const { where, values } = productVariantFilter(query, dialect)
  const [counted, summary, typeRows, productRows] = await Promise.all([
    run.unsafe(`SELECT COUNT(*) AS total_count${FROM}${where}`, values).execute(),
    summarize(run, dialect),
    run.unsafe(`SELECT DISTINCT type AS value FROM product_variants WHERE type IS NOT NULL AND type <> ''`).execute(),
    run.unsafe('SELECT p.id, p.name FROM products p WHERE EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id) ORDER BY LOWER(p.name) ASC, p.id ASC').execute(),
  ])
  const total = countOf(sqlRows(counted)[0]?.total_count)
  const page = pageWithin(query.page, total, query.perPage)
  const variants = await run.unsafe(
    `SELECT v.*${FROM}${where}${orderBy(query, dialect)} LIMIT ${query.perPage} OFFSET ${(page - 1) * query.perPage}`,
    values,
  ).execute()
  return {
    records: await recordsFor(sqlRows(variants), run, dialect),
    total,
    page,
    summary,
    types: [...new Set(sqlRows(typeRows).map(row => String(row.value ?? '').trim()).filter(Boolean))].sort(),
    products: [...productNames(productRows)].map(([id, name]) => ({ id, name })),
  }
}
