import type { ShippingRateJsonResponse } from '../../../../orm/src/models/ShippingRate'
import { db } from '@stacksjs/database'

/**
 * Fetch a shipping zone by ID
 */
export async function fetchById(id: number): Promise<ShippingRateJsonResponse | undefined> {
  return await db
    .selectFrom('shipping_rates')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}
