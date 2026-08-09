import type { ModelRow, ShippingMethod } from '@stacksjs/orm'
type ShippingMethodJsonResponse = ModelRow<typeof ShippingMethod>
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
    } as unknown as ShippingMethodJsonResponse
  }

  return undefined
}

/**
 * Fetch all shipping methods with their shipping zones
 */
export async function fetchAll(): Promise<ShippingMethodJsonResponse[]> {
  // Fetch all shipping methods
  const models = await db.selectFrom('shipping_methods').selectAll().execute()
  if (models.length === 0)
    return []

  // Get the IDs of all shipping methods
  const shippingMethodIds = [...new Set(models.map((model: any) => model.id))]

  const shippingQuery = db
    .selectFrom('shipping_zones')
    .where('shipping_method_id', 'in', shippingMethodIds) as any

  // Fetch shipping zones for these specific shipping methods using WHERE IN
  const allShippingZones = await shippingQuery.selectAll().execute()

  // Group shipping zones by shipping method ID
  const shippingZonesByMethodId = allShippingZones.reduce((acc: any, zone: any) => {
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
  return models.map((model: any) => ({
    ...model,
    shipping_zones: shippingZonesByMethodId[model.id] || [],
  }))
}
