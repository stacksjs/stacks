// Import dependencies
import type { NewShippingRate, ShippingRateJsonResponse } from '@stacksjs/orm'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'
import { fetchById } from './fetch'

/**
 * Validate shipping method exists by name
 */
async function validateShippingMethodByName(name: string): Promise<boolean> {
  try {
    const method = await db
      .selectFrom('shipping_methods')
      .where('name', '=', name)
      .select('id')
      .executeTakeFirst()

    return !!method
  } catch (error) {
    console.warn(`Failed to validate shipping method by name "${name}":`, error)
    return false
  }
}

/**
 * Validate shipping zone exists by name
 */
async function validateShippingZoneByName(name: string): Promise<boolean> {
  try {
    const zone = await db
      .selectFrom('shipping_zones')
      .where('name', '=', name)
      .select('id')
      .executeTakeFirst()

    return !!zone
  } catch (error) {
    console.warn(`Failed to validate shipping zone by name "${name}":`, error)
    return false
  }
}

/**
 * Create a new shipping rate
 *
 * @param data The shipping rate data to store
 * @returns The newly created shipping rate record
 */
export async function store(data: NewShippingRate): Promise<ShippingRateJsonResponse> {
  try {
    // Validate that the shipping method and zone exist
    const methodExists = await validateShippingMethodByName(data.method)
    const zoneExists = await validateShippingZoneByName(data.zone)

    if (!methodExists) {
      console.warn(`Shipping method "${data.method}" not found, proceeding with creation anyway`)
    }

    if (!zoneExists) {
      console.warn(`Shipping zone "${data.zone}" not found, proceeding with creation anyway`)
    }

    const rateData = {
      ...data,
      uuid: randomUUIDv7(),
    }

    const result = await db
      .insertInto('shipping_rates')
      .values(rateData)
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to create shipping rate')

    const insertId = Number(result.insertId) || Number(result.numInsertedOrUpdatedRows)

    const model = await fetchById(insertId)

    return model as ShippingRateJsonResponse
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create shipping rate: ${error.message}`)
    }

    throw error
  }
}

/**
 * Create multiple shipping rates at once
 *
 * @param data Array of shipping rate data to store
 * @returns Number of shipping rates created
 */
export async function bulkStore(data: NewShippingRate[]): Promise<number> {
  if (!data.length)
    return 0

  try {
    // Validate all methods and zones before bulk insert
    for (const item of data) {
      const methodExists = await validateShippingMethodByName(item.method)
      const zoneExists = await validateShippingZoneByName(item.zone)

      if (!methodExists) {
        console.warn(`Shipping method "${item.method}" not found for bulk insert`)
      }

      if (!zoneExists) {
        console.warn(`Shipping zone "${item.zone}" not found for bulk insert`)
      }
    }

    const rateDataArray = data.map(item => ({
      ...item,
      uuid: randomUUIDv7(),
    }))

    const result = await db
      .insertInto('shipping_rates')
      .values(rateDataArray)
      .executeTakeFirst()

    return Number(result.numInsertedOrUpdatedRows)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create shipping rates in bulk: ${error.message}`)
    }

    throw error
  }
}
