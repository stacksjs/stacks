import type { ShippingZoneJsonResponse } from '@stacksjs/orm'
import { db } from '@stacksjs/database'

/**
 * Fetch all shipping zones
 */
export async function fetchAll(): Promise<ShippingZoneJsonResponse[]> {
  return await db.selectFrom('shipping_zones').selectAll().execute()
}

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

/**
 * Format shipping zone options for dropdown menus or selectors
 *
 * @returns Array of formatted shipping zone options with id, name, and status
 */
export function formatZoneOptions(): Promise<{ id: number, name: string, status: string | string[], countries: string | undefined }[]> {
  try {
    return db
      .selectFrom('shipping_zones')
      .select(['id', 'name', 'status', 'countries'])
      .orderBy('name')
      .execute()
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to format shipping zone options: ${error.message}`)
    }

    throw error
  }
}

/**
 * Get active shipping zones
 *
 * @returns List of active shipping zones
 */
export async function getActiveShippingZones(): Promise<ShippingZoneJsonResponse[]> {
  try {
    const activeZones = await db
      .selectFrom('shipping_zones')
      .selectAll()
      .where('status', '=', 'active')
      .orderBy('name')
      .execute()

    return activeZones
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to get active shipping zones: ${error.message}`)
    }

    throw error
  }
}

/**
 * Get shipping zones by country code
 *
 * @param countryCode ISO country code
 * @returns List of shipping zones covering the specified country
 */
export async function getZonesByCountry(countryCode: string): Promise<ShippingZoneJsonResponse[]> {
  try {
    // This uses a LIKE query assuming countries are stored as JSON strings
    // You may need to adjust based on your actual data structure
    const zones = await db
      .selectFrom('shipping_zones')
      .selectAll()
      .where('countries', 'like', `%${countryCode}%`)
      .where('status', '=', 'active')
      .orderBy('name')
      .execute()

    return zones
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to get shipping zones by country: ${error.message}`)
    }

    throw error
  }
}
