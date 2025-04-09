import type { CartJsonResponse } from '@stacksjs/orm'
import { db } from '@stacksjs/database'

/**
 * Fetch a cart by ID
 */
export async function fetchById(id: number): Promise<CartJsonResponse | undefined> {
  return await db
    .selectFrom('carts')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

/**
 * Fetch all carts
 */
export async function fetchAll(): Promise<CartJsonResponse[]> {
  return await db.selectFrom('carts').selectAll().execute()
}
