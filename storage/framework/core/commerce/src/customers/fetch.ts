import type { CustomerJsonResponse } from '@stacksjs/orm'
import { db } from '@stacksjs/database'

/**
 * Fetch a customer by ID
 */
export async function fetchById(id: number | bigint): Promise<CustomerJsonResponse | undefined> {
  return await db
    .selectFrom('customers')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

/**
 * Fetch all customers
 */
export async function fetchAll(): Promise<CustomerJsonResponse[]> {
  return await db.selectFrom('customers').selectAll().execute()
}
