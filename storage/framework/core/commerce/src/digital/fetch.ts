import type { DigitalDeliveryJsonResponse } from '@stacksjs/orm'
import { db } from '@stacksjs/database'

/**
 * Fetch a shipping method by ID
 */
export async function fetchById(id: number): Promise<DigitalDeliveryJsonResponse | undefined> {
  return await db
    .selectFrom('digital_deliveries')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

/**
 * Fetch all digital deliveries
 */
export async function fetchAll(): Promise<DigitalDeliveryJsonResponse[]> {
  return await db.selectFrom('digital_deliveries').selectAll().execute()
}
