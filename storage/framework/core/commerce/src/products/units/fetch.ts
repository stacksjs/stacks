import type { ProductUnitJsonResponse } from '@stacksjs/orm'
import { db } from '@stacksjs/database'

/**
 * Fetch a product unit by ID
 */
export async function fetchById(id: number): Promise<ProductUnitJsonResponse | undefined> {
  return await db
    .selectFrom('product_units')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

/**
 * Fetch all product units
 */
export async function fetchAll(): Promise<ProductUnitJsonResponse[]> {
  return await db.selectFrom('product_units').selectAll().execute()
}
