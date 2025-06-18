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
 * Fetch all shipping methods
 */
export async function fetchAll(): Promise<ShippingMethodJsonResponse[]> {
  const models = await db.selectFrom('shipping_methods').selectAll().execute()

  for (const model of models) {
    const shippingZones = await db.selectFrom('shipping_zones').where('shipping_method_id', '=', model.id).selectAll().execute()

    model.shipping_zones = shippingZones
  }

  return models
}

