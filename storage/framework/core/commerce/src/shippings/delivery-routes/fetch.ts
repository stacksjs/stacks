import type { DeliveryRouteJsonResponse } from '@stacksjs/orm'
import { db } from '@stacksjs/database'

/**
 * Fetch a delivery route by ID
 */
export async function fetchById(id: number): Promise<DeliveryRouteJsonResponse | undefined> {
  return await db
    .selectFrom('delivery_routes')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

/**
 * Fetch all delivery routes
 */
export async function fetchAll(): Promise<DeliveryRouteJsonResponse[]> {
  return await db.selectFrom('delivery_routes').selectAll().execute()
}

/**
 * Fetch active delivery routes
 */
export async function fetchActive(): Promise<DeliveryRouteJsonResponse[]> {
  return await db
    .selectFrom('delivery_routes')
    .where('last_active', '<=', new Date(Date.now() - 24 * 60 * 60 * 1000)) // Last 24 hours
    .selectAll()
    .execute()
}

/**
 * Fetch delivery routes by driver
 */
export async function fetchByDriver(driver: string): Promise<DeliveryRouteJsonResponse[]> {
  return await db
    .selectFrom('delivery_routes')
    .where('driver', '=', driver)
    .selectAll()
    .execute()
}
