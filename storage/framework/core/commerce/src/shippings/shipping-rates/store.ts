import type { ModelRow, NewModelData, ShippingRate } from '@stacksjs/orm'
// Import dependencies
type ShippingRateJsonResponse = ModelRow<typeof ShippingRate>
type NewShippingRate = NewModelData<typeof ShippingRate>
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'
import { mutationCount } from '../../utils/mutation-count'
import { shippingRateWriteData } from '../write-data'
import { ShippingRateInputError, validateShippingRateWrite } from './validate-write'

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
    await validateShippingRateWrite(input)

    const uuid = randomUUIDv7()
    const rateData = {
      ...input,
      shipping_method_id: methodId,
      shipping_zone_id: zoneId,
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
    if (error instanceof ShippingRateInputError)
      throw error
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
      await validateShippingRateWrite(input)
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
    if (error instanceof ShippingRateInputError)
      throw error
    if (error instanceof Error) {
      throw new TypeError(`Failed to create shipping rates in bulk: ${error.message}`)
    }

    throw error
  }
}
