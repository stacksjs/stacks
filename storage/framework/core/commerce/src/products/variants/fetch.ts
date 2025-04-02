import type { ProductVariantJsonResponse } from '@stacksjs/orm'
import { db } from '@stacksjs/database'

/**
 * Fetch a product variant by ID
 */
export async function fetchById(id: number): Promise<ProductVariantJsonResponse | undefined> {
  return await db
    .selectFrom('product_variants')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

/**
 * Fetch all product variants
 */
export async function fetchAll(): Promise<ProductVariantJsonResponse[]> {
  return await db.selectFrom('product_variants').selectAll().execute()
}
