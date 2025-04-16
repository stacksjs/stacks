// Import dependencies
import type { NewShippingZone, ShippingZoneJsonResponse } from '@stacksjs/orm'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'

/**
 * Create a new shipping zone
 *
 * @param data The shipping zone data to store
 * @returns The newly created shipping zone record
 */
export async function store(data: NewShippingZone): Promise<ShippingZoneJsonResponse> {
  try {
    const zoneData = {
      ...data,
      uuid: randomUUIDv7(),
    }

    const result = await db
      .insertInto('shipping_zones')
      .values(zoneData)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to create shipping zone')

    return result
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
 * @param data Array of shipping zone data to store
 * @returns Number of shipping zones created
 */
export async function bulkStore(data: NewShippingZone[]): Promise<number> {
  if (!data.length)
    return 0

  try {
    const zoneDataArray = data.map(item => ({
      ...item,
      uuid: randomUUIDv7(),
    }))

    const result = await db
      .insertInto('shipping_zones')
      .values(zoneDataArray)
      .executeTakeFirst()

    return Number(result.numInsertedOrUpdatedRows)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create shipping zones in bulk: ${error.message}`)
    }

    throw error
  }
}
