type ProductUnitJsonResponse = ModelRow<typeof ProductUnit>
import { db } from '@stacksjs/database'

/**
 * Fetch a product unit by ID
 */
export async function fetchById(id: number): Promise<ProductUnitJsonResponse | undefined> {
  return await db
    .selectFrom('product_units')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst() as ProductUnitJsonResponse | undefined
}

/**
 * Fetch all product units
 */
export async function fetchAll(): Promise<ProductUnitJsonResponse[]> {
  return await db.selectFrom('product_units').selectAll().execute() as ProductUnitJsonResponse[]
}
