// Import dependencies
type ShippingRateJsonResponse = ModelRow<typeof ShippingRate>
type NewShippingRate = NewModelData<typeof ShippingRate>
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
    const method = await fetchShippingMethodById(Number(data.shippingmethod_id))
    const zone = await fetchShippingZoneById(Number(data.shippingzone_id))

    const rateData = {
      weightFrom: data.weightFrom,
      weightTo: data.weightTo,
      rate: data.rate,
      shippingmethod_id: method?.id,
      shippingzone_id: zone?.id,
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
      const method = await fetchShippingMethodById(Number(item.shippingmethod_id))
      const zone = await fetchShippingZoneById(Number(item.shippingzone_id))

      if (!method) {
        console.warn(`Shipping method with ID "${item.shippingmethod_id}" not found for bulk insert`)
      }

      if (!zone) {
        console.warn(`Shipping zone with ID "${item.shippingzone_id}" not found for bulk insert`)
      }
    }

    const rateDataArray = data.map(item => ({
      weightFrom: item.weightFrom,
      weightTo: item.weightTo,
      rate: item.rate,
      shippingmethod_id: item.shippingmethod_id,
      shippingzone_id: item.shippingzone_id,
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
