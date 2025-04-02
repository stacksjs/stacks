import type { ShippingMethodJsonResponse } from '@stacksjs/orm'
import { db } from '@stacksjs/database'

/**
 * Fetch a shipping method by ID
 */
export async function fetchById(id: number): Promise<ShippingMethodJsonResponse | undefined> {
  return await db
    .selectFrom('shipping_methods')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

/**
 * Fetch all shipping methods
 */
export async function fetchAll(): Promise<ShippingMethodJsonResponse[]> {
  return await db.selectFrom('shipping_methods').selectAll().execute()
}
