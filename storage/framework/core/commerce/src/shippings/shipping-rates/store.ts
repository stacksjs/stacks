// Import dependencies
import type { NewShippingRate, ShippingRateJsonResponse } from '@stacksjs/orm'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'
import { fetchById as fetchShippingMethodById } from '../shipping-methods/fetch'
import { fetchById as fetchShippingZoneById } from '../shipping-zones/fetch'
import { fetchById } from './fetch'

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
      const method = await fetchShippingMethodById(Number(item.shipping_method_id))
      const zone = await fetchShippingZoneById(Number(item.shipping_zone_id))

      if (!method) {
        console.warn(`Shipping method with ID "${item.shipping_method_id}" not found for bulk insert`)
      }

      if (!zone) {
        console.warn(`Shipping zone with ID "${item.shipping_zone_id}" not found for bulk insert`)
      }
    }

    const rateDataArray = data.map(item => ({
      weight_from: item.weight_from,
      weight_to: item.weight_to,
      rate: item.rate,
      shipping_method_id: item.shipping_method_id,
      shipping_zone_id: item.shipping_zone_id,
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
