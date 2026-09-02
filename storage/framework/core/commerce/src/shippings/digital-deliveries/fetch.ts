import type { DigitalDelivery, ModelRow } from '@stacksjs/orm'
type DigitalDeliveryJsonResponse = ModelRow<typeof DigitalDelivery>
import { db } from '@stacksjs/database'
import { asModelRow, asModelRows } from '../../utils/model-row'

/**
 * Fetch a shipping method by ID
 */
export async function fetchById(id: number): Promise<DigitalDeliveryJsonResponse | undefined> {
  const row = await db
    .selectFrom('digital_deliveries')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()

  return asModelRow<DigitalDeliveryJsonResponse>(row, true)
}

/**
 * Fetch all digital deliveries
 */
export async function fetchAll(): Promise<DigitalDeliveryJsonResponse[]> {
  return asModelRows<DigitalDeliveryJsonResponse>(await db.selectFrom('digital_deliveries').selectAll().execute())
}
