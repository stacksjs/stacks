import type { QueryBuilderDialect } from '@stacksjs/database/runtime'
import { db, getDatabaseDialect } from '@stacksjs/database/runtime'
import type { QueryReader } from '../Content/content-list'
import { containsPattern, countOf, LIST_PAGE_SIZES, pageWithin, queryText } from '../Content/content-list'
import { commerceIdentifier, commerceRequiredString, commerceValue, referencedIds } from './commerce-record'
import type { CommerceSqlRunner } from './commerce-sql'
import { asText, binder, idPlaceholders, isTrue, sqlRows } from './commerce-sql'
import type { ProductUnitRecord, ProductUnitSummary } from './product-unit-records'
import { normalizeProductUnitRecord } from './product-unit-records'

/**
 * One page of product units, searched, filtered, sorted and counted by the
 * database, with the summary of every unit and every unit type
 * (stacksjs/stacks#3218).
 *
 * The Units page used to read the newest 500 units and do all of that in the
 * browser, so an older unit could not be found, its cards counted those 500,
 * and the type filter and the dialog's type suggestions only knew the types
 * those 500 used. It also read the first 500 products by name, for the
 * dialog's product select and to name each unit's product, so a unit for any
 * later product failed the whole page.
 */
export const PRODUCT_UNIT_SORTS = ['name', 'type', 'product', 'default', 'newest', 'created'] as const
export type ProductUnitSort = typeof PRODUCT_UNIT_SORTS[number]

export interface ProductUnitListQuery {
  search: string
  /** A unit type, or '' for any. */
  type: string
  /** '' for any. */
  isDefault: '' | 'default' | 'not-default'
  sort: ProductUnitSort
  direction: 'asc' | 'desc'
  page: number
  perPage: number
}

export function parseProductUnitListQuery(read: QueryReader): ProductUnitListQuery | { error: string } {
  const pageText = queryText(read, 'page')
  const page = pageText === '' ? 1 : Number(pageText)
  if (!Number.isInteger(page) || page < 1)
    return { error: 'page must be a whole number of 1 or more.' }

  const sizeText = queryText(read, 'per_page')
  const perPage = sizeText === '' ? 25 : Number(sizeText)
  if (!(LIST_PAGE_SIZES as readonly number[]).includes(perPage))
    return { error: `per_page must be one of ${LIST_PAGE_SIZES.join(', ')}.` }

  const sort = queryText(read, 'sort') || 'name'
  if (!(PRODUCT_UNIT_SORTS as readonly string[]).includes(sort))
    return { error: `sort must be one of ${PRODUCT_UNIT_SORTS.join(', ')}.` }

  const directionText = queryText(read, 'direction').toLowerCase()
  const direction = directionText === '' ? (sort === 'newest' || sort === 'created' || sort === 'default' ? 'desc' : 'asc') : directionText
  if (direction !== 'asc' && direction !== 'desc')
    return { error: 'direction must be asc or desc.' }

  const search = queryText(read, 'q')
  if (search.length > 200)
    return { error: 'q must be 200 characters or fewer.' }

  const type = queryText(read, 'type')
  if (type.length > 255)
    return { error: 'type must be 255 characters or fewer.' }

  const isDefault = queryText(read, 'default')
  if (isDefault && isDefault !== 'default' && isDefault !== 'not-default')
    return { error: 'default must be default or not-default.' }

  return { search, type, isDefault: isDefault as ProductUnitListQuery['isDefault'], sort: sort as ProductUnitSort, direction, page, perPage }
}

const FROM = ' FROM product_units u LEFT JOIN products p ON p.id = u.product_id'

function sortExpression(sort: ProductUnitSort, dialect: QueryBuilderDialect): string {
  switch (sort) {
    case 'type': return 'LOWER(u.type)'
    case 'product': return `LOWER(COALESCE(p.name, ''))`
    case 'default': return `CASE WHEN ${isTrue('u.is_default', dialect)} THEN 1 ELSE 0 END`
    case 'newest': return 'u.id'
    case 'created': return 'u.created_at'
    default: return 'LOWER(u.name)'
  }
}

export function productUnitFilter(query: Pick<ProductUnitListQuery, 'search' | 'type' | 'isDefault'>, dialect: QueryBuilderDialect): { where: string, values: unknown[] } {
  const { bind, values } = binder(dialect)
  const clauses: string[] = []
  if (query.type)
    clauses.push(`u.type = ${bind(query.type)}`)
  if (query.isDefault === 'default')
    clauses.push(isTrue('u.is_default', dialect))
  if (query.isDefault === 'not-default')
    clauses.push(`NOT (${isTrue('u.is_default', dialect)})`)
  if (query.search) {
    const pattern = containsPattern(query.search)
    const columns = ['u.name', 'u.abbreviation', 'u.type', `COALESCE(u.description, '')`, `COALESCE(p.name, '')`]
    clauses.push(`(${columns.map(column => `LOWER(${column}) LIKE ${bind(pattern)} ESCAPE '!'`).join(' OR ')})`)
  }
  return { where: clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '', values }
}

function orderBy(query: Pick<ProductUnitListQuery, 'sort' | 'direction'>, dialect: QueryBuilderDialect): string {
  const direction = query.direction === 'asc' ? 'ASC' : 'DESC'
  // Ties read by name, as the page sorted them; the id breaks every
  // remaining tie, so pages never repeat or skip a unit.
  if (query.sort === 'newest')
    return ` ORDER BY u.id ${direction}`
  const byName = query.sort === 'name' ? '' : ', LOWER(u.name) ASC'
  return ` ORDER BY ${sortExpression(query.sort, dialect)} ${direction}${byName}, u.id ${direction}`
}

/** Units turned into records, against exactly the products they reference. */
async function recordsFor(units: Array<Record<string, unknown>>, run: CommerceSqlRunner, dialect: QueryBuilderDialect): Promise<ProductUnitRecord[]> {
  if (units.length === 0)
    return []
  const productIds = referencedIds(units, 'product_id')
  const products = productIds.length > 0
    ? await run.unsafe(`SELECT id, name FROM products WHERE id IN (${idPlaceholders(productIds, dialect)})`, productIds).execute()
    : []
  const names = new Map(sqlRows(products).map((row) => {
    const id = commerceIdentifier(commerceValue(row, 'id'), 'Product')
    return [id, commerceRequiredString(commerceValue(row, 'name'), `Product ${id}`, 'name')]
  }))
  return units.map(unit => normalizeProductUnitRecord(unit, names))
}

/** The summary cards, over every unit as before. */
async function summarize(run: CommerceSqlRunner, dialect: QueryBuilderDialect): Promise<ProductUnitSummary> {
  const isDefault = isTrue('is_default', dialect)
  const [totals, conflicts] = await Promise.all([
    run.unsafe(`SELECT COUNT(*) AS total_count, SUM(CASE WHEN ${isDefault} THEN 1 ELSE 0 END) AS default_count, COUNT(DISTINCT CASE WHEN type <> '' THEN type END) AS type_count, COUNT(DISTINCT product_id) AS product_count FROM product_units`).execute(),
    // A type with more than one default unit is a conflict to resolve.
    run.unsafe(`SELECT type FROM product_units WHERE ${isDefault} AND type IS NOT NULL AND type <> '' GROUP BY type HAVING COUNT(*) > 1`).execute(),
  ])
  const row = sqlRows(totals)[0] ?? {}
  return {
    total: countOf(row.total_count),
    defaults: countOf(row.default_count),
    types: countOf(row.type_count),
    linkedProducts: countOf(row.product_count),
    defaultConflicts: sqlRows(conflicts).length,
  }
}

/** Every unit type any unit has, for the filter and the dialog's suggestions. */
async function unitTypes(run: CommerceSqlRunner, dialect: QueryBuilderDialect): Promise<string[]> {
  const rows = sqlRows(await run.unsafe(`SELECT DISTINCT ${asText('type', dialect)} AS value FROM product_units WHERE type IS NOT NULL AND type <> ''`).execute())
  return [...new Set(rows.map(row => String(row.value ?? '').trim()).filter(Boolean))].sort()
}

export interface ProductUnitPage {
  records: ProductUnitRecord[]
  total: number
  page: number
  summary: ProductUnitSummary
  types: string[]
}

export async function readProductUnitPage(
  query: ProductUnitListQuery,
  run: CommerceSqlRunner = db,
  dialect: QueryBuilderDialect = getDatabaseDialect(),
): Promise<ProductUnitPage> {
  const { where, values } = productUnitFilter(query, dialect)
  const [counted, summary, types] = await Promise.all([
    run.unsafe(`SELECT COUNT(*) AS total_count${FROM}${where}`, values).execute(),
    summarize(run, dialect),
    unitTypes(run, dialect),
  ])
  const total = countOf(sqlRows(counted)[0]?.total_count)
  const page = pageWithin(query.page, total, query.perPage)
  const units = await run.unsafe(
    `SELECT u.*${FROM}${where}${orderBy(query, dialect)} LIMIT ${query.perPage} OFFSET ${(page - 1) * query.perPage}`,
    values,
  ).execute()
  return { records: await recordsFor(sqlRows(units), run, dialect), total, page, summary, types }
}
