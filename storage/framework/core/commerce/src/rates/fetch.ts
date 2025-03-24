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

/**
 * Get shipping rates by zone
 *
 * @param zone Shipping zone identifier
 * @returns List of shipping rates for the specified zone
 */
export async function getRatesByZone(zone: string): Promise<ShippingRateJsonResponse[]> {
  try {
    const rates = await db
      .selectFrom('shipping_rates')
      .selectAll()
      .where('zone', '=', zone)
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
export async function getRateByWeightAndZone(weight: number, zone: string): Promise<ShippingRateJsonResponse | undefined> {
  try {
    const rate = await db
      .selectFrom('shipping_rates')
      .selectAll()
      .where('zone', '=', zone)
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
export function formatShippingRateOptions(): Promise<{ id: number, method: string, zone: string, rate: number }[]> {
  try {
    return db
      .selectFrom('shipping_rates')
      .select(['id', 'method', 'zone', 'rate'])
      .orderBy('method')
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
export async function getShippingRatesByMethod(method: string): Promise<ShippingRateJsonResponse[]> {
  try {
    const rates = await db
      .selectFrom('shipping_rates')
      .selectAll()
      .where('method', '=', method)
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
