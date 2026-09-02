import type { Customer, ModelRow } from '@stacksjs/orm'
type CustomerJsonResponse = ModelRow<typeof Customer>
import { db } from '@stacksjs/database'
import { asModelRow, asModelRows } from '../utils/model-row'

/**
 * Fetch a customer by ID
 */
export async function fetchById(id: number): Promise<CustomerJsonResponse | undefined> {
  const row = await db
    .selectFrom('customers')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()

  return asModelRow<CustomerJsonResponse>(row, true)
}

/**
 * Fetch all customers
 */
export async function fetchAll(): Promise<CustomerJsonResponse[]> {
  return asModelRows<CustomerJsonResponse>(await db.selectFrom('customers').selectAll().execute())
}
