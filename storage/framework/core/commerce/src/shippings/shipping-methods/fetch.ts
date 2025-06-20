import type { ShippingMethodJsonResponse } from '@stacksjs/orm'
import { db } from '@stacksjs/database'

/**
 * Fetch a shipping method by ID
 */
export async function fetchById(id: number): Promise<ShippingMethodJsonResponse | undefined> {
  const model = await db
    .selectFrom('shipping_methods')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()

  if (model) {
    const shippingZones = await db.selectFrom('shipping_zones').where('shipping_method_id', '=', id).selectAll().execute()

    return {
      ...model,
      shippingZones,
    }
  }

  return undefined
}

/**
 * Fetch all shipping methods with their shipping zones
 */
export async function fetchAll(): Promise<ShippingMethodJsonResponse[]> {
  // Fetch all shipping methods
  const models = await db.selectFrom('shipping_methods').selectAll().execute()

  // Get the IDs of all shipping methods
  const shippingMethodIds = models.map(model => model.id)

  let shippingQuery = db.selectFrom('shipping_zones')

  if (shippingMethodIds.length > 0) {
    shippingQuery = shippingQuery.where('shipping_method_id', 'in', shippingMethodIds)
  }

  // Fetch shipping zones for these specific shipping methods using WHERE IN
  const allShippingZones = await shippingQuery.selectAll().execute()

  // Group shipping zones by shipping method ID
  const shippingZonesByMethodId = allShippingZones.reduce((acc, zone) => {
    const methodId = zone.shipping_method_id
    if (methodId !== null && methodId !== undefined) {
      if (!acc[methodId]) {
        acc[methodId] = []
      }
      acc[methodId].push(zone)
    }
    return acc
  }, {} as Record<number, typeof allShippingZones>)

  // Attach shipping zones to each shipping method
  return models.map(model => ({
    ...model,
    shipping_zones: shippingZonesByMethodId[model.id] || [],
  }))
}
