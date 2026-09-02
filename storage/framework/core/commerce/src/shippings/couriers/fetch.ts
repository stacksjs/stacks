import type { Courier, ModelRow } from '@stacksjs/orm'
type CourierJsonResponse = ModelRow<typeof Courier>
import { db } from '@stacksjs/database'
import { asModelRow, asModelRows } from '../../utils/model-row'

/**
 * Fetch a courier by ID
 */
export async function fetchById(id: number): Promise<CourierJsonResponse | undefined> {
  const row = await db
    .selectFrom('couriers')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()

  return asModelRow<CourierJsonResponse>(row, true)
}

/**
 * Fetch all couriers
 */
export async function fetchAll(): Promise<CourierJsonResponse[]> {
  return asModelRows<CourierJsonResponse>(await db.selectFrom('couriers').selectAll().execute())
}
