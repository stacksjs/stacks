import type { ShippingRateJsonResponse } from '@stacksjs/orm'
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

/**
 * Fetch all shipping rates
 */
export async function fetchAll(): Promise<ShippingRateJsonResponse[]> {
  return await db.selectFrom('shipping_rates').selectAll().execute()
}

/**
 * Get shipping rates by zone
 *
 * @param zone Shipping zone identifier
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
 * @param zone Shipping zone identifier
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
export function formatShippingRateOptions(): Promise<{ id: number, shipping_method_id: number, shipping_zone_id: number, rate: number }[]> {
  try {
    return db
      .selectFrom('shipping_rates')
      .select(['id', 'shipping_method_id', 'shipping_zone_id', 'rate'])
      .orderBy('shipping_method_id')
      .execute()
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
 * @param method The shipping method to filter by
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
