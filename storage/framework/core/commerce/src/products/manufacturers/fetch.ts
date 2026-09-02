import type { Manufacturer, ModelRow } from '@stacksjs/orm'
type ManufacturerJsonResponse = ModelRow<typeof Manufacturer>
import type { FetchManufacturersOptions, ManufacturerResponse } from '../../types'
import { db } from '@stacksjs/database'
import { asModelRow, asModelRows } from '../../utils/model-row'

export async function fetchAll(): Promise<ManufacturerJsonResponse[]> {
  return asModelRows<ManufacturerJsonResponse>(await db.selectFrom('manufacturers').selectAll().execute())
}

/**
 * Fetch a product manufacturer by ID
 */
export async function fetchById(id: number): Promise<ManufacturerJsonResponse | undefined> {
  const row = await db
    .selectFrom('manufacturers')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()

  return asModelRow<ManufacturerJsonResponse>(row, true)
}

/**
 * Fetch a product manufacturer by UUID
 */
export async function fetchByUuid(uuid: string): Promise<ManufacturerJsonResponse | undefined> {
  const row = await db
    .selectFrom('manufacturers')
    .where('uuid', '=', uuid)
    .selectAll()
    .executeTakeFirst()

  return asModelRow<ManufacturerJsonResponse>(row, true)
}

/**
 * Fetch featured manufacturers
 */
export async function fetchFeatured(limit: number = 10): Promise<ManufacturerJsonResponse[]> {
  const rows = await db
    .selectFrom('manufacturers')
    .where('featured', '=', true)
    .selectAll()
    .orderBy('manufacturer', 'asc')
    .limit(limit)
    .execute()

  return asModelRows<ManufacturerJsonResponse>(rows)
}

/**
 * Fetch manufacturers by country
 */
export async function fetchByCountry(country: string, options: FetchManufacturersOptions = {}): Promise<ManufacturerResponse> {
  // Set default values
  const page = (options).page || 1
  const limit = (options).limit || 2

  // Get total count for pagination
  const countResult = await db
    .selectFrom('manufacturers')
    .select(db.fn.count('id').as('total'))
    .where('country', '=', country)
    .executeTakeFirst() as { total: number } | undefined

  const total = Number(countResult?.total || 0)

  // Apply pagination
  const manufacturers = await db
    .selectFrom('manufacturers')
    .selectAll()
    .where('country', '=', country)
    .limit(limit)
    .offset((page - 1) * limit)
    .execute()

  // Calculate pagination info
  const totalPages = Math.ceil(total / limit)

  return {
    data: asModelRows<ManufacturerJsonResponse>(manufacturers),
    paging: {
      total_records: total,
      page,
      total_pages: totalPages,
    },
    next_cursor: page < totalPages ? page + 1 : null,
  }
}

/**
 * Fetch manufacturers with their product count
 */
export async function fetchWithProductCount(options: FetchManufacturersOptions = {}): Promise<ManufacturerJsonResponse[]> {
  // Start building the query with joins and filters before groupBy
  let query = db.selectFrom('manufacturers as m')
    .leftJoin('products as p', 'p.manufacturer_id', '=', 'm.id')

  // Apply filters before groupBy (WHERE must come before GROUP BY in SQL)
  if (options.country)
    query = query.where('m.country', '=', options.country)

  if (options.featured !== undefined)
    query = query.where('m.featured', '=', options.featured)

  // Apply select and groupBy after where clauses
  query = query
    .select([
      'm.id',
      'm.uuid',
      'm.manufacturer',
      'm.description',
      'm.country',
      'm.featured',
      'm.created_at',
      'm.updated_at',
      db.fn.count('p.id').as('product_count'),
    ])
    .groupBy('m.id')

  // Return all manufacturers
  return query.execute() as Promise<ManufacturerJsonResponse[]>
}
