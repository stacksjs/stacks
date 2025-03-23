// Import dependencies
import type { ShippingZoneRequestType } from '@stacksjs/orm'
import type { NewShippingZone, ShippingZoneJsonResponse } from '../../../../orm/src/models/ShippingZone'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'

/**
 * Create a new shipping zone
 *
 * @param request Shipping zone data to store
 * @returns The newly created shipping zone record
 */
export async function store(request: ShippingZoneRequestType): Promise<ShippingZoneJsonResponse | undefined> {
  // Validate the request data
  await request.validate()

  try {
    // Prepare shipping zone data
    const zoneData: NewShippingZone = {
      name: request.get('name'),
      countries: request.get('countries'),
      regions: request.get('regions'),
      postal_codes: request.get('postal_codes'),
      status: request.get('status'),
      shipping_method_id: request.get<number>('shipping_method_id'),
    }

    // Insert the shipping zone
    const result = await db
      .insertInto('shipping_zones')
      .values(zoneData)
      .executeTakeFirst()

    const zoneId = Number(result.insertId) || Number(result.numInsertedOrUpdatedRows)

    // Retrieve the newly created shipping zone
    const shippingZone = await db
      .selectFrom('shipping_zones')
      .where('id', '=', zoneId)
      .selectAll()
      .executeTakeFirst()

    return shippingZone
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create shipping zone: ${error.message}`)
    }

    throw error
  }
}

/**
 * Create multiple shipping zones at once
 *
 * @param requests Array of shipping zone data to store
 * @returns Number of shipping zones created
 */
export async function bulkStore(requests: ShippingZoneRequestType[]): Promise<number> {
  if (!requests.length)
    return 0

  let createdCount = 0

  try {
    // Process each shipping zone
    await db.transaction().execute(async (trx) => {
      for (const request of requests) {
        // Validate request data
        request.validate()

        // Prepare shipping zone data
        const zoneData: NewShippingZone = {
          name: request.get('name'),
          countries: request.get('countries'),
          regions: request.get('regions'),
          postal_codes: request.get('postal_codes'),
          status: request.get('status'),
          shipping_method_id: request.get<number>('shipping_method_id'),
          uuid: randomUUIDv7(),
        }

        // Insert the shipping zone
        await trx
          .insertInto('shipping_zones')
          .values(zoneData)
          .execute()

        createdCount++
      }
    })

    return createdCount
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create shipping zones in bulk: ${error.message}`)
    }

    throw error
  }
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
