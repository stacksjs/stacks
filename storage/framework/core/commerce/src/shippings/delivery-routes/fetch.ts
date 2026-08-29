import type { RowOf } from '@stacksjs/database'
type DeliveryRouteJsonResponse = RowOf<'delivery_routes'>
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
    .where('last_active', '>=', Date.now() - 24 * 60 * 60 * 1000)
    .selectAll()
    .execute()
}

/**
 * Fetch delivery routes by courier
 */
export async function fetchByCourier(courier: string): Promise<DeliveryRouteJsonResponse[]> {
  return await db
    .selectFrom('delivery_routes')
    .where('courier', '=', courier)
    .selectAll()
    .execute()
}
