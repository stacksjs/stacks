type ManufacturerJsonResponse = ModelRow<typeof Manufacturer>
import type { FetchManufacturersOptions, ManufacturerResponse } from '../../types'
import { db } from '@stacksjs/database'

export function fetchAll(): Promise<ManufacturerJsonResponse[]> {
  return db.selectFrom('manufacturers').selectAll().execute() as Promise<ManufacturerJsonResponse[]>
}

/**
 * Fetch a product manufacturer by ID
 */
export async function fetchById(id: number): Promise<ManufacturerJsonResponse | undefined> {
  return await db
    .selectFrom('manufacturers')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst() as ManufacturerJsonResponse | undefined
}

/**
 * Fetch a product manufacturer by UUID
 */
export async function fetchByUuid(uuid: string): Promise<ManufacturerJsonResponse | undefined> {
  return await db
    .selectFrom('manufacturers')
    .where('uuid', '=', uuid)
    .selectAll()
    .executeTakeFirst() as ManufacturerJsonResponse | undefined
}

/**
 * Fetch featured manufacturers
 */
export async function fetchFeatured(limit: number = 10): Promise<ManufacturerJsonResponse[]> {
  return await db
    .selectFrom('manufacturers')
    .where('featured', '=', true)
    .selectAll()
    .orderBy('manufacturer', 'asc')
    .limit(limit)
    .execute() as ManufacturerJsonResponse[]
}

/**
 * Fetch manufacturers by country
 */
export async function fetchByCountry(country: string, options: FetchManufacturersOptions = {}): Promise<ManufacturerResponse> {
  // Set default values
  const page = (options as any).page || 1
  const limit = (options as any).limit || 2

  // Get total count for pagination
  const countResult = await db
    .selectFrom('manufacturers')
    .select(((eb: any) => eb.fn.count('id').as('total')) as any)
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
    data: manufacturers as ManufacturerJsonResponse[],
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
    .leftJoin('products as p', 'p.manufacturer_id', '=', 'm.id') as any

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
      (eb: any) => eb.fn.count('p.id').as('product_count'),
    ] as any)
    .groupBy('m.id')

  // Return all manufacturers
  return query.execute() as Promise<ManufacturerJsonResponse[]>
}
