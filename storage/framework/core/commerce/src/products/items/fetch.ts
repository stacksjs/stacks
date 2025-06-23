import type { ProductItemJsonResponse } from '@stacksjs/orm'
import { db } from '@stacksjs/database'

/**
 * Fetch a product item by ID
 */
export async function fetchById(id: number): Promise<ProductItemJsonResponse | undefined> {
  return await db
    .selectFrom('products')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

/**
 * Fetch all product items
 */
export async function fetchAll(): Promise<ProductItemJsonResponse[]> {
  return await db.selectFrom('products').selectAll().execute()
}
