import type { ShippingRateJsonResponse } from '@stacksjs/orm'
import { db } from '@stacksjs/database'

/**
 * Fetch a shipping rate by ID
 */
export async function fetchById(id: number): Promise<ShippingRateJsonResponse | undefined> {
  const model = await db
    .selectFrom('shipping_rates')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()

  if (model) {
    let shippingZone = null
    let shippingMethod = null

    if (model.shipping_zone_id) {
      shippingZone = await db
        .selectFrom('shipping_zones')
        .where('id', '=', model.shipping_zone_id)
        .selectAll()
        .executeTakeFirst()
    }

    if (model.shipping_method_id) {
      shippingMethod = await db
        .selectFrom('shipping_methods')
        .where('id', '=', model.shipping_method_id)
        .selectAll()
        .executeTakeFirst()
    }

    return {
      ...model,
      shipping_zone: shippingZone,
      shipping_method: shippingMethod,
    }
  }

  return undefined
}

/**
 * Fetch all shipping rates with their shipping zones and methods
 */
export async function fetchAll(): Promise<ShippingRateJsonResponse[]> {
  // Fetch all shipping rates
  const models = await db.selectFrom('shipping_rates').selectAll().execute()

  // Get the IDs of all shipping zones and methods
  const shippingZoneIds = models.map(model => model.shipping_zone_id).filter(id => id !== null && id !== undefined)
  const shippingMethodIds = models.map(model => model.shipping_method_id).filter(id => id !== null && id !== undefined)

  let shippingZonesQuery = db.selectFrom('shipping_zones')
  let shippingMethodsQuery = db.selectFrom('shipping_methods')

  if (shippingZoneIds.length > 0) {
    shippingZonesQuery = shippingZonesQuery.where('id', 'in', shippingZoneIds)
  }

  if (shippingMethodIds.length > 0) {
    shippingMethodsQuery = shippingMethodsQuery.where('id', 'in', shippingMethodIds)
  }

  // Fetch shipping zones and methods for these specific IDs using WHERE IN
  const allShippingZones = await shippingZonesQuery.selectAll().execute()
  const allShippingMethods = await shippingMethodsQuery.selectAll().execute()

  // Group shipping zones and methods by ID
  const shippingZonesById = allShippingZones.reduce((acc, zone) => {
    acc[zone.id] = zone
    return acc
  }, {} as Record<number, typeof allShippingZones[0]>)

  const shippingMethodsById = allShippingMethods.reduce((acc, method) => {
    acc[method.id] = method
    return acc
  }, {} as Record<number, typeof allShippingMethods[0]>)

  // Attach shipping zones and methods to each shipping rate
  return models.map(model => ({
    ...model,
    shipping_zone: model.shipping_zone_id ? shippingZonesById[model.shipping_zone_id] : [],
    shipping_method: model.shipping_method_id ? shippingMethodsById[model.shipping_method_id] : [],
  }))
}

/**
 * Get shipping rates by zone
 *
 * @param zoneId Shipping zone identifier
 * @returns List of shipping rates for the specified zone
 */
export async function getRatesByZone(zoneId: number): Promise<ShippingRateJsonResponse[]> {
  try {
    const rates = await db
      .selectFrom('shipping_rates')
      .selectAll()
      .where('shipping_zone_id', '=', zoneId)
      .orderBy('weight_from')
      .execute()

    return rates
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to get shipping rates by zone: ${error.message}`)
    }

    throw error
  }
}

/**
 * Get shipping rate based on weight and zone
 *
 * @param weight Weight in the appropriate unit
 * @param zoneId Shipping zone identifier
 * @returns Matching shipping rate or undefined
 */
export async function getRateByWeightAndZone(weight: number, zoneId: number): Promise<ShippingRateJsonResponse | undefined> {
  try {
    const rate = await db
      .selectFrom('shipping_rates')
      .selectAll()
      .where('shipping_zone_id', '=', zoneId)
      .where('weight_from', '<=', weight)
      .where('weight_to', '>=', weight)
      .executeTakeFirst()

    return rate
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to get shipping rate by weight and zone: ${error.message}`)
    }

    throw error
  }
}

/**
 * Format shipping rate options for dropdown menus or selectors
 *
 * @returns Array of formatted shipping rate options with id, method, zone, and rate
 */
export async function formatShippingRateOptions(): Promise<{ id: number, shipping_method_id: number, shipping_zone_id: number, rate: number }[]> {
  try {
    const results = await db
      .selectFrom('shipping_rates')
      .select(['id', 'shipping_method_id', 'shipping_zone_id', 'rate'])
      .orderBy('shipping_method_id')
      .execute()

    // Filter out any results with undefined/null values to match the return type
    return results.filter(result =>
      result.shipping_method_id !== null
      && result.shipping_method_id !== undefined
      && result.shipping_zone_id !== null
      && result.shipping_zone_id !== undefined,
    ) as { id: number, shipping_method_id: number, shipping_zone_id: number, rate: number }[]
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to format shipping rate options: ${error.message}`)
    }

    throw error
  }
}

/**
 * Get shipping rates for a specific method
 *
 * @param methodId The shipping method to filter by
 * @returns List of shipping rates for the specified method
 */
export async function getShippingRatesByMethod(methodId: number): Promise<ShippingRateJsonResponse[]> {
  try {
    const rates = await db
      .selectFrom('shipping_rates')
      .selectAll()
      .where('shipping_method_id', '=', methodId)
      .orderBy('weight_from')
      .execute()

    return rates
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to get shipping rates by method: ${error.message}`)
    }

    throw error
  }
}
