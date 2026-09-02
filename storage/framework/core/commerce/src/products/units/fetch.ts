import type { ModelRow, ProductUnit } from '@stacksjs/orm'
type ProductUnitJsonResponse = ModelRow<typeof ProductUnit>
import { db } from '@stacksjs/database'
import { asModelRow, asModelRows } from '../../utils/model-row'

/**
 * Fetch a product unit by ID
 */
export async function fetchById(id: number): Promise<ProductUnitJsonResponse | undefined> {
  const row = await db
    .selectFrom('product_units')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()

  return asModelRow<ProductUnitJsonResponse>(row, true)
}

/**
 * Fetch all product units
 */
export async function fetchAll(): Promise<ProductUnitJsonResponse[]> {
  return asModelRows<ProductUnitJsonResponse>(await db.selectFrom('product_units').selectAll().execute())
}
