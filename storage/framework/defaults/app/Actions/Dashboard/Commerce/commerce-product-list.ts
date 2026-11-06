import type { QueryBuilderDialect } from '@stacksjs/database/runtime'
import { db, getDatabaseDialect } from '@stacksjs/database/runtime'
import type { QueryReader } from '../Content/content-list'
import { containsPattern, countOf, LIST_PAGE_SIZES, pageWithin, queryText } from '../Content/content-list'
import type { CommerceProductRecord, CommerceProductSummary, ProductOption } from './commerce-product-records'
import { normalizeCommerceProductRecord, normalizeManufacturerOption, normalizeProductOption } from './commerce-product-records'
import { referencedIds } from './commerce-record'
import type { CommerceSqlRunner } from './commerce-sql'
import { asText, binder, idPlaceholders, isTrue, sqlRows } from './commerce-sql'

/**
 * One page of products, searched, filtered, sorted and counted by the database,
 * with the store-wide summary (stacksjs/stacks#3218).
 *
 * The Products page used to read the newest 500 products and do all of that
 * in the browser, so a product past the 500th could not be found, and its
 * summary cards counted those 500, not the catalogue.
 */
export const PRODUCT_SORTS = ['created', 'id', 'name', 'category', 'price', 'inventory', 'available'] as const
export type ProductSort = typeof PRODUCT_SORTS[number]

export const PRODUCT_AVAILABILITY = ['available', 'unavailable', 'out-of-stock'] as const
export type ProductAvailability = typeof PRODUCT_AVAILABILITY[number]

export interface ProductListQuery {
  search: string
  /** A category id, or '' for any. */
  category: string
  /** '' for any. */
  availability: '' | ProductAvailability
  sort: ProductSort
  direction: 'asc' | 'desc'
  page: number
  perPage: number
}

export function parseProductListQuery(read: QueryReader): ProductListQuery | { error: string } {
  const pageText = queryText(read, 'page')
  const page = pageText === '' ? 1 : Number(pageText)
  if (!Number.isInteger(page) || page < 1)
    return { error: 'page must be a whole number of 1 or more.' }

  const sizeText = queryText(read, 'per_page')
  const perPage = sizeText === '' ? 25 : Number(sizeText)
  if (!(LIST_PAGE_SIZES as readonly number[]).includes(perPage))
    return { error: `per_page must be one of ${LIST_PAGE_SIZES.join(', ')}.` }

  const sort = queryText(read, 'sort') || 'created'
  if (!(PRODUCT_SORTS as readonly string[]).includes(sort))
    return { error: `sort must be one of ${PRODUCT_SORTS.join(', ')}.` }

  const directionText = queryText(read, 'direction').toLowerCase()
  const direction = directionText === '' ? (['created', 'price', 'inventory'].includes(sort) ? 'desc' : 'asc') : directionText
  if (direction !== 'asc' && direction !== 'desc')
    return { error: 'direction must be asc or desc.' }

  const search = queryText(read, 'q')
  if (search.length > 200)
    return { error: 'q must be 200 characters or fewer.' }

  const category = queryText(read, 'category')
  if (category && !/^\d+$/.test(category))
    return { error: 'category must be a category id.' }

  const availability = queryText(read, 'availability')
  if (availability && !(PRODUCT_AVAILABILITY as readonly string[]).includes(availability))
    return { error: `availability must be one of ${PRODUCT_AVAILABILITY.join(', ')}.` }

  return { search, category, availability: availability as ProductListQuery['availability'], sort: sort as ProductSort, direction, page, perPage }
}

function sortExpression(sort: ProductSort, dialect: QueryBuilderDialect): string {
  switch (sort) {
    case 'id': return 'p.id'
    case 'name': return 'LOWER(p.name)'
    case 'category': return `LOWER(COALESCE(c.name, ''))`
    case 'price': return 'p.price'
    case 'inventory': return 'p.inventory_count'
    case 'available': return `CASE WHEN ${isTrue('p.is_available', dialect)} THEN 1 ELSE 0 END`
    default: return 'p.created_at'
  }
}

const FROM = ' FROM products p LEFT JOIN categories c ON c.id = p.category_id LEFT JOIN manufacturers m ON m.id = p.manufacturer_id'

export function productFilter(query: Pick<ProductListQuery, 'search' | 'category' | 'availability'>, dialect: QueryBuilderDialect): { where: string, values: unknown[] } {
  const { bind, values } = binder(dialect)
  const clauses: string[] = []
  if (query.category)
    clauses.push(`p.category_id = ${bind(Number(query.category))}`)
  if (query.availability === 'available')
    clauses.push(isTrue('p.is_available', dialect))
  if (query.availability === 'unavailable')
    clauses.push(`NOT (${isTrue('p.is_available', dialect)})`)
  if (query.availability === 'out-of-stock')
    clauses.push('p.inventory_count = 0')
  if (query.search) {
    const pattern = containsPattern(query.search)
    const columns = [
      asText('p.id', dialect),
      `COALESCE(p.name, '')`,
      `COALESCE(p.description, '')`,
      `COALESCE(c.name, '')`,
      `COALESCE(m.manufacturer, '')`,
      `COALESCE(p.allergens, '')`,
    ]
    clauses.push(`(${columns.map(column => `LOWER(${column}) LIKE ${bind(pattern)} ESCAPE '!'`).join(' OR ')})`)
  }
  return { where: clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '', values }
}

function orderBy(query: Pick<ProductListQuery, 'sort' | 'direction'>, dialect: QueryBuilderDialect): string {
  const direction = query.direction === 'asc' ? 'ASC' : 'DESC'
  // Price, inventory, availability and category ties read by name, as the
  // page sorted them; the id breaks every remaining tie, so pages never repeat
  // or skip a product.
  const byName = ['price', 'inventory', 'available', 'category'].includes(query.sort) ? ', LOWER(p.name) ASC' : ''
  return ` ORDER BY ${sortExpression(query.sort, dialect)} ${direction}${byName}, p.id ${direction}`
}

/** How many rows of `table` each product has, by product id. */
async function relationCounts(table: 'product_variants' | 'product_units' | 'reviews', productIds: number[], run: CommerceSqlRunner, dialect: QueryBuilderDialect): Promise<Map<string, number>> {
  if (productIds.length === 0)
    return new Map()
  const rows = sqlRows(await run.unsafe(
    `SELECT product_id, COUNT(*) AS item_count FROM ${table} WHERE product_id IN (${idPlaceholders(productIds, dialect)}) GROUP BY product_id`,
    productIds,
  ).execute())
  return new Map(rows.map(row => [String(row.product_id), countOf(row.item_count)]))
}

/** Products turned into records, against exactly the categories and manufacturers they reference. */
async function recordsFor(products: Array<Record<string, unknown>>, run: CommerceSqlRunner, dialect: QueryBuilderDialect): Promise<CommerceProductRecord[]> {
  if (products.length === 0)
    return []
  const productIds = referencedIds(products, 'id')
  const categoryIds = referencedIds(products, 'category_id')
  const manufacturerIds = referencedIds(products, 'manufacturer_id')
  const [categories, manufacturers, variants, units, reviews] = await Promise.all([
    categoryIds.length > 0 ? run.unsafe(`SELECT id, name FROM categories WHERE id IN (${idPlaceholders(categoryIds, dialect)})`, categoryIds).execute() : [],
    manufacturerIds.length > 0 ? run.unsafe(`SELECT id, manufacturer FROM manufacturers WHERE id IN (${idPlaceholders(manufacturerIds, dialect)})`, manufacturerIds).execute() : [],
    relationCounts('product_variants', productIds, run, dialect),
    relationCounts('product_units', productIds, run, dialect),
    relationCounts('reviews', productIds, run, dialect),
  ])
  const categoryMap = new Map(sqlRows(categories).map(normalizeProductOption).map(option => [option.id, option.label]))
  const manufacturerMap = new Map(sqlRows(manufacturers).map(normalizeManufacturerOption).map(option => [option.id, option.label]))
  return products.map(product => normalizeCommerceProductRecord(product, categoryMap, manufacturerMap, variants, units, reviews))
}

/** The summary cards, over the whole catalogue as before. */
async function summarize(run: CommerceSqlRunner, dialect: QueryBuilderDialect): Promise<CommerceProductSummary> {
  const row = sqlRows(await run.unsafe(
    `SELECT COUNT(*) AS total_count, SUM(CASE WHEN ${isTrue('is_available', dialect)} THEN 1 ELSE 0 END) AS available_count, SUM(CASE WHEN inventory_count = 0 THEN 1 ELSE 0 END) AS out_count, SUM(inventory_count) AS inventory_total FROM products`,
  ).execute())[0] ?? {}
  const total = countOf(row.total_count)
  const available = countOf(row.available_count)
  return {
    total,
    available,
    unavailable: total - available,
    outOfStock: countOf(row.out_count),
    totalInventory: countOf(row.inventory_total),
  }
}

/**
 * Every category and manufacturer, for the filter and the product dialog.
 * These are small reference tables, so they are read whole rather than the
 * first 500 of each.
 */
async function options(run: CommerceSqlRunner): Promise<{ categories: ProductOption[], manufacturers: ProductOption[] }> {
  const [categories, manufacturers] = await Promise.all([
    // LOWER, so the order is the same on every dialect: each collates case its own way.
    run.unsafe('SELECT id, name FROM categories ORDER BY LOWER(name) ASC, id ASC').execute(),
    run.unsafe('SELECT id, manufacturer FROM manufacturers ORDER BY LOWER(manufacturer) ASC, id ASC').execute(),
  ])
  return {
    categories: sqlRows(categories).map(normalizeProductOption),
    manufacturers: sqlRows(manufacturers).map(normalizeManufacturerOption),
  }
}

export interface ProductPage {
  records: CommerceProductRecord[]
  total: number
  page: number
  summary: CommerceProductSummary
  categories: ProductOption[]
  manufacturers: ProductOption[]
}

export async function readProductPage(
  query: ProductListQuery,
  run: CommerceSqlRunner = db,
  dialect: QueryBuilderDialect = getDatabaseDialect(),
): Promise<ProductPage> {
  const { where, values } = productFilter(query, dialect)
  const [counted, summary, choices] = await Promise.all([
    run.unsafe(`SELECT COUNT(*) AS total_count${FROM}${where}`, values).execute(),
    summarize(run, dialect),
    options(run),
  ])
  const total = countOf(sqlRows(counted)[0]?.total_count)
  const page = pageWithin(query.page, total, query.perPage)
  const products = await run.unsafe(
    `SELECT p.*${FROM}${where}${orderBy(query, dialect)} LIMIT ${query.perPage} OFFSET ${(page - 1) * query.perPage}`,
    values,
  ).execute()
  return { records: await recordsFor(sqlRows(products), run, dialect), total, page, summary, ...choices }
}

/** Every product matching the query, in its order, for the CSV export, a batch at a time. */
export async function readProductsForExport(
  query: Omit<ProductListQuery, 'page' | 'perPage'>,
  run: CommerceSqlRunner = db,
  dialect: QueryBuilderDialect = getDatabaseDialect(),
  batchSize: number = 500,
): Promise<CommerceProductRecord[]> {
  const { where, values } = productFilter(query, dialect)
  const records: CommerceProductRecord[] = []
  for (let offset = 0; ; offset += batchSize) {
    const batch = sqlRows(await run.unsafe(
      `SELECT p.*${FROM}${where}${orderBy(query, dialect)} LIMIT ${batchSize} OFFSET ${offset}`,
      values,
    ).execute())
    records.push(...await recordsFor(batch, run, dialect))
    if (batch.length < batchSize)
      return records
  }
}

const CSV_HEADER = ['Product ID', 'Name', 'Description', 'Price', 'Currency', 'Availability', 'Inventory', 'Preparation minutes', 'Category', 'Manufacturer', 'Allergens', 'Variants', 'Units', 'Reviews', 'Created at']

/** The CSV "Export filtered" downloads: the page's columns, for every matching product. */
export function productsCsv(records: CommerceProductRecord[], currency: string, minor: (amount: number, currency: string) => string): string {
  const escape = (value: string): string => `"${value.replaceAll('"', '""')}"`
  const lines = records.map(record => [
    record.id,
    record.name,
    record.description,
    minor(record.price, currency),
    currency,
    record.isAvailable ? 'Available' : 'Unavailable',
    String(record.inventoryCount),
    String(record.preparationTime),
    record.categoryName,
    record.manufacturerName,
    record.allergens.join('; '),
    String(record.variantCount),
    String(record.unitCount),
    String(record.reviewCount),
    record.createdAt,
  ])
  return `﻿${[CSV_HEADER, ...lines].map(row => row.map(escape).join(',')).join('\n')}`
}
