import type { QueryBuilderDialect } from '@stacksjs/database/runtime'
import { db, getDatabaseDialect } from '@stacksjs/database/runtime'
import type { QueryReader } from '../Content/content-list'
import { countOf, LIST_PAGE_SIZES, pageWithin, queryText } from '../Content/content-list'
import type { CommercePosProduct } from './commerce-pos'
import { normalizeCommercePosProduct, selectCommercePosTaxRate } from './commerce-pos'
import { PRODUCT_FROM, productFilter, productRecordsFor } from './commerce-product-list'
import type { ProductOption } from './commerce-product-records'
import { normalizeProductOption } from './commerce-product-records'
import type { CommerceSqlRunner } from './commerce-sql'
import { asText, idPlaceholders, isTrue, sqlRows } from './commerce-sql'

/**
 * The point of sale's catalogue and settings, read by the database
 * (stacksjs/stacks#3218).
 *
 * The point of sale used to read the first 500 products, categories,
 * manufacturers, customers and tax rates by name or id with every load, so a
 * product past the 500th could not be rung up, its category or manufacturer
 * failed the whole screen, and the checkout could not be given a later
 * customer. The catalogue is now searched and paged here, a cart is checked
 * against exactly the products it holds, the checkout searches customers
 * (commerce-choices.ts), and the settings are counted over everything.
 */
export const POS_AVAILABILITY = ['sellable', 'unsellable'] as const

export interface PosCatalogQuery {
  search: string
  /** A category id, or '' for any. */
  category: string
  /** '' for every product. */
  availability: '' | typeof POS_AVAILABILITY[number]
  page: number
  perPage: number
}

/** The most products a cart can be checked against in one request. */
export const POS_MAX_IDS = 100

export function parsePosCatalogQuery(read: QueryReader): PosCatalogQuery | { error: string } {
  const pageText = queryText(read, 'page')
  const page = pageText === '' ? 1 : Number(pageText)
  if (!Number.isInteger(page) || page < 1)
    return { error: 'page must be a whole number of 1 or more.' }

  const sizeText = queryText(read, 'per_page')
  const perPage = sizeText === '' ? 50 : Number(sizeText)
  if (!(LIST_PAGE_SIZES as readonly number[]).includes(perPage))
    return { error: `per_page must be one of ${LIST_PAGE_SIZES.join(', ')}.` }

  const search = queryText(read, 'q')
  if (search.length > 200)
    return { error: 'q must be 200 characters or fewer.' }

  const category = queryText(read, 'category')
  if (category && !/^\d+$/.test(category))
    return { error: 'category must be a category id.' }

  const availability = queryText(read, 'availability')
  if (availability && !(POS_AVAILABILITY as readonly string[]).includes(availability))
    return { error: `availability must be one of ${POS_AVAILABILITY.join(', ')}.` }

  return { search, category, availability: availability as PosCatalogQuery['availability'], page, perPage }
}

/** The product ids in `ids=1,2,3`, or an error. Empty when there is no `ids`. */
export function parsePosIds(read: QueryReader): number[] | { error: string } {
  const text = queryText(read, 'ids')
  if (!text)
    return []
  const parts = text.split(',').map(part => part.trim()).filter(Boolean)
  if (parts.length > POS_MAX_IDS)
    return { error: `ids can list at most ${POS_MAX_IDS} products.` }
  if (!parts.every(part => /^\d+$/.test(part)))
    return { error: 'ids must be product ids separated by commas.' }
  return [...new Set(parts.map(Number))]
}

async function posProducts(rows: Array<Record<string, unknown>>, run: CommerceSqlRunner, dialect: QueryBuilderDialect): Promise<CommercePosProduct[]> {
  return (await productRecordsFor(rows, run, dialect, false)).map(normalizeCommercePosProduct)
}

export interface PosCatalogPage {
  products: CommercePosProduct[]
  total: number
  page: number
}

/** One page of the catalogue, by name ignoring case, then id. */
export async function readPosCatalogPage(
  query: PosCatalogQuery,
  run: CommerceSqlRunner = db,
  dialect: QueryBuilderDialect = getDatabaseDialect(),
): Promise<PosCatalogPage> {
  const { where, values } = productFilter({
    search: query.search,
    category: query.category,
    availability: query.availability,
  }, dialect)
  const counted = await run.unsafe(`SELECT COUNT(*) AS total_count${PRODUCT_FROM}${where}`, values).execute()
  const total = countOf(sqlRows(counted)[0]?.total_count)
  const page = pageWithin(query.page, total, query.perPage)
  const rows = await run.unsafe(
    `SELECT p.*${PRODUCT_FROM}${where} ORDER BY LOWER(p.name) ASC, p.id ASC LIMIT ${query.perPage} OFFSET ${(page - 1) * query.perPage}`,
    values,
  ).execute()
  return { products: await posProducts(sqlRows(rows), run, dialect), total, page }
}

/**
 * Exactly the products a cart holds, as they are now, so a reload can update
 * each line's price and stock, or drop it, whatever page the catalogue shows.
 */
export async function readPosProducts(
  ids: number[],
  run: CommerceSqlRunner = db,
  dialect: QueryBuilderDialect = getDatabaseDialect(),
): Promise<CommercePosProduct[]> {
  if (ids.length === 0)
    return []
  const rows = await run.unsafe(`SELECT p.*${PRODUCT_FROM} WHERE p.id IN (${idPlaceholders(ids, dialect)})`, ids).execute()
  return posProducts(sqlRows(rows), run, dialect)
}

/**
 * The rate a sale is taxed at: the default active tax rate, else the first
 * active one by id, else 0. The point of sale shows it and the checkout
 * charges it, so both read it here; the checkout used to choose among the
 * first 500 rates by id, so the two could disagree.
 */
export async function readPosTaxRate(
  run: CommerceSqlRunner = db,
  dialect: QueryBuilderDialect = getDatabaseDialect(),
): Promise<number> {
  const rows = await run.unsafe(`SELECT id, rate, status, is_default FROM tax_rates WHERE ${asText('status', dialect)} = 'active' ORDER BY CASE WHEN ${isTrue('is_default', dialect)} THEN 0 ELSE 1 END, id LIMIT 1`).execute()
  return selectCommercePosTaxRate(sqlRows(rows))
}

export interface PosSettings {
  /** The categories some product is in, by name ignoring case. */
  categories: ProductOption[]
  /** The default active tax rate, or the first active one, or 0. */
  taxRate: number
  summary: { products: number, sellable: number, inventory: number }
}

export async function readPosSettings(
  run: CommerceSqlRunner = db,
  dialect: QueryBuilderDialect = getDatabaseDialect(),
): Promise<PosSettings> {
  const [categories, taxRate, totals] = await Promise.all([
    run.unsafe('SELECT c.id, c.name FROM categories c WHERE EXISTS (SELECT 1 FROM products p WHERE p.category_id = c.id) ORDER BY LOWER(c.name) ASC, c.id ASC').execute(),
    readPosTaxRate(run, dialect),
    run.unsafe(`SELECT COUNT(*) AS product_count, SUM(CASE WHEN ${isTrue('is_available', dialect)} AND inventory_count > 0 THEN 1 ELSE 0 END) AS sellable_count, SUM(inventory_count) AS inventory_total FROM products`).execute(),
  ])
  const row = sqlRows(totals)[0] ?? {}
  return {
    categories: sqlRows(categories).map(normalizeProductOption),
    taxRate,
    summary: {
      products: countOf(row.product_count),
      sellable: countOf(row.sellable_count),
      inventory: countOf(row.inventory_total),
    },
  }
}
