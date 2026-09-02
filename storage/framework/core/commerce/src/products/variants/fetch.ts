import type { ModelRow, ProductVariant } from '@stacksjs/orm'
type ProductVariantJsonResponse = ModelRow<typeof ProductVariant>
import { db } from '@stacksjs/database'
import { asModelRow, asModelRows } from '../../utils/model-row'

/**
 * Fetch a product variant by ID
 */
export async function fetchById(id: number): Promise<ProductVariantJsonResponse | undefined> {
  const row = await db
    .selectFrom('product_variants')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()

  return asModelRow<ProductVariantJsonResponse>(row, true)
}

/**
 * Fetch all product variants
 */
export async function fetchAll(): Promise<ProductVariantJsonResponse[]> {
  return asModelRows<ProductVariantJsonResponse>(await db.selectFrom('product_variants').selectAll().execute())
}
