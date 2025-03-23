import type { ShippingZoneJsonResponse } from '../../../../orm/src/models/ShippingZone'
import { db } from '@stacksjs/database'

/**
 * Fetch a shipping zone by ID
 */
export async function fetchById(id: number): Promise<ShippingZoneJsonResponse | undefined> {
  return await db
    .selectFrom('shipping_zones')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}
