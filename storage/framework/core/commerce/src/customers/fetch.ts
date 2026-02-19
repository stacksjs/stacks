type CustomerJsonResponse = ModelRow<typeof Customer>
import { db } from '@stacksjs/database'

/**
 * Fetch a customer by ID
 */
export async function fetchById(id: number): Promise<CustomerJsonResponse | undefined> {
  return await db
    .selectFrom('customers')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst() as CustomerJsonResponse | undefined
}

/**
 * Fetch all customers
 */
export async function fetchAll(): Promise<CustomerJsonResponse[]> {
  return await db.selectFrom('customers').selectAll().execute() as CustomerJsonResponse[]
}
