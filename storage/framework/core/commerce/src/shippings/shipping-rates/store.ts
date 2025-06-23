// Import dependencies
import type { NewShippingRate, ShippingMethodJsonResponse, ShippingRateJsonResponse, ShippingZoneJsonResponse } from '@stacksjs/orm'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'
import { fetchById as fetchShippingMethodById } from '../shipping-methods/fetch'
import { fetchById as fetchShippingZoneById } from '../shipping-zones/fetch'
import { fetchById } from './fetch'

/**
 * Validate shipping method exists by name
 */
async function findShippingMethodByName(name: string): Promise<ShippingMethodJsonResponse | undefined> {
  try {
    const method = await db
      .selectFrom('shipping_methods')
      .where('name', '=', name)
      .selectAll()
      .executeTakeFirst()

    return method
  }
  catch (error) {
    console.warn(`Failed to validate shipping method by name "${name}":`, error)
    return undefined
  }
}

/**
 * Validate shipping zone exists by name
 */
async function findShippingZoneByName(name: string): Promise<ShippingZoneJsonResponse | undefined> {
  try {
    const zone = await db
      .selectFrom('shipping_zones')
      .where('name', '=', name)
      .selectAll()
      .executeTakeFirst()

    return zone
  }
  catch (error) {
    console.warn(`Failed to validate shipping zone by name "${name}":`, error)
    return undefined
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
    const method = await fetchShippingMethodById(Number(data.shipping_method_id))
    const zone = await fetchShippingZoneById(Number(data.shipping_zone_id))

    const rateData = {
      weight_from: data.weight_from,
      weight_to: data.weight_to,
      rate: data.rate,
      shipping_method_id: method?.id,
      shipping_zone_id: zone?.id,
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
