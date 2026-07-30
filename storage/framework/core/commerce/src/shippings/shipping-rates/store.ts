// Import dependencies
type ShippingRateJsonResponse = ModelRow<typeof ShippingRate>
type NewShippingRate = NewModelData<typeof ShippingRate>
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'
import { mutationCount } from '../../utils/mutation-count'
import { fetchById as fetchShippingMethodById } from '../shipping-methods/fetch'
import { fetchById as fetchShippingZoneById } from '../shipping-zones/fetch'
import { shippingRateWriteData } from '../write-data'

/**
 * Create a new shipping rate
 *
 * @param data The shipping rate data to store
 * @returns The newly created shipping rate record
 */
export async function store(data: NewShippingRate): Promise<ShippingRateJsonResponse> {
  try {
    const input = shippingRateWriteData(data as Record<string, unknown>)
    const methodId = Number(input.shipping_method_id)
    const zoneId = Number(input.shipping_zone_id)
    const [method, zone] = await Promise.all([
      fetchShippingMethodById(methodId),
      fetchShippingZoneById(zoneId),
    ])
    if (!method)
      throw new Error(`Shipping method ${methodId} was not found`)
    if (!zone)
      throw new Error(`Shipping zone ${zoneId} was not found`)

    const uuid = randomUUIDv7()
    const rateData = {
      ...input,
      shipping_method_id: Number(method.id),
      shipping_zone_id: Number(zone.id),
      uuid,
    }

    await db
      .insertInto('shipping_rates')
      .values(rateData)
      .executeTakeFirst()

    const model = await db
      .selectFrom('shipping_rates')
      .where('uuid', '=', uuid)
      .selectAll()
      .executeTakeFirst()
    if (!model)
      throw new Error('Failed to resolve created shipping rate')
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
      const input = shippingRateWriteData(item as Record<string, unknown>)
      const method = await fetchShippingMethodById(Number(input.shipping_method_id))
      const zone = await fetchShippingZoneById(Number(input.shipping_zone_id))

      if (!method)
        throw new Error(`Shipping method ${String(input.shipping_method_id)} was not found`)
      if (!zone)
        throw new Error(`Shipping zone ${String(input.shipping_zone_id)} was not found`)
    }

    const rateDataArray = data.map(item => ({
      ...shippingRateWriteData(item as Record<string, unknown>),
      uuid: randomUUIDv7(),
    }))

    const result = await db
      .insertInto('shipping_rates')
      .values(rateDataArray)
      .executeTakeFirst()

    return mutationCount(result)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create shipping rates in bulk: ${error.message}`)
    }

    throw error
  }
}
