import type { Courier, ModelRow } from '@stacksjs/orm'
type CourierJsonResponse = ModelRow<typeof Courier>
import { db } from '@stacksjs/database'

/**
 * Fetch a courier by ID
 */
export async function fetchById(id: number): Promise<CourierJsonResponse | undefined> {
  return await db
    .selectFrom('couriers')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst() as CourierJsonResponse | undefined
}

/**
 * Fetch all couriers
 */
export async function fetchAll(): Promise<CourierJsonResponse[]> {
  return await db.selectFrom('couriers').selectAll().execute() as CourierJsonResponse[]
}
