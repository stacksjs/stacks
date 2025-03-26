import type { WaitlistProductJsonResponse } from '@stacksjs/orm'
import { db } from '@stacksjs/database'

/**
 * Fetch a waitlist product by ID
 */
export async function fetchById(id: number): Promise<WaitlistProductJsonResponse | undefined> {
  return await db
    .selectFrom('wait_list_products')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

/**
 * Fetch all waitlist products
 */
export async function fetchAll(): Promise<WaitlistProductJsonResponse[]> {
  return await db.selectFrom('wait_list_products').selectAll().execute()
}
