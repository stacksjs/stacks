import type { Cart, ModelRow } from '@stacksjs/orm'
type CartJsonResponse = ModelRow<typeof Cart>
import { db } from '@stacksjs/database'
import { asModelRow, asModelRows } from '../utils/model-row'

/**
 * Fetch a cart by ID
 */
export async function fetchById(id: number): Promise<CartJsonResponse | undefined> {
  const row = await db
    .selectFrom('carts')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()

  return asModelRow<CartJsonResponse>(row, true)
}

/**
 * Fetch all carts
 */
export async function fetchAll(): Promise<CartJsonResponse[]> {
  return asModelRows<CartJsonResponse>(await db.selectFrom('carts').selectAll().execute())
}
