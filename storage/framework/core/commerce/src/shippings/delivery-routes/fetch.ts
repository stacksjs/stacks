import type { DeliveryRoute, ModelRow } from '@stacksjs/orm'
type DeliveryRouteJsonResponse = ModelRow<typeof DeliveryRoute>
import { db } from '@stacksjs/database'

/**
 * Fetch a delivery route by ID
 */
export async function fetchById(id: number): Promise<DeliveryRouteJsonResponse | undefined> {
  return await db
    .selectFrom('delivery_routes')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst() as DeliveryRouteJsonResponse | undefined
}

/**
 * Fetch all delivery routes
 */
export async function fetchAll(): Promise<DeliveryRouteJsonResponse[]> {
  return await db.selectFrom('delivery_routes').selectAll().execute() as DeliveryRouteJsonResponse[]
}

/**
 * Fetch active delivery routes
 */
export async function fetchActive(): Promise<DeliveryRouteJsonResponse[]> {
  return await db
    .selectFrom('delivery_routes')
    .where('last_active', '>=', Date.now() - 24 * 60 * 60 * 1000)
    .selectAll()
    .execute() as DeliveryRouteJsonResponse[]
}

/**
 * Fetch delivery routes by driver
 */
export async function fetchByDriver(driver: string): Promise<DeliveryRouteJsonResponse[]> {
  return await db
    .selectFrom('delivery_routes')
    .where('driver', '=', driver)
    .selectAll()
    .execute() as DeliveryRouteJsonResponse[]
}
